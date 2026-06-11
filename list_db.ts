import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function ls() {
  const straysQ = query(collection(db, "check_ins"));
  const snap = await getDocs(straysQ);
  console.log(`Found ${snap.docs.length} check_ins`);
  for (const ds of snap.docs) {
    console.log(ds.id, ds.data().status, ds.data().submissionId);
  }
  process.exit(0);
}

ls();
