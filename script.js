async function checkConditions() {
    const eircode = document.getElementById('eircode').value.trim();

    if (!eircode) {
        alert('Please enter an Eircode');
        return;
    }

    try {
        // Convert Eircode → lat/lon (server-side)
        const geoRes = await fetch(`/api/geocode?eircode=${encodeURIComponent(eircode)}`);
        if (!geoRes.ok) throw new Error('Invalid Eircode');

        const geo = await geoRes.json();

        // Existing weather logic stays EXACTLY the same
        const weatherRes = await fetch(`/api/check?lat=${geo.lat}&lon=${geo.lon}`);
        const data = await weatherRes.json();

        document.getElementById('resultsContainer').style.display = 'block';
        document.getElementById('resultsContainer').innerHTML = `
            <div class="glass-card">
                <h3>Recommendation</h3>
                <p><strong>Location:</strong> ${data.metadata.location.name}</p>
                <p><strong>Eircode:</strong> ${geo.eircode || 'Not available'}</p>
                <p><strong>Status:</strong> ${data.recommendation.status}</p>
                <p>${data.recommendation.message}</p>
            </div>
        `;

    } catch (err) {
        alert('Unable to fetch data for this Eircode');
        console.error(err);
    }
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
    }

    navigator.geolocation.getCurrentPosition(async position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        const geoRes = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
        const geo = await geoRes.json();

        document.getElementById('eircode').value = geo.eircode || '';
    });
}
