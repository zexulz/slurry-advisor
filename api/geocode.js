export default async function handler(req, res) {
    const { eircode, lat, lon } = req.query;
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

    let url;

    if (eircode) {
        url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&region=ie&key=${apiKey}`;
    } else {
        url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    }

    const r = await fetch(url);
    const d = await r.json();

    if (!d.results?.length) {
        return res.status(404).json({ error: 'Not found' });
    }

    const loc = d.results[0].geometry.location;
    const eir = d.results[0].address_components.find(c =>
        c.types.includes('postal_code')
    )?.long_name;

    res.json({
        lat: loc.lat,
        lon: loc.lng,
        eircode: eir || null
    });
}
