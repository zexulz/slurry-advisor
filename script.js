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
            (error) => {
                hideLoading();
                let errorMessage = 'Unable to retrieve your location. Please enter coordinates manually.';
                showToast(errorMessage, 'error');
            }
        );
    } else {
        hideLoading();
        showToast('Geolocation is not supported by your browser.', 'error');
    }
}

/* =========================
   🆕 EIRCODE → COORDINATES
   Uses OpenStreetMap (FREE)
========================= */
async function geocodeEircode(eircode) {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(eircode + ", Ireland")}`
    );

    const results = await response.json();

    if (!results || results.length === 0) {
        throw new Error('Invalid Eircode');
    }

    return {
        lat: results[0].lat,
        lon: results[0].lon
    };
}

async function checkConditions() {
    let lat = document.getElementById('lat').value;
    let lon = document.getElementById('lon').value;

    // 🆕 Read Eircode input
    const eircode = document.getElementById('eircode')?.value.trim();

    // 🆕 If Eircode is entered, convert it to coordinates
    if (eircode && (!lat || !lon)) {
        try {
            showLoading();
            const coords = await geocodeEircode(eircode);
            lat = coords.lat;
            lon = coords.lon;

            // 🆕 Populate coordinate fields (visual feedback)
            document.getElementById('lat').value = parseFloat(lat).toFixed(4);
            document.getElementById('lon').value = parseFloat(lon).toFixed(4);

            showToast('Eircode located successfully!', 'success');
        } catch (error) {
            hideLoading();
            showToast('Invalid Eircode. Please check and try again.', 'error');
            return;
        }
    }

    // Existing validation (UNCHANGED)
    if (!lat || !lon) {
        showToast('Please enter coordinates or an Eircode.', 'error');
        return;
    }

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        showToast('Please enter valid coordinates.', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
        document.getElementById('resultsContainer').style.display = 'none';
    }
}

/* ===== EVERYTHING BELOW IS UNCHANGED ===== */

function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.style.display = 'block';
    hideLoading();
    showToast('Analysis complete! Recommendations ready.', 'success');
}

function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}