export default async function handler(req, res) {
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only GET requests are supported' 
        });
    }
    
    const { lat, lon } = req.query;
    
    // Validate input parameters
    if (!lat || !lon) {
        return res.status(400).json({ 
            error: 'Missing parameters',
            message: 'Both latitude (lat) and longitude (lon) are required' 
        });
    }
    
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    if (isNaN(latNum) || isNaN(lonNum) || 
        latNum < -90 || latNum > 90 || 
        lonNum < -180 || lonNum > 180) {
        return res.status(400).json({ 
            error: 'Invalid parameters',
            message: 'Latitude must be between -90 and 90, longitude between -180 and 180' 
        });
    }
    
    const apiKey = process.env.WEATHER_KEY;
    
    if (!apiKey) {
        console.error('WEATHER_KEY environment variable is not set');
        return res.status(500).json({ 
            error: 'Server configuration error',
            message: 'Weather API key is not configured. Please contact the administrator.' 
        });
    }
    
    try {
        // Fetch current weather and forecast in parallel for efficiency
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
            fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
        ]);
        
        // Check if both API calls were successful
        if (!currentResponse.ok) {
            const errorText = await currentResponse.text();
            throw new Error(`Weather API error (${currentResponse.status}): ${errorText}`);
        }
        
        if (!forecastResponse.ok) {
            const errorText = await forecastResponse.text();
            throw new Error(`Forecast API error (${forecastResponse.status}): ${errorText}`);
        }
        
        const [currentData, forecastData] = await Promise.all([
            currentResponse.json(),
            forecastResponse.json()
        ]);
        
        // Validate API response structure
        if (!currentData.main || !forecastData.list) {
            throw new Error('Invalid API response structure');
        }
        
        // Analyze conditions
        const analysis = analyzeConditions(currentData, forecastData);
        
        // Prepare response
        const response = {
            result: analysis.result,
            reasons: analysis.reasons,
            forecast: analysis.forecast,
            metadata: {
                timestamp: new Date().toISOString(),
                location: {
                    lat: latNum,
                    lon: lonNum,
                    name: currentData.name || currentData.sys?.country || 'Unknown location'
                },
                conditions: {
                    temp: currentData.main.temp,
                    feels_like: currentData.main.feels_like,
                    humidity: currentData.main.humidity,
                    pressure: currentData.main.pressure,
                    windSpeed: currentData.wind.speed,
                    windDeg: currentData.wind.deg,
                    windGust: currentData.wind.gust || 0,
                    rainfall: getRainfall(currentData),
                    snowfall: getSnowfall(currentData),
                    cloudiness: currentData.clouds.all,
                    weather: currentData.weather[0]?.main || 'Unknown',
                    weatherDescription: currentData.weather[0]?.description || 'No description'
                },
                analysis: {
                    score: analysis.score,
                    factors: analysis.factors,
                    confidence: analysis.confidence,
                    criticalFactors: analysis.criticalFactors
                }
            }
        };
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('API Error:', error.message);
        
        // Return only error response, no mock data
        res.status(500).json({ 
            error: 'Weather service unavailable',
            message: 'Unable to fetch weather data. Please try again later or check your coordinates.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

// Helper function to extract rainfall from different API response formats
function getRainfall(weatherData) {
    if (weatherData.rain) {
        return weatherData.rain['1h'] || weatherData.rain['3h'] || 0;
    }
    return 0;
}

// Helper function to extract snowfall from different API response formats
function getSnowfall(weatherData) {
    if (weatherData.snow) {
        return weatherData.snow['1h'] || weatherData.snow['3h'] || 0;
    }
    return 0;
}

// Main analysis function with stricter thresholds
function analyzeConditions(currentData, forecastData) {
    const current = currentData;
    const forecastList = forecastData.list;
    
    // Extract current conditions
    const currentRain = getRainfall(current);
    const currentSnow = getSnowfall(current);
    const windSpeed = current.wind.speed * 3.6; // Convert m/s to km/h
    const windGust = (current.wind.gust || 0) * 3.6; // Convert m/s to km/h
    const temperature = current.main.temp;
    const humidity = current.main.humidity;
    const cloudiness = current.clouds.all;
    const weatherCondition = current.weather[0]?.main || '';
    const weatherDescription = current.weather[0]?.description || '';
    
    // Analyze next 24-48 hours forecast for decision making
    const forecastAnalysis = analyzeForecast(forecastList);
    
    // STRICTER thresholds based on agricultural best practices and regulations
    const thresholds = {
        // Rain thresholds (mm) - MUCH STRICTER
        rainTolerance: 0.1,           // Any measurable rain is problematic
        maxCurrentRain: 0.5,          // Immediate spreading risk (very low)
        moderateRainThreshold: 1.0,   // Moderate rain threshold
        heavyRainThreshold: 2.5,      // Heavy rain threshold
        
        // 24-hour forecast rain thresholds
        max24hRainTotal: 3,           // Total rain in next 24h that triggers warning
        max24hRainHeavy: 5,           // Total rain that triggers critical warning
        
        // Wind thresholds (km/h) - STRICTER
        idealWindMax: 10,             // Ideal maximum wind speed
        warningWindSpeed: 15,         // Wind speed that triggers warning
        criticalWindSpeed: 20,        // Wind speed that triggers critical warning
        maxWindGust: 25,              // Maximum allowed gust
        
        // Temperature thresholds (°C)
        absoluteMinTemp: 3,           // Minimum temperature for spreading
        idealMinTemp: 5,
        idealMaxTemp: 18,
        absoluteMaxTemp: 25,          // Maximum temperature for spreading
        
        // Humidity thresholds (%)
        minHumidity: 40,
        idealHumidityMin: 60,
        idealHumidityMax: 80,
        maxHumidity: 90,
        
        // Snow/Ice thresholds
        anySnow: 0.1,                 // Any snow accumulation is critical
        
        // Soil conditions (estimated from weather)
        minSoilTemp: 5,               // Minimum soil temperature for absorption
        maxSoilMoisture: 80,          // Maximum soil moisture percentage
    };
    
    // Initialize analysis
    let score = 0; // Start at 0, add points for good conditions
    const reasons = [];
    const criticalFactors = [];
    const factors = {
        rain: { status: 'critical', details: '', weight: 40 },
        wind: { status: 'critical', details: '', weight: 25 },
        temperature: { status: 'critical', details: '', weight: 15 },
        humidity: { status: 'critical', details: '', weight: 5 },
        forecast: { status: 'critical', details: '', weight: 10 },
        snow: { status: 'critical', details: '', weight: 5 }
    };
    
    // 1. RAINFALL ANALYSIS - MOST CRITICAL (40% weight)
    // Any current rain is BAD for slurry spreading
    if (currentRain > thresholds.heavyRainThreshold) {
        score -= 40;
        factors.rain.status = 'critical';
        factors.rain.details = `Heavy current rainfall: ${currentRain.toFixed(1)}mm`;
        reasons.push(`❌ Heavy rainfall (${currentRain.toFixed(1)}mm) - HIGH runoff risk`);
        criticalFactors.push('heavy_rainfall');
    } else if (currentRain > thresholds.moderateRainThreshold) {
        score -= 35;
        factors.rain.status = 'critical';
        factors.rain.details = `Moderate current rainfall: ${currentRain.toFixed(1)}mm`;
        reasons.push(`❌ Moderate rainfall (${currentRain.toFixed(1)}mm) - significant runoff risk`);
        criticalFactors.push('moderate_rainfall');
    } else if (currentRain > thresholds.maxCurrentRain) {
        score -= 30;
        factors.rain.status = 'critical';
        factors.rain.details = `Light current rainfall: ${currentRain.toFixed(1)}mm`;
        reasons.push(`❌ Light rainfall (${currentRain.toFixed(1)}mm) - runoff risk present`);
        criticalFactors.push('light_rainfall');
    } else if (currentRain > thresholds.rainTolerance) {
        score -= 25;
        factors.rain.status = 'bad';
        factors.rain.details = `Trace rainfall: ${currentRain.toFixed(1)}mm`;
        reasons.push(`⚠️ Trace rainfall (${currentRain.toFixed(1)}mm) - not ideal for spreading`);
    } else {
        score += 30; // Good: No current rain
        factors.rain.status = 'excellent';
        factors.rain.details = 'No current rainfall';
        reasons.push('✅ No current rainfall - minimal runoff risk');
    }
    
    // 2. FORECAST RAINFALL ANALYSIS (10% weight)
    if (forecastAnalysis.next24hRain > thresholds.max24hRainHeavy) {
        score -= 10;
        factors.forecast.status = 'critical';
        factors.forecast.details = `Heavy rain forecast: ${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h`;
        reasons.push(`❌ Heavy rain forecast (${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h) - DO NOT SPREAD`);
        criticalFactors.push('heavy_rain_forecast');
    } else if (forecastAnalysis.next24hRain > thresholds.max24hRainTotal) {
        score -= 8;
        factors.forecast.status = 'bad';
        factors.forecast.details = `Significant rain forecast: ${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h`;
        reasons.push(`⚠️ Rain forecast (${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h) - delay recommended`);
    } else if (forecastAnalysis.next24hRain > 0.5) {
        score -= 5;
        factors.forecast.status = 'moderate';
        factors.forecast.details = `Light rain forecast: ${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h`;
        reasons.push(`⚠️ Light rain forecast (${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h) - monitor conditions`);
    } else {
        score += 8;
        factors.forecast.status = 'good';
        factors.forecast.details = 'Dry forecast for next 24h';
        reasons.push('✅ Dry forecast for next 24 hours');
    }
    
    // 3. WIND ANALYSIS - VERY STRICT (25% weight)
    const effectiveWindSpeed = Math.max(windSpeed, windGust);
    
    if (effectiveWindSpeed > thresholds.criticalWindSpeed) {
        score -= 25;
        factors.wind.status = 'critical';
        factors.wind.details = `High wind/gust: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`❌ High winds (${effectiveWindSpeed.toFixed(1)} km/h) - causes significant drift and uneven spreading`);
        criticalFactors.push('high_wind');
    } else if (effectiveWindSpeed > thresholds.warningWindSpeed) {
        score -= 20;
        factors.wind.status = 'bad';
        factors.wind.details = `Moderate wind: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`⚠️ Moderate winds (${effectiveWindSpeed.toFixed(1)} km/h) - causes drift, not recommended`);
    } else if (effectiveWindSpeed > thresholds.idealWindMax) {
        score -= 10;
        factors.wind.status = 'moderate';
        factors.wind.details = `Breezy: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`⚠️ Breezy conditions (${effectiveWindSpeed.toFixed(1)} km/h) - may cause light drift`);
    } else if (effectiveWindSpeed > 5) {
        score += 15;
        factors.wind.status = 'good';
        factors.wind.details = `Light wind: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`✅ Light winds (${effectiveWindSpeed.toFixed(1)} km/h) - acceptable for spreading`);
    } else {
        score += 20;
        factors.wind.status = 'excellent';
        factors.wind.details = `Calm: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`✅ Calm conditions (${effectiveWindSpeed.toFixed(1)} km/h) - ideal for precise application`);
    }
    
    // 4. TEMPERATURE ANALYSIS - STRICTER (15% weight)
    if (temperature < thresholds.absoluteMinTemp) {
        score -= 15;
        factors.temperature.status = 'critical';
        factors.temperature.details = `Too cold: ${temperature.toFixed(1)}°C`;
        reasons.push(`❌ Temperature too low (${temperature.toFixed(1)}°C) - slurry won't absorb properly`);
        criticalFactors.push('low_temperature');
    } else if (temperature > thresholds.absoluteMaxTemp) {
        score -= 15;
        factors.temperature.status = 'critical';
        factors.temperature.details = `Too warm: ${temperature.toFixed(1)}°C`;
        reasons.push(`❌ Temperature too high (${temperature.toFixed(1)}°C) - high volatilization and odor`);
        criticalFactors.push('high_temperature');
    } else if (temperature >= thresholds.idealMinTemp && temperature <= thresholds.idealMaxTemp) {
        score += 12;
        factors.temperature.status = 'excellent';
        factors.temperature.details = `Ideal: ${temperature.toFixed(1)}°C`;
        reasons.push(`✅ Ideal temperature (${temperature.toFixed(1)}°C) for nutrient retention`);
    } else if (temperature >= 3 && temperature < 5) {
        score -= 5;
        factors.temperature.status = 'moderate';
        factors.temperature.details = `Cool: ${temperature.toFixed(1)}°C`;
        reasons.push(`⚠️ Cool temperature (${temperature.toFixed(1)}°C) - absorption may be slow`);
    } else if (temperature > 18 && temperature <= 25) {
        score -= 5;
        factors.temperature.status = 'moderate';
        factors.temperature.details = `Warm: ${temperature.toFixed(1)}°C`;
        reasons.push(`⚠️ Warm temperature (${temperature.toFixed(1)}°C) - some volatilization risk`);
    } else {
        factors.temperature.status = 'moderate';
        factors.temperature.details = `Acceptable: ${temperature.toFixed(1)}°C`;
        reasons.push(`⚠️ Temperature (${temperature.toFixed(1)}°C) within acceptable range`);
    }
    
    // 5. HUMIDITY ANALYSIS (5% weight)
    if (humidity >= thresholds.idealHumidityMin && humidity <= thresholds.idealHumidityMax) {
        score += 4;
        factors.humidity.status = 'excellent';
        factors.humidity.details = `Ideal: ${humidity}%`;
        reasons.push(`✅ Ideal humidity (${humidity}%) - minimizes evaporation`);
    } else if (humidity > thresholds.maxHumidity) {
        score -= 3;
        factors.humidity.status = 'moderate';
        factors.humidity.details = `High: ${humidity}%`;
        reasons.push(`⚠️ High humidity (${humidity}%) - may indicate rain risk`);
    } else if (humidity < thresholds.minHumidity) {
        score -= 3;
        factors.humidity.status = 'moderate';
        factors.humidity.details = `Low: ${humidity}%`;
        reasons.push(`⚠️ Low humidity (${humidity}%) - increases evaporation rate`);
    } else {
        factors.humidity.status = 'good';
        factors.humidity.details = `Acceptable: ${humidity}%`;
    }
    
    // 6. SNOW/ICE ANALYSIS - CRITICAL (5% weight)
    if (currentSnow > thresholds.anySnow) {
        score -= 40; // Automatic fail
        factors.snow.status = 'critical';
        factors.snow.details = `Snow present: ${currentSnow.toFixed(1)}mm`;
        reasons.push(`❌ SNOW/ICE DETECTED (${currentSnow.toFixed(1)}mm) - DO NOT SPREAD SLURRY`);
        criticalFactors.push('snow_ice');
    } else {
        score += 4;
        factors.snow.status = 'excellent';
        factors.snow.details = 'No snow/ice';
    }
    
    // 7. WEATHER CONDITION ANALYSIS - ADDITIONAL STRICT CHECKS
    // Check for storm conditions, fog, etc.
    if (weatherCondition.includes('Thunderstorm') || weatherCondition.includes('Squall')) {
        score -= 30;
        reasons.push('❌ STORM CONDITIONS - unsafe for spreading operations');
        criticalFactors.push('storm_conditions');
    }
    
    if (weatherCondition.includes('Fog') || weatherCondition.includes('Mist') || weatherCondition.includes('Haze')) {
        score -= 10;
        reasons.push('⚠️ Reduced visibility conditions - not ideal for spreading');
    }
    
    // 8. TIME OF DAY CONSIDERATION (based on timestamp)
    const currentHour = new Date().getHours();
    if (currentHour >= 10 && currentHour <= 16) {
        // Midday - good for spreading
        score += 5;
        reasons.push('✅ Daytime hours - optimal for application');
    } else if (currentHour >= 6 && currentHour <= 9) {
        // Morning - good
        score += 3;
        reasons.push('✅ Morning hours - good for application');
    } else if (currentHour >= 17 && currentHour <= 19) {
        // Evening - acceptable
        score += 1;
        reasons.push('⚠️ Evening hours - acceptable but less optimal');
    } else {
        // Night - not recommended
        score -= 5;
        reasons.push('⚠️ Nighttime hours - not recommended for spreading');
    }
    
    // Generate detailed forecast for display (next 4 days)
    const forecast = generateDetailedForecast(forecastList);
    
    // Calculate final score (0-100 scale)
    const maxPossibleScore = 86; // Theoretical maximum based on scoring system
    const adjustedScore = Math.max(0, Math.min(100, (score + 40) * (100 / maxPossibleScore)));
    
    // DETERMINE FINAL RECOMMENDATION WITH STRICTER CRITERIA
    let result;
    let confidence = 'high';
    
    // Check for automatic disqualifiers FIRST
    if (criticalFactors.length > 0) {
        // Check for critical factors that make spreading impossible
        const severeCriticalFactors = ['heavy_rainfall', 'heavy_rain_forecast', 'snow_ice', 'storm_conditions'];
        const hasSevereCritical = criticalFactors.some(factor => severeCriticalFactors.includes(factor));
        
        if (hasSevereCritical) {
            result = "BAD TIME TO SPREAD SLURRY";
            confidence = 'very high';
            reasons.unshift('CRITICAL RISK FACTORS DETECTED - DO NOT SPREAD');
        } else if (criticalFactors.length >= 2) {
            // Multiple critical factors
            result = "BAD TIME TO SPREAD SLURRY";
            confidence = 'high';
            reasons.unshift('Multiple risk factors detected - high environmental risk');
        } else {
            // One non-severe critical factor
            result = "RISKY TIME TO SPREAD SLURRY";
            confidence = 'medium';
            reasons.unshift('Significant risk factors present - caution required');
        }
    } else if (adjustedScore >= 85) {
        result = "EXCELLENT TIME TO SPREAD SLURRY";
        confidence = 'very high';
        reasons.unshift('All conditions optimal for slurry application');
    } else if (adjustedScore >= 70) {
        result = "GOOD TIME TO SPREAD SLURRY";
        confidence = 'high';
        reasons.unshift('Conditions are favorable for slurry spreading');
    } else if (adjustedScore >= 55) {
        result = "MODERATELY GOOD TIME TO SPREAD SLURRY";
        confidence = 'medium';
        reasons.unshift('Most conditions acceptable with minor concerns');
    } else if (adjustedScore >= 40) {
        result = "RISKY TIME TO SPREAD SLURRY";
        confidence = 'medium';
        reasons.unshift('Multiple concerns present - consider postponing');
    } else {
        result = "BAD TIME TO SPREAD SLURRY";
        confidence = 'high';
        reasons.unshift('Unfavorable conditions - high risk of environmental impact');
    }
    
    return {
        result,
        reasons,
        forecast,
        score: Math.round(adjustedScore),
        factors,
        confidence,
        criticalFactors
    };
}

