export default async function handler(req, res) {
  const lat = req.query.lat;
  const lon = req.query.lon;

  const apiKey = process.env.WEATHER_KEY;

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
  );

  const data = await response.json();

  let rain = data.list[0].rain?.["3h"] || 0;
  let wind = data.list[0].wind.speed * 3.6;

  let result = "GOOD TIME TO SPREAD SLURRY";
  let reasons = [];

  if (rain > 5) {
    result = "BAD TIME TO SPREAD SLURRY";
    reasons.push("High rainfall increases runoff risk");
  }

  if (wind > 15) {
    result = "BAD TIME TO SPREAD SLURRY";
    reasons.push("High wind causes nutrient loss");
  }

  res.status(200).json({ result, reasons });
}
