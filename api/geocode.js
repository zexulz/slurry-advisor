export default async function handler(req, res) {
  const { eircode } = req.query;

  if (!eircode) {
    return res.status(400).json({ error: "Missing Eircode" });
  }

  try {
    const apiKey = process.env.GOOGLE_GEOCODE_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results.length) {
      return res.status(404).json({ error: "Location not found" });
    }

    const location = data.results[0].geometry.location;

    res.status(200).json({ location });
  } catch (err) {
    res.status(500).json({ error: "Geocoding failed", details: err.message });
  }
}

