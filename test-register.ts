import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
     const cred = await createUserWithEmailAndPassword(auth, "test.new1122@example.com", "password123");
     console.log("Registered in:", cred.user.uid);
     await setDoc(doc(db, "users", cred.user.uid), {
       uid: cred.user.uid,
       email: cred.user.email,
       test: true,
     }, { merge: true });
     console.log("Write success!");
     process.exit(0);
  } catch (err: any) {
     console.error("Auth or Write failed:", err.message);
     process.exit(1);
  }
}
test();
