export default async function handler(req, res) {
    const { eircode } = req.query;
    const apiKey = process.env.GEO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key is missing in Vercel settings" });
    }

    if (!eircode) {
        return res.status(400).json({ error: "No location provided" });
    }

    // This URL is optimized for Ireland. It searches for the text and biases results to IE.
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(eircode)}&filter=countrycode:ie&bias=countrycode:ie&limit=1&apiKey=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const bestMatch = data.features[0];
            const [lon, lat] = bestMatch.geometry.coordinates;
            const address = bestMatch.properties.formatted;
            
            res.status(200).json({ 
                lat: lat, 
                lon: lon, 
                address: address 
            });
        } else {
            res.status(404).json({ error: "Location not found. Try adding the county (e.g. 'Cashel, Tipperary')" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error connecting to map provider" });
    }
}