// Analyze forecast data for the next 48 hours
function analyzeForecast(forecastList) {
    let next24hRain = 0;
    let next48hRain = 0;
    let max24hWind = 0;
    let min24hTemp = Infinity;
    let max24hTemp = -Infinity;
    let rainPeriods = 0; // Count periods with rain
    
    // Analyze next 48 hours (16 periods of 3-hour intervals)
    for (let i = 0; i < Math.min(16, forecastList.length); i++) {
        const period = forecastList[i];
        
        // Rainfall
        const periodRain = period.rain ? period.rain['3h'] || 0 : 0;
        if (periodRain > 0) {
            rainPeriods++;
        }
        if (i < 8) next24hRain += periodRain;
        next48hRain += periodRain;
        
        // Wind
        const periodWind = period.wind.speed * 3.6;
        max24hWind = Math.max(max24hWind, periodWind);
        
        // Temperature
        min24hTemp = Math.min(min24hTemp, period.main.temp);
        max24hTemp = Math.max(max24hTemp, period.main.temp);
    }
    
    return {
        next24hRain,
        next48hRain,
        max24hWind,
        rainPeriods,
        min24hTemp: min24hTemp === Infinity ? null : min24hTemp,
        max24hTemp: max24hTemp === -Infinity ? null : max24hTemp
    };
}

