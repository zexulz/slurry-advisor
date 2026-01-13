export default async function handler(req, res) {
    const { eircode } = req.query;

    if (!eircode) {
        return res.status(400).json({ error: "Missing eircode" });
    }

    try {
        const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json` +
            `?q=${encodeURIComponent(eircode)}` +
            `&countrycode=ie` +
            `&key=${process.env.OPENCAGE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error("OpenCage request failed");
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({ error: "Invalid Eircode" });
        }

        const location = data.results[0].geometry;

        return res.status(200).json({
            lat: location.lat,
            lon: location.lng
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Geocoding failed" });
    }
}
