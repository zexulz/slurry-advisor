// --- LOADING HELPERS ---
function showLoading() { document.getElementById('loadingScreen').classList.add('active'); }
function hideLoading() { document.getElementById('loadingScreen').classList.remove('active'); }

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: ${type === 'error' ? '#e74c3c' : '#27ae60'}; color: white; border-radius: 12px; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif; font-weight: bold;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- CORE LOGIC ---

async function checkConditions() {
    const userInput = document.getElementById('locationInput').value.trim();
    
    if (!userInput) {
        showToast('Please enter a location or Eircode', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // 1. Get Coordinates from our Vercel API
        const geoResponse = await fetch(`/api/geocoder?eircode=${encodeURIComponent(userInput)}`);
        if (!geoResponse.ok) throw new Error("Location not found. Try adding the county name.");
        
        const geoData = await geoResponse.json();
        const { lat, lon, address } = geoData;

        // 2. Call the Slurry Check API (your existing backend)
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        if (!response.ok) throw new Error("Weather service unavailable.");
        
        const data = await response.json();
        
        // Success!
        showToast(`Located: ${address}`, 'success');
        displayResults(data);
        
    } catch (error) {
        showToast(error.message, 'error');
        document.getElementById('resultsContainer').style.display = 'none';
    } finally {
        hideLoading();
    }
}

function getCurrentLocation() {
    showLoading();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                // Reverse geocode to show the user where they are
                try {
                    const res = await fetch(`/api/geocoder?eircode=${latitude},${longitude}`);
                    const data = await res.json();
                    document.getElementById('locationInput').value = data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    checkConditions(); // Run the check automatically
                } catch (e) {
                    // Fallback if reverse geocode fails
                    const response = await fetch(`/api/check?lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    displayResults(data);
                    hideLoading();
                }
            },
            () => { hideLoading(); showToast("GPS access denied.", "error"); }
        );
    }
}

function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    container.style.display = 'block';
    
    // Status Badge
    const isBad = data.result.includes("BAD") || data.result.includes("RISKY") || data.result.includes("UNFAVORABLE");
    const status = document.getElementById('resultStatus');
    status.textContent = isBad ? "DO NOT SPREAD" : "GOOD TO SPREAD";
    status.className = `status-badge ${isBad ? 'bad' : 'good'}`;
    
    // Message
    document.getElementById('resultMessage').innerHTML = `<strong>Current Condition:</strong> ${data.result}`;
    
    // Reasons
    const list = document.getElementById('reasonsList');
    list.innerHTML = '';
    data.reasons.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-chevron-right"></i> ${r}`;
        list.appendChild(li);
    });
    
    // Weather Cards
    const weather = document.getElementById('weatherInfo');
    weather.innerHTML = '';
    data.forecast.slice(0, 3).forEach(day => {
        const card = document.createElement('div');
        card.className = 'weather-card';
        card.innerHTML = `
            <div class="day">${day.day}</div>
            <div class="temp">${day.temp}</div>
            <div class="conditions">${day.conditions}</div>
        `;
        weather.appendChild(card);
    });
    
    container.scrollIntoView({ behavior: 'smooth' });
}

function shareReport() {
    showToast("Report copied to clipboard!", "success");
}

// Enter Key Support
document.getElementById('locationInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') checkConditions(); });
