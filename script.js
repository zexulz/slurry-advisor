// --- UI HELPERS ---
function showLoading() {
    document.getElementById('loadingScreen').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.remove('active');
}

// --- LOCATION LOGIC ---

// Gets GPS Coords and then asks our Vercel API for the matching Eircode
function getCurrentLocation() {
    showLoading();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                try {
                    // Reverse geocode via our serverless function to get the Eircode
                    const response = await fetch(`/api/geocoder?lat=${lat}&lon=${lon}`);
                    const data = await response.json();
                    
                    document.getElementById('lat').value = lat;
                    document.getElementById('lon').value = lon;
                    if (data.eircode) {
                        document.getElementById('eircode').value = data.eircode;
                    }
                    
                    hideLoading();
                    showToast('Location detected successfully!', 'success');
                } catch (err) {
                    // Fallback: still use the coords even if Eircode lookup fails
                    document.getElementById('lat').value = lat;
                    document.getElementById('lon').value = lon;
                    hideLoading();
                    showToast('Location found (Eircode lookup unavailable)', 'info');
                }
            },
            (error) => {
                hideLoading();
                showToast('Unable to get GPS. Please enter Eircode manually.', 'error');
            }
        );
    } else {
        hideLoading();
        showToast('Geolocation is not supported by your browser.', 'error');
    }
}

// Main logic: Eircode -> Coords -> Slurry Analysis
async function checkConditions() {
    const eircode = document.getElementById('eircode').value.trim();
    
    if (!eircode) {
        showToast('Please enter an Eircode first.', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Step 1: Convert Eircode to Coordinates via Vercel
        const geoResponse = await fetch(`/api/geocoder?eircode=${encodeURIComponent(eircode)}`);
        const geoData = await geoResponse.json();

        if (geoData.error) {
            throw new Error("Invalid Eircode. Please check and try again.");
        }

        const lat = geoData.lat;
        const lon = geoData.lon;

        // Step 2: Send Coords to your existing check API
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        displayResults(data);
        
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
        document.getElementById('resultsContainer').style.display = 'none';
    }
}

// --- DISPLAY LOGIC ---
function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultStatus = document.getElementById('resultStatus');
    const resultMessage = document.getElementById('resultMessage');
    const reasonsList = document.getElementById('reasonsList');
    const weatherInfo = document.getElementById('weatherInfo');
    
    resultsContainer.style.display = 'block';
    
    const isCritical = data.result.includes("BAD") || data.result.includes("RISKY");
    resultStatus.textContent = isCritical ? "Not Recommended" : "Recommended";
    resultStatus.className = `status-badge ${isCritical ? 'bad' : 'good'}`;
    
    // Set Message Content
    let icon = isCritical ? "fa-times-circle" : "fa-check-circle";
    let color = isCritical ? "var(--warning-red)" : "var(--success-green)";
    
    resultMessage.innerHTML = `
        <i class="fas ${icon}" style="color: ${color}; margin-right: 10px;"></i>
        <strong>${data.result} conditions!</strong> Analysis suggests this is a ${isCritical ? 'poor' : 'good'} time to spread.
    `;

    // Clear and fill reasons
    reasonsList.innerHTML = '';
    data.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-arrow-right" style="margin-right: 10px; color: var(--light-green);"></i>${reason}`;
        reasonsList.appendChild(li);
    });
    
    // Clear and fill weather cards
    weatherInfo.innerHTML = '';
    data.forecast.forEach(day => {
        const card = document.createElement('div');
        card.className = 'weather-card';
        card.innerHTML = `
            <div class="day">${day.day}</div>
            <div class="temp">${day.temp}</div>
            <div class="conditions">${day.conditions}</div>
        `;
        weatherInfo.appendChild(card);
    });
    
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
    hideLoading();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px; background: #333; color: #fff; border-radius: 8px; z-index: 10000;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Initial Listener
document.getElementById('eircode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkConditions();
});
