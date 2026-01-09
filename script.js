async function check() {
  const lat = document.getElementById("lat").value;
  const lon = document.getElementById("lon").value;

  const response = await fetch(`/api/check?lat=${lat}&lon=${lon}`);
  const data = await response.json();

  document.getElementById("result").innerText = data.result;
  document.getElementById("reasons").innerText = data.reasons.join(", ");
}
