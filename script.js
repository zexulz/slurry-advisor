async function checkConditions() {
    const userInput = document.getElementById('locationInput').value.trim();
    
    if (!userInput) {
        showToast('Please enter an Eircode or Townland', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const geoResponse = await fetch(`/api/geocoder?eircode=${encodeURIComponent(userInput)}`);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok) {
            // This triggers if Google returns ZERO_RESULTS
            showToast("Eircode not recognized. Try searching your Townland/County.", "error");
            hideLoading();
            return;
        }

        const { lat, lon, address } = geoData;
        showToast(`Located: ${address}`, 'success');

        const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        
        displayResults(data);
        
    } catch (error) {
        showToast("Connection error. Check your internet.", 'error');
    } finally {
        hideLoading();
    }
}
