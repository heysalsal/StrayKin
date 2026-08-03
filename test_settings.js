import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(config);
const dbId = "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d";
const db = getFirestore(firebaseApp, dbId);

async function run() {
    const docRef = doc(db, "settings", "global");
    const snap = await getDoc(docRef);
    console.log("Settings global:", snap.data());
    process.exit(0);
}
run();
