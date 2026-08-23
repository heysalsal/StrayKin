import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/submit-for-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "sighting_1787482536313",
      type: "sighting",
      docIdForReview: "ZBpeuGBW7DvnqfEzMdMj",
      details: {
        animalType: "Cat",
        catId: "ZBpeuGBW7DvnqfEzMdMj",
        name: "Bersih sehat"
      }
    })
  });
  console.log(await res.text());
}
run();
