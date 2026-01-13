// api/geocoder.js
export default async function handler(req, res) {
    const { eircode } = req.query;
    const apiKey = process.env.GEO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key missing" });
    }

    // Clean the Eircode: D02 XN52 -> D02XN52
    const cleanEircode = eircode.replace(/\s+/g, '').toUpperCase();

    // We use a "search" instead of a strict "postcode" lookup
    // This is much more reliable for Irish Eircodes
    const url = `https://api.geoapify.com/v1/geocode/search?text=${cleanEircode},Ireland&apiKey=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Check if we got any results
        if (data.features && data.features.length > 0) {
            // Take the best match
            const bestMatch = data.features[0];
            const [lon, lat] = bestMatch.geometry.coordinates;
            
            res.status(200).json({ 
                lat: lat, 
                lon: lon, 
                eircode: cleanEircode 
            });
        } else {
            res.status(404).json({ error: "Eircode not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server connection error" });
    }
}
