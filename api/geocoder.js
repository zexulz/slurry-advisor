export default async function handler(req, res) {
    // We pull the key from Vercel's environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // This check tells us if Vercel is actually passing the key to the code
    if (!apiKey || apiKey === "") {
        return res.status(500).json({ 
            error: "API Key Missing", 
            details: "The GOOGLE_MAPS_API_KEY is not detected in Vercel environment variables." 
        });
    }

    const { eircode } = req.query;
    if (!eircode) {
        return res.status(400).json({ error: "No location provided" });
    }

    // Google Geocoding URL - Optimized for Ireland
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&components=country:IE&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK") {
            const result = data.results[0];
            res.status(200).json({
                lat: result.geometry.location.lat,
                lon: result.geometry.location.lng,
                address: result.formatted_address
            });
        } else if (data.status === "ZERO_RESULTS") {
            res.status(404).json({ error: "Location not found. Try your Townland or County." });
        } else if (data.status === "REQUEST_DENIED") {
            res.status(403).json({ error: "Google denied the request. Check if Geocoding API is enabled." });
        } else {
            res.status(500).json({ error: "Google API Error: " + data.status });
        }
    } catch (err) {
        res.status(500).json({ error: "Server failed to connect to Google." });
    }
}
