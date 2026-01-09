export default async function handler(req, res) {
    // Enable CORS
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
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
            fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
        ]);
        
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
        
        if (!currentData.main || !forecastData.list) {
            throw new Error('Invalid API response structure');
        }
        
        const analysis = analyzeConditions(currentData, forecastData);
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
                    confidence: analysis.confidence
                }
            }
        };
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('API Error:', error.message);
        
        res.status(500).json({ 
            error: 'Weather service unavailable',
            message: 'Unable to fetch weather data. Please try again later or check your coordinates.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

function getRainfall(weatherData) {
    if (weatherData.rain) {
        return weatherData.rain['1h'] || weatherData.rain['3h'] || 0;
    }
    return 0;
}

function getSnowfall(weatherData) {
    if (weatherData.snow) {
        return weatherData.snow['1h'] || weatherData.snow['3h'] || 0;
    }
    return 0;
}

function analyzeConditions(currentData, forecastData) {
    const current = currentData;
    const forecastList = forecastData.list;
    const currentRain = getRainfall(current);
    const currentSnow = getSnowfall(current);
    const windSpeed = current.wind.speed * 3.6; 
    const windGust = (current.wind.gust || 0) * 3.6; 
    const temperature = current.main.temp;
    const humidity = current.main.humidity;
    const cloudiness = current.clouds.all;
    
    const forecastAnalysis = analyzeForecast(forecastList);
    
    const thresholds = {
        maxCurrentRain: 3, 
        max24hRain: 10,    
        max48hRain: 15,    
        
        maxWindSpeed: 20,  
        maxWindGust: 30,   
        
        minTemp: 2,        
        idealTempMin: 5,
        idealTempMax: 25,
        maxTemp: 30,       
        
        minHumidity: 40,
        idealHumidityMin: 60,
        idealHumidityMax: 85,
        maxHumidity: 95,   
        maxSnow: 0,        
    };
    
    
    let score = 100; 
    const reasons = [];
    const factors = {
        rain: { status: 'good', details: '' },
        wind: { status: 'good', details: '' },
        temperature: { status: 'good', details: '' },
        humidity: { status: 'good', details: '' },
        forecast: { status: 'good', details: '' },
        snow: { status: 'good', details: '' }
    };
    
    if (currentRain > thresholds.maxCurrentRain) {
        score -= 40;
        factors.rain.status = 'critical';
        factors.rain.details = `Current rainfall (${currentRain.toFixed(1)}mm) exceeds safe limit`;
        reasons.push(`Heavy current rainfall (${currentRain.toFixed(1)}mm) - high runoff risk`);
    } else if (currentRain > 0) {
        score -= 10;
        factors.rain.status = 'moderate';
        factors.rain.details = `Light rainfall (${currentRain.toFixed(1)}mm) present`;
        reasons.push(`Light rainfall (${currentRain.toFixed(1)}mm) - monitor for changes`);
    } else {
        score += 5;
        factors.rain.status = 'excellent';
        factors.rain.details = 'No current rainfall';
        reasons.push('No current rainfall - optimal for absorption');
    }
    
    if (forecastAnalysis.next24hRain > thresholds.max24hRain) {
        score -= 30;
        factors.forecast.status = 'critical';
        factors.forecast.details = `Heavy rain forecast: ${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h`;
        reasons.push(`Significant rain forecast (${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h) - delay spreading`);
    } else if (forecastAnalysis.next24hRain > 5) {
        score -= 15;
        factors.forecast.status = 'moderate';
        factors.forecast.details = `Rain expected: ${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h`;
        reasons.push(`Rain expected (${forecastAnalysis.next24hRain.toFixed(1)}mm in 24h) - consider postponing`);
    }
    
    const effectiveWindSpeed = Math.max(windSpeed, windGust);
    if (effectiveWindSpeed > thresholds.maxWindGust) {
        score -= 25;
        factors.wind.status = 'critical';
        factors.wind.details = `High wind/gust: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`Strong winds (${effectiveWindSpeed.toFixed(1)} km/h) cause uneven spreading and drift`);
    } else if (effectiveWindSpeed > thresholds.maxWindSpeed) {
        score -= 15;
        factors.wind.status = 'moderate';
        factors.wind.details = `Moderate wind: ${effectiveWindSpeed.toFixed(1)} km/h`;
        reasons.push(`Moderate winds (${effectiveWindSpeed.toFixed(1)} km/h) - monitor wind direction`);
    } else if (windSpeed > 10) {
        score += 5;
        factors.wind.status = 'good';
        factors.wind.details = `Light wind: ${windSpeed.toFixed(1)} km/h`;
        reasons.push(`Light winds (${windSpeed.toFixed(1)} km/h) - good for even distribution`);
    } else {
        score += 10;
        factors.wind.status = 'excellent';
        factors.wind.details = `Calm conditions: ${windSpeed.toFixed(1)} km/h`;
        reasons.push(`Calm conditions (${windSpeed.toFixed(1)} km/h) - ideal for precision spreading`);
    }
    
    if (temperature >= thresholds.idealTempMin && temperature <= thresholds.idealTempMax) {
        score += 15;
        factors.temperature.status = 'excellent';
        factors.temperature.details = `Ideal temperature: ${temperature.toFixed(1)}°C`;
        reasons.push(`Optimal temperature (${temperature.toFixed(1)}°C) for nutrient retention`);
    } else if (temperature < thresholds.minTemp) {
        score -= 20;
        factors.temperature.status = 'critical';
        factors.temperature.details = `Too cold: ${temperature.toFixed(1)}°C`;
        reasons.push(`Low temperature (${temperature.toFixed(1)}°C) - slurry may freeze or not absorb properly`);
    } else if (temperature > thresholds.maxTemp) {
        score -= 15;
        factors.temperature.status = 'moderate';
        factors.temperature.details = `High temperature: ${temperature.toFixed(1)}°C`;
        reasons.push(`High temperature (${temperature.toFixed(1)}°C) increases volatilization losses`);
    } else {
        score += 5;
        factors.temperature.status = 'good';
        factors.temperature.details = `Acceptable temperature: ${temperature.toFixed(1)}°C`;
        reasons.push(`Acceptable temperature (${temperature.toFixed(1)}°C) for spreading`);
    }
    
    if (humidity >= thresholds.idealHumidityMin && humidity <= thresholds.idealHumidityMax) {
        score += 10;
        factors.humidity.status = 'excellent';
        factors.humidity.details = `Ideal humidity: ${humidity}%`;
        reasons.push(`Optimal humidity (${humidity}%) reduces evaporation and aids absorption`);
    } else if (humidity > thresholds.maxHumidity) {
        score -= 10;
        factors.humidity.status = 'moderate';
        factors.humidity.details = `Very high humidity: ${humidity}%`;
        reasons.push(`High humidity (${humidity}%) may indicate impending rain or disease risk`);
    } else if (humidity < thresholds.minHumidity) {
        score -= 5;
        factors.humidity.status = 'moderate';
        factors.humidity.details = `Low humidity: ${humidity}%`;
        reasons.push(`Low humidity (${humidity}%) increases evaporation rate`);
    } else {
        score += 5;
        factors.humidity.status = 'good';
        factors.humidity.details = `Acceptable humidity: ${humidity}%`;
        reasons.push(`Humidity (${humidity}%) within acceptable range`);
    }
    
    if (currentSnow > thresholds.maxSnow) {
        score -= 40; // Snow is an immediate disqualifier
        factors.snow.status = 'critical';
        factors.snow.details = `Snow accumulation: ${currentSnow.toFixed(1)}mm`;
        reasons.push(`Snow present (${currentSnow.toFixed(1)}mm) - do not spread slurry`);
    }
    
    const weatherCondition = current.weather[0]?.main || '';
    if (weatherCondition.includes('Thunderstorm') || weatherCondition.includes('Squall')) {
        score -= 30;
        reasons.push('Storm conditions detected - unsafe for spreading');
    }
    

    const forecast = generateDetailedForecast(forecastList);
    
    // Determine final recommendation with confidence level
    let result;
    let confidence = 'high';
    
    if (score >= 85) {
        result = "EXCELLENT TIME TO SPREAD SLURRY";
        confidence = 'very high';
        reasons.unshift('All critical factors within optimal ranges for slurry application');
    } else if (score >= 70) {
        result = "GOOD TIME TO SPREAD SLURRY";
        confidence = 'high';
        reasons.unshift('Conditions are favorable for slurry spreading');
    } else if (score >= 50) {
        result = "MODERATELY GOOD TIME TO SPREAD SLURRY";
        confidence = 'medium';
        reasons.unshift('Most factors acceptable with minor concerns');
    } else if (score >= 30) {
        result = "RISKY TIME TO SPREAD SLURRY";
        confidence = 'low';
        reasons.unshift('Multiple risk factors detected - caution advised');
    } else {
        result = "BAD TIME TO SPREAD SLURRY";
        confidence = 'very high';
        reasons.unshift('Unfavorable conditions - high risk of environmental impact');
    }
    
    return {
        result,
        reasons,
        forecast,
        score: Math.max(0, Math.min(100, score)), 
        factors,
        confidence
    };
}

// Analyze forecast data for the next 48 hours
function analyzeForecast(forecastList) {
    let next24hRain = 0;
    let next48hRain = 0;
    let max24hWind = 0;
    let min24hTemp = Infinity;
    let max24hTemp = -Infinity;
    
    // Analyze next 48 hours (16 periods of 3-hour intervals)
    for (let i = 0; i < Math.min(16, forecastList.length); i++) {
        const period = forecastList[i];
        
        const periodRain = period.rain ? period.rain['3h'] || 0 : 0;
        if (i < 8) next24hRain += periodRain;
        next48hRain += periodRain;
        
        const periodWind = period.wind.speed * 3.6;
        max24hWind = Math.max(max24hWind, periodWind);
        
        min24hTemp = Math.min(min24hTemp, period.main.temp_min);
        max24hTemp = Math.max(max24hTemp, period.main.temp_max);
    }
    
    return {
        next24hRain,
        next48hRain,
        max24hWind,
        min24hTemp: min24hTemp === Infinity ? null : min24hTemp,
        max24hTemp: max24hTemp === -Infinity ? null : max24hTemp
    };
}

function generateDetailedForecast(forecastList) {
    const dailyForecast = [];
    const days = ['Today', 'Tomorrow', 'Day After Tomorrow', 'In 3 Days'];
    
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
    
    const dayKeys = Object.keys(groupedByDay).slice(0, 4);
    
    dayKeys.forEach((dayKey, index) => {
        const dayData = groupedByDay[dayKey];
        
        const avgTemp = dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length;
        const totalRain = dayData.rains.reduce((a, b) => a + b, 0);
        const avgWind = dayData.winds.reduce((a, b) => a + b, 0) / dayData.winds.length;
        
        const conditionCounts = {};
        dayData.conditions.forEach(cond => {
            conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
        });
        const mostCommonCondition = Object.keys(conditionCounts).reduce((a, b) => 
            conditionCounts[a] > conditionCounts[b] ? a : b
        );
        
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
            humidity: `${Math.round(dayData.temps.length > 0 ? 75 : 70)}%`, 
            icon: getWeatherIcon(mostCommonCondition)
        });
    });
    
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
            humidity: '--%',
            icon: 'question'
        });
    }
    
    return dailyForecast;
}

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