// Generate detailed forecast for display
function generateDetailedForecast(forecastList) {
    const dailyForecast = [];
    const days = ['Today', 'Tomorrow', 'Day After Tomorrow', 'In 3 Days'];
    
    // Group forecasts by day
    const groupedByDay = {};
    
    forecastList.forEach(period => {
        const date = new Date(period.dt * 1000);
        const dayKey = date.toDateString();
        
        if (!groupedByDay[dayKey]) {
            groupedByDay[dayKey] = {
                temps: [],
                rains: [],
                winds: [],
                conditions: [],
                timestamps: []
            };
        }
        
        groupedByDay[dayKey].temps.push(period.main.temp);
        groupedByDay[dayKey].rains.push(period.rain ? period.rain['3h'] || 0 : 0);
        groupedByDay[dayKey].winds.push(period.wind.speed * 3.6);
        groupedByDay[dayKey].conditions.push(period.weather[0]?.main || 'Clear');
        groupedByDay[dayKey].timestamps.push(date);
    });
    
    // Process up to 4 days
    const dayKeys = Object.keys(groupedByDay).slice(0, 4);
    
    dayKeys.forEach((dayKey, index) => {
        const dayData = groupedByDay[dayKey];
        
        // Calculate averages and find most common condition
        const avgTemp = dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length;
        const totalRain = dayData.rains.reduce((a, b) => a + b, 0);
        const avgWind = dayData.winds.reduce((a, b) => a + b, 0) / dayData.winds.length;
        const maxWind = Math.max(...dayData.winds);
        
        // Find most common weather condition
        const conditionCounts = {};
        dayData.conditions.forEach(cond => {
            conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
        });
        const mostCommonCondition = Object.keys(conditionCounts).reduce((a, b) => 
            conditionCounts[a] > conditionCounts[b] ? a : b
        );
        
        // Determine min and max temps for the day
        const minTemp = Math.min(...dayData.temps);
        const maxTemp = Math.max(...dayData.temps);
        
        dailyForecast.push({
            day: days[index] || `Day ${index + 1}`,
            date: dayData.timestamps[0].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            temp: `${Math.round(avgTemp)}°C`,
            tempRange: `${Math.round(minTemp)}°C / ${Math.round(maxTemp)}°C`,
            conditions: mostCommonCondition,
            rain: `${totalRain.toFixed(1)} mm`,
            wind: `${avgWind.toFixed(1)} km/h`,
            maxWind: `${maxWind.toFixed(1)} km/h`,
            icon: getWeatherIcon(mostCommonCondition)
        });
    });
    
    // Ensure we always have at least 4 days
    while (dailyForecast.length < 4) {
        const nextDayIndex = dailyForecast.length;
        const placeholderDate = new Date();
        placeholderDate.setDate(placeholderDate.getDate() + nextDayIndex);
        
        dailyForecast.push({
            day: days[nextDayIndex] || `Day ${nextDayIndex + 1}`,
            date: placeholderDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            temp: '--°C',
            tempRange: '--°C / --°C',
            conditions: 'No data',
            rain: '-- mm',
            wind: '-- km/h',
            maxWind: '-- km/h',
            icon: 'question'
        });
    }
    
    return dailyForecast;
}

// Helper function to map weather conditions to icons
function getWeatherIcon(condition) {
    const iconMap = {
        'Clear': 'sun',
        'Clouds': 'cloud',
        'Rain': 'cloud-rain',
        'Drizzle': 'cloud-rain',
        'Thunderstorm': 'bolt',
        'Snow': 'snowflake',
        'Mist': 'smog',
        'Smoke': 'smog',
        'Haze': 'smog',
        'Dust': 'smog',
        'Fog': 'smog',
        'Sand': 'smog',
        'Ash': 'smog',
        'Squall': 'wind',
        'Tornado': 'tornado'
    };
    
    return iconMap[condition] || 'question';
}
