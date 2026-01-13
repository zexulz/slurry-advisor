export default async function handler(req, res) {
  const { eircode } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!eircode) {
    return res.status(400).json({ error: 'Eircode is required' });
  }

  // Adding ", Ireland" ensures the Geocoder prioritizes Irish addresses
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode + ', Ireland')}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      const location = data.results[0].geometry.location;
      // Returns { lat: 53.xxx, lng: -7.xxx }
      return res.status(200).json(location);
    } else {
      return res.status(400).json({ error: 'Invalid Eircode' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
