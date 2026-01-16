let currentLat = null;
let currentLon = null;

function showLoading() {
    document.getElementById('loadingScreen').classList.add('active');
}


function hideLoading() {
    document.getElementById('loadingScreen').classList.remove('active');
}


function getCurrentLocation() {
    showLoading();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;

                hideLoading();
                showToast('Location detected successfully!', 'success');
            },
            (error) => {
                hideLoading();
                let errorMessage = 'Unable to retrieve your location please make sure eircode is spelt correctly';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                }

                showToast(errorMessage, 'error');
            }
        );
    } else {
        hideLoading();
        showToast('Geolocation is not supported by your browser, try chrome or brave.', 'error');
    }
}


async function checkConditions() {
    let lat = currentLat;
    let lon = currentLon;

    const eircodeInput = document.getElementById('eircode');
    const eircode = eircodeInput ? eircodeInput.value.trim() : '';

 
    if ((!lat || !lon) && eircode) {
        try {
            showLoading();

            const geoRes = await fetch(`/api/geocode?eircode=${encodeURIComponent(eircode)}`);
            const geoData = await geoRes.json();

            if (!geoRes.ok) {
                throw new Error(geoData.error || 'Invalid Eircode-make sure your eircode is correct');
            }

            lat = geoData.location.lat;
            lon = geoData.location.lng;

            currentLat = lat;
            currentLon = lon;
        } catch (err) {
            hideLoading();
            showToast(err.message, 'error');
            return;
        }
    }

    if (!lat || !lon) {
        showToast('Please enter an Eircode or use your current location.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || 'Weather service error try again later');
        }

        displayResults(data);

    } catch (error) {
        console.error('Error fetching data:', error);
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
        document.getElementById('resultsContainer').style.display = 'none';
        return;
    }

    hideLoading();
}


