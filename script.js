// --- HELPERS ---
function showLoading() { document.getElementById('loadingScreen').classList.add('active'); }
function hideLoading() { document.getElementById('loadingScreen').classList.remove('active'); }

function showToast(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: ${type === 'error' ? '#e74c3c' : '#27ae60'}; color: white; border-radius: 12px; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- MAIN FUNCTION ---
async function checkConditions() {
    const userInput = document.getElementById('locationInput').value.trim();
    console.log("Button clicked. Input:", userInput);
    
    if (!userInput) {
        showToast('Please enter an Eircode or Area', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // 1. Get Coordinates from your Google API
        console.log("Calling Geocoder...");
        const geoResponse = await fetch(`/api/geocoder?eircode=${encodeURIComponent(userInput)}`);
        
        if (!geoResponse.ok) {
            const errData = await geoResponse.json();
            throw new Error(errData.error || "Location not found");
        }
        
        const geoData = await geoResponse.json();
        console.log("Location Found:", geoData);

        // 2. Call your existing Slurry API
        const response = await fetch(`/api/check?lat=${geoData.lat}&lon=${geoData.lon}`);
        if (!response.ok) throw new Error("Weather service busy. Try again.");
        
        const data = await response.json();
        displayResults(data);
        showToast(`Located: ${geoData.address}`, 'success');
        
    } catch (error) {
        console.error("Process Error:", error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- DISPLAY RESULTS ---
function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    container.style.display = 'block';
    
    const isBad = data.result.includes("BAD") || data.result.includes("RISKY");
    const status = document.getElementById('resultStatus');
    status.textContent = isBad ? "NOT RECOMMENDED" : "GOOD TO SPREAD";
    status.className = `status-badge ${isBad ? 'bad' : 'good'}`;
    
    document.getElementById('resultMessage').innerHTML = `<strong>Result:</strong> ${data.result}`;
    
    const list = document.getElementById('reasonsList');
    list.innerHTML = '';
    data.reasons.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-check"></i> ${r}`;
        list.appendChild(li);
    });
    
    const weather = document.getElementById('weatherInfo');
    weather.innerHTML = '';
    data.forecast.slice(0, 3).forEach(day => {
        const card = document.createElement('div');
        card.className = 'weather-card';
        card.innerHTML = `<div class="day">${day.day}</div><div class="temp">${day.temp}</div><div class="conditions">${day.conditions}</div>`;
        weather.appendChild(card);
    });
    
    container.scrollIntoView({ behavior: 'smooth' });
}
