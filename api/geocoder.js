export default async function handler(req, res) {
    const { eircode } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "Server Setup Error: API Key missing in Vercel." });

    // This URL searches specifically in Ireland
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
            res.status(404).json({ error: "Eircode not found. Try your Townland/County." });
        } else {
            res.status(500).json({ error: `Google Error: ${data.status}` });
        }
    } catch (err) {
        res.status(500).json({ error: "Network Error" });
    }
}