function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultStatus = document.getElementById('resultStatus');
    const resultMessage = document.getElementById('resultMessage');
    const reasonsList = document.getElementById('reasonsList');
    const weatherInfo = document.getElementById('weatherInfo');
    
  
    resultsContainer.style.display = 'block';
    
    
    const isGoodTime = data.result.includes("GOOD") || data.result.includes("EXCELLENT") || data.result.includes("MODERATELY GOOD");
    const isCritical = data.result.includes("BAD") || data.result.includes("RISKY");
    
    resultStatus.textContent = isCritical ? "Not Recommended" : "Recommended";
    resultStatus.className = `status-badge ${isCritical ? 'bad' : 'good'}`;
    
    
    if (data.result.includes("EXCELLENT")) {
        resultMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success-green); margin-right: 10px;"></i>
            <strong>Excellent conditions detected!</strong> This is an ideal time to spread slurry. 
            All environmental factors are optimal for maximum nutrient absorption and minimal environmental impact.
        `;
        resultMessage.style.background = 'rgba(39, 174, 96, 0.1)';
        resultMessage.style.borderLeft = '4px solid var(--success-green)';
    } else if (data.result.includes("GOOD")) {
        resultMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success-green); margin-right: 10px;"></i>
            <strong>Good conditions detected!</strong> This is a suitable time to spread slurry. 
            Most environmental factors are favorable for effective slurry application.
        `;
        resultMessage.style.background = 'rgba(39, 174, 96, 0.1)';
        resultMessage.style.borderLeft = '4px solid var(--success-green)';
    } else if (data.result.includes("MODERATELY GOOD")) {
        resultMessage.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: #f39c12; margin-right: 10px;"></i>
            <strong>Moderate conditions detected.</strong> You can spread slurry with caution. 
            Some factors require attention, but overall conditions are acceptable.
        `;
        resultMessage.style.background = 'rgba(243, 156, 18, 0.1)';
        resultMessage.style.borderLeft = '4px solid #f39c12';
    } else if (data.result.includes("RISKY")) {
        resultMessage.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #e67e22; margin-right: 10px;"></i>
            <strong>Risky conditions detected.</strong> Consider postponing slurry spreading. 
            Multiple risk factors increase the chance of environmental impact or reduced effectiveness.
        `;
        resultMessage.style.background = 'rgba(230, 126, 34, 0.1)';
        resultMessage.style.borderLeft = '4px solid #e67e22';
    } else {
        
        resultMessage.innerHTML = `
            <i class="fas fa-times-circle" style="color: var(--warning-red); margin-right: 10px;"></i>
            <strong>Unfavorable conditions detected.</strong> It is not recommended to spread slurry at this time. 
            Environmental factors pose significant risks for runoff, nutrient loss, or environmental impact.
        `;
        resultMessage.style.background = 'rgba(231, 76, 60, 0.1)';
        resultMessage.style.borderLeft = '4px solid var(--warning-red)';
    }
    
  
    reasonsList.innerHTML = '';
    if (data.reasons && data.reasons.length > 0) {
        data.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-arrow-right" style="margin-right: 10px; color: var(--light-green);"></i>${reason}`;
            reasonsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-arrow-right" style="margin-right: 10px; color: var(--light-green);"></i>Analysis based on current weather conditions`;
        reasonsList.appendChild(li);
    }
    
    
    weatherInfo.innerHTML = '';
    if (data.forecast && data.forecast.length > 0) {
        data.forecast.forEach(day => {
            const weatherCard = document.createElement('div');
            weatherCard.className = 'weather-card';
            
           
            const iconMap = {
                'sun': 'fas fa-sun',
                'cloud': 'fas fa-cloud',
                'cloud-rain': 'fas fa-cloud-rain',
                'bolt': 'fas fa-bolt',
                'snowflake': 'fas fa-snowflake',
                'smog': 'fas fa-smog',
                'wind': 'fas fa-wind',
                'tornado': 'fas fa-tornado',
                'question': 'fas fa-question'
            };
            
            const iconClass = iconMap[day.icon] || iconMap['question'];
            
            weatherCard.innerHTML = `
                <div class="day">${day.day}</div>
                <div class="date">${day.date}</div>
                <div class="weather-icon"><i class="${iconClass}"></i></div>
                <div class="temp">${day.temp}</div>
                <div class="temp-range">${day.tempRange}</div>
                <div class="conditions">${day.conditions}</div>
                <div class="details">
                    <span><i class="fas fa-cloud-rain"></i> ${day.rain}</span>
                    <span><i class="fas fa-wind"></i> ${day.wind}</span>
                    <span><i class="fas fa-tint"></i> ${day.humidity}</span>
                </div>
            `;
            weatherInfo.appendChild(weatherCard);
        });
    } else {
       
        const noDataCard = document.createElement('div');
        noDataCard.className = 'weather-card no-data';
        noDataCard.innerHTML = `
            <div class="day">Weather Data</div>
            <div class="temp"><i class="fas fa-cloud-question"></i></div>
            <div class="conditions">No forecast available</div>
            <div class="details">Check your coordinates and try again</div>
        `;
        weatherInfo.appendChild(noDataCard);
    }
    
   
    if (data.metadata && data.metadata.location) {
        const locationInfo = document.createElement('div');
        locationInfo.className = 'location-info';
        locationInfo.innerHTML = `
            <hr style="margin: 20px 0; border-color: rgba(0,0,0,0.1);">
            <div style="font-size: 0.9rem; color: var(--text-light);">
                <i class="fas fa-map-marker-alt" style="margin-right: 5px;"></i>
                Location: ${data.metadata.location.name} (${data.metadata.location.lat.toFixed(4)}, ${data.metadata.location.lon.toFixed(4)})
                <br>
                <small>Analysis performed at ${new Date(data.metadata.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
            </div>
        `;
        document.querySelector('.recommendation-content').appendChild(locationInfo);
    }
    
    
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    
    showToast('Analysis complete! Recommendations ready.', 'success');
    
    
    hideLoading();
}


