function showLoading() { document.getElementById('loadingScreen').classList.add('active'); }
function hideLoading() { document.getElementById('loadingScreen').classList.remove('active'); }

async function handleEircodeSearch() {
    const eircode = document.getElementById('eircode-input').value.trim();
    if (!eircode) {
        showToast('Please enter an Eircode.', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/api/get-coords?eircode=${encodeURIComponent(eircode)}`);
        const coords = await response.json();

        if (response.ok) {
            document.getElementById('lat').value = coords.lat;
            document.getElementById('lon').value = coords.lng;
            // Now that we have coords, call your existing analysis function
            checkConditions();
        } else {
            hideLoading();
            showToast('Eircode not found.', 'error');
        }
    } catch (err) {
        hideLoading();
        showToast('Connection error.', 'error');
    }
}

async function checkConditions() {
    const lat = document.getElementById('lat').value;
    const lon = document.getElementById('lon').value;

    try {
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        hideLoading();
        showToast('Weather analysis failed.', 'error');
    }
}

function displayResults(data) {
    hideLoading();
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.style.display = 'block';
    
    document.getElementById('resultStatus').textContent = data.result.includes("BAD") ? "Not Recommended" : "Recommended";
    document.getElementById('resultStatus').className = `status-badge ${data.result.includes("BAD") ? 'bad' : 'good'}`;
    document.getElementById('resultMessage').innerHTML = `<strong>Outcome:</strong> ${data.result}`;
    
    // Smooth scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

function getCurrentLocation() {
    showLoading();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            document.getElementById('lat').value = pos.coords.latitude;
            document.getElementById('lon').value = pos.coords.longitude;
            checkConditions();
        }, () => {
            hideLoading();
            showToast('GPS access denied.', 'error');
        });
    }
}

function showToast(msg, type) {
    alert(msg); // You can replace this with your custom toast HTML from the CSS
}

// Support Enter Key
document.getElementById('eircode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleEircodeSearch();
});
