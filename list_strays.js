import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(config);
const dbId = "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d";
const db = getFirestore(firebaseApp, dbId);

async function run() {
    const snap = await getDocs(collection(db, "strays"));
    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Stray ${doc.id}: status=${data.status}, name=${data.name}`);
    });
    process.exit(0);
}
run();
