import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/submission-status/sighting_1780387241835");
  const data = await res.json();
  console.log(data);
}
run();
