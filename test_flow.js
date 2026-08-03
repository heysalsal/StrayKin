import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(config);
const dbId = "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d";
const db = getFirestore(firebaseApp, dbId);

async function run() {
    const docRef = doc(collection(db, "strays"));
    
    // Listen to changes
    onSnapshot(doc(db, "strays", docRef.id), (snap) => {
        console.log("Snapshot update:", snap.data()?.status);
    });

    console.log("1. Creating as under_review");
    await setDoc(docRef, { status: "under_review", test: true });

    console.log("2. Simulating backend fetch");
    const res = await fetch("http://localhost:3000/api/submit-for-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: `test_${Date.now()}`,
            type: "sighting",
            details: { catId: docRef.id },
            docIdForReview: docRef.id
        })
    });
    const data = await res.json();
    console.log("Backend response:", data);

    console.log("3. Simulating client updateCatSighting");
    await updateDoc(docRef, { status: data.status });
    
    setTimeout(() => {
        console.log("Done");
        process.exit(0);
    }, 2000);
}

run();
