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
                document.getElementById('lat').value = position.coords.latitude.toFixed(4);
                document.getElementById('lon').value = position.coords.longitude.toFixed(4);
                hideLoading();
                showToast('Location detected successfully!', 'success');
            },
            () => {
                hideLoading();
                showToast('Unable to retrieve your location.', 'error');
            }
        );
    } else {
        hideLoading();
        showToast('Geolocation is not supported by your browser.', 'error');
    }
}

/* =========================
   EIRCODE → COORDINATES
========================= */
async function geocodeEircode(eircode) {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(eircode + ", Ireland")}`
    );

    const data = await response.json();

    if (!data || data.length === 0) {
        throw new Error('Invalid Eircode');
    }

    return {
        lat: data[0].lat,
        lon: data[0].lon
    };
}

async function checkConditions() {
    let lat = document.getElementById('lat').value;
    let lon = document.getElementById('lon').value;
    const eircodeInput = document.getElementById('eircode');
    const eircode = eircodeInput ? eircodeInput.value.trim() : '';

    // If Eircode is provided and coordinates are empty → convert
    if (eircode && (!lat || !lon)) {
        try {
            showLoading();
            const coords = await geocodeEircode(eircode);
            lat = coords.lat;
            lon = coords.lon;

            document.getElementById('lat').value = parseFloat(lat).toFixed(4);
            document.getElementById('lon').value = parseFloat(lon).toFixed(4);

            showToast('Eircode located successfully!', 'success');
        } catch (err) {
            hideLoading();
            showToast('Invalid Eircode. Please try again.', 'error');
            return;
        }
    }

    if (!lat || !lon) {
        showToast('Please enter coordinates or an Eircode.', 'error');
        return;
    }

    if (isNaN(lat) || isNaN(lon)) {
        showToast('Invalid coordinates.', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        hideLoading();
        showToast('Failed to fetch weather data.', 'error');
    }
}

function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.style.display = 'block';
    hideLoading();
    showToast('Analysis complete!', 'success');
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        z-index: 9999;
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

/* ENTER KEY SUPPORT */
document.getElementById('lat').addEventListener('keypress', e => {
    if (e.key === 'Enter') checkConditions();
});

document.getElementById('lon').addEventListener('keypress', e => {
    if (e.key === 'Enter') checkConditions();
});