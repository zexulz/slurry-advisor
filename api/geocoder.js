// api/geocoder.js
export default async function handler(req, res) {
    const { eircode, lat, lon } = req.query;
    const apiKey = process.env.GEO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key is missing in Vercel settings" });
    }

    let url;
    if (eircode) {
        // Clean the Eircode: Remove spaces and make it uppercase
        const cleanEircode = eircode.replace(/\s+/g, '').toUpperCase();
        // Use 'type=postcode' to force the API to look for the Eircode specifically
        url = `https://api.geoapify.com/v1/geocode/search?text=${cleanEircode}&type=postcode&filter=countrycode:ie&bias=countrycode:ie&apiKey=${apiKey}`;
    } else if (lat && lon) {
        url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const properties = data.features[0].properties;
            const [resultLon, resultLat] = data.features[0].geometry.coordinates;
            
            res.status(200).json({ 
                lat: resultLat, 
                lon: resultLon, 
                eircode: properties.postcode || eircode 
            });
        } else {
            res.status(404).json({ error: "Eircode not found in database" });
        }
    } catch (err) {
        res.status(500).json({ error: "Connection error" });
    }
}