function showToast(message, type = 'info') {
   
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
   
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? 'var(--success-green)' : 
                     type === 'error' ? 'var(--warning-red)' : 
                     type === 'warning' ? '#f39c12' : '#3498db'};
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        box-shadow: var(--shadow-heavy);
        animation: slideIn 0.3s ease;
        max-width: 350px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(toast);
    
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}


if (!document.querySelector('#toast-styles')) {
    const toastStyles = document.createElement('style');
    toastStyles.id = 'toast-styles';
    toastStyles.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .weather-card.no-data {
            opacity: 0.7;
            grid-column: 1 / -1;
            text-align: center;
            padding: 30px;
        }
        
        .weather-card.no-data .temp {
            font-size: 3rem;
            margin: 15px 0;
        }
        
        .weather-icon {
            font-size: 2rem;
            margin: 10px 0;
            color: var(--sky-blue);
        }
        
        .temp-range {
            font-size: 0.85rem;
            color: var(--text-light);
            margin-bottom: 8px;
        }
        
        .date {
            font-size: 0.8rem;
            color: var(--text-light);
            margin-bottom: 5px;
        }
        
        .location-info {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(toastStyles);
}


document.getElementById('lat').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkConditions();
    }
});

document.getElementById('lon').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkConditions();
    }
});


document.getElementById('lat').addEventListener('input', function(e) {
    const value = parseFloat(e.target.value);
    if (value < -90 || value > 90) {
        this.style.borderColor = 'var(--warning-red)';
        this.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.1)';
    } else {
        this.style.borderColor = '#e0e6ed';
        this.style.boxShadow = 'none';
    }
});

document.getElementById('lon').addEventListener('input', function(e) {
    const value = parseFloat(e.target.value);
    if (value < -180 || value > 180) {
        this.style.borderColor = 'var(--warning-red)';
        this.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.1)';
    } else {
        this.style.borderColor = '#e0e6ed';
        this.style.boxShadow = 'none';
    }
});


window.addEventListener('DOMContentLoaded', () => {
   
  
    
    
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
        
       
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.7);
                transform: scale(0);
                animation: ripple 0.6s linear;
                width: ${size}px;
                height: ${size}px;
                top: ${y}px;
                left: ${x}px;
                pointer-events: none;
            `;
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
   
    if (!document.querySelector('#ripple-styles')) {
        const rippleStyles = document.createElement('style');
        rippleStyles.id = 'ripple-styles';
        rippleStyles.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            button {
                position: relative;
                overflow: hidden;
            }
        `;
        document.head.appendChild(rippleStyles);
    }
    
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateY(-2px)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateY(0)';
        });
    });
});


document.addEventListener('click', function(e) {
    if (e.target.closest('.share-btn')) {
        const resultText = document.getElementById('resultMessage').textContent;
        const location = `${document.getElementById('lat').value}, ${document.getElementById('lon').value}`;
        
        const shareData = {
            title: 'Slurry Spreading Recommendation',
            text: `Slurry Spreading Analysis for ${location}: ${resultText}`,
            url: window.location.href
        };
        
        if (navigator.share) {
            navigator.share(shareData)
                .then(() => showToast('Report shared successfully!', 'success'))
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        showToast('Could not share report. You can copy the details manually.', 'warning');
                    }
                });
        } else {
            
            const textToCopy = `Slurry Spreading Recommendation\nLocation: ${location}\nResult: ${resultText}\n\nGenerated by Eco-Spread Advisor`;
            
            navigator.clipboard.writeText(textToCopy)
                .then(() => showToast('Report copied to clipboard!', 'success'))
                .catch(() => showToast('Could not copy to clipboard.', 'error'));
        }
    }
    
   
    if (e.target.closest('.schedule-btn')) {
        showToast('Reminder feature coming soon!', 'info');
    }
});
//completed on 16/01/26
//FIX UNDFINED 
