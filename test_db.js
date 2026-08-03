import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = initializeApp(config);
    const dbId = "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d";
    const db = getFirestore(firebaseApp, dbId);
    console.log("DB initialized");
    setDoc(doc(db, "strays", "test_doc"), { status: "approved" }, { merge: true })
      .then(() => console.log("Write success"))
      .catch(e => console.error("Write error:", e))
      .finally(() => process.exit(0));
} else {
    console.log("No config");
}
