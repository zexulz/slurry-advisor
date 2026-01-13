export default async function handler(req, res) {
    const { eircode } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!eircode) return res.status(400).json({ error: "No location provided" });

    // 'components=country:IE' forces the search to stay in Ireland
    // 'region=ie' biases results toward Irish locations
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&components=country:IE&region=ie&key=${apiKey}`;

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
            res.status(404).json({ error: "Location not found. Try your Townland or County instead." });
        } else {
            res.status(500).json({ error: `Google API Error: ${data.status}` });
        }
    } catch (err) {
        res.status(500).json({ error: "Server connection failed" });
    }
}
