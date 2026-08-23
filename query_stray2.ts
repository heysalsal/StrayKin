import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d");

async function run() {
  const docId = "ZBpeuGBW7DvnqfEzMdMj";
  let d = await getDoc(doc(db, "strays", docId));
  if (d.exists()) {
    console.log("Stray details:", JSON.stringify(d.data(), null, 2));
  }
  process.exit(0);
}
run().catch(console.error);
