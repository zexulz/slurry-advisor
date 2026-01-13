// api/geocoder.js
export default async function handler(req, res) {
    const { eircode, lat, lon } = req.query;
    const apiKey = process.env.GEO_API_KEY;

    let url;
    // Handle Eircode lookup
    if (eircode) {
        url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(eircode)}&filter=countrycode:ie&apiKey=${apiKey}`;
    } 
    // Handle Reverse Geocode (for the "Use My Location" button)
    else if (lat && lon) {
        url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const feature = data.features[0].properties;
            const [resultLon, resultLat] = data.features[0].geometry.coordinates;
            
            res.status(200).json({ 
                lat: resultLat, 
                lon: resultLon, 
                eircode: feature.postcode || "Detected Location" 
            });
        } else {
            res.status(404).json({ error: "Location not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
}

