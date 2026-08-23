import fetch from "node-fetch";

async function run() {
  console.log("Triggering server submit...");
  const res = await fetch("http://localhost:3000/api/submit-for-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "test_" + Date.now(),
      type: "sighting",
      details: { name: "Test Sighting" },
      imageBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    })
  });
  console.log(await res.text());
}
run();
