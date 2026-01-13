function showLoading() { document.getElementById('loadingScreen').classList.add('active'); }
function hideLoading() { document.getElementById('loadingScreen').classList.remove('active'); }

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    // Inline styling to ensure visibility regardless of CSS issues
    toast.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: ${type === 'error' ? '#e74c3c' : '#27ae60'}; color: white; border-radius: 12px; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: bold;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 4000);
}

async function checkConditions() {
    const input = document.getElementById('locationInput').value.trim();
    if (!input) {
        showToast("Please enter an Eircode or Area", "error");
        return;
    }

    showLoading();

    try {
        // Step 1: Get Lat/Lon from Google
        const geoRes = await fetch(`/api/geocoder?eircode=${encodeURIComponent(input)}`);
        const geoData = await geoRes.json();

        if (!geoRes.ok) {
            throw new Error(geoData.error || "Location lookup failed");
        }

        // Step 2: Get Slurry Recommendation
        const checkRes = await fetch(`/api/check?lat=${geoData.lat}&lon=${geoData.lon}`);
        if (!checkRes.ok) throw new Error("Could not fetch weather data");
        
        const data = await checkRes.json();
        
        displayResults(data);
        showToast(`Success: Found ${geoData.address}`, "success");

    } catch (err) {
        showToast(err.message, "error");
    } finally {
        hideLoading();
    }
}

function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    container.style.display = 'block';

    const isBad = data.result.toUpperCase().includes("BAD") || data.result.toUpperCase().includes("RISKY");
    const statusBadge = document.getElementById('resultStatus');
    
    statusBadge.textContent = isBad ? "NOT RECOMMENDED" : "RECOMMENDED";
    statusBadge.className = `status-badge ${isBad ? 'bad' : 'good'}`;
    
    document.getElementById('resultMessage').innerHTML = `<strong>Status:</strong> ${data.result}`;

    const list = document.getElementById('reasonsList');
    list.innerHTML = '';
    data.reasons.forEach(r => {
        const li = document.createElement('li');
        li.innerText = r;
        list.appendChild(li);
    });

    const weather = document.getElementById('weatherInfo');
    weather.innerHTML = '';
    data.forecast.forEach(f => {
        const card = document.createElement('div');
        card.className = 'weather-card';
        card.innerHTML = `<strong>${f.day}</strong><br>${f.temp}<br>${f.conditions}`;
        weather.appendChild(card);
    });

    container.scrollIntoView({ behavior: 'smooth' });
}
