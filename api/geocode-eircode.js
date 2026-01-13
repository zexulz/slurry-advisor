export default async function handler(req, res) {
    const { eircode } = req.query;

    if (!eircode) {
        return res.status(400).json({ error: "Missing eircode" });
    }

    try {
        const url =
            "https://api.opencagedata.com/geocode/v1/json" +
            `?q=${encodeURIComponent(eircode)}` +
            "&countrycode=ie" +
            "&limit=1" +
            "&no_annotations=1" +
            "&bounds=51.3,-10.7,55.5,-5.4" + // 🇮🇪 IRELAND BOUNDS
            `&key=${process.env.OPENCAGE_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({ error: "Invalid Eircode" });
        }

        const result = data.results[0];

        // SAFETY CHECK
        if (result.components.country_code !== "ie") {
            return res.status(400).json({ error: "Eircode not in Ireland" });
        }

        return res.status(200).json({
            lat: result.geometry.lat,
            lon: result.geometry.lng
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Geocoding failed" });
    }
}