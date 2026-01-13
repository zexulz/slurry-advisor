export default async function handler(req, res) {
    const { eircode } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!eircode) return res.status(400).json({ error: "No location provided" });

    // We add 'components=country:IE' to force Google to look in Ireland first
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&components=country:IE&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK") {
            const result = data.results[0];
            const lat = result.geometry.location.lat;
            const lon = result.geometry.location.lng;
            const address = result.formatted_address;
            
            res.status(200).json({ lat, lon, address });
        } else if (data.status === "ZERO_RESULTS") {
            res.status(404).json({ error: "Eircode not found. Check the spelling or try your Townland." });
        } else {
            res.status(500).json({ error: "Google API error: " + data.status });
        }
    } catch (err) {
        res.status(500).json({ error: "Connection error" });
    }
}
