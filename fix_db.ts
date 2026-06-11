import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function fix() {
  const straysQ = query(collection(db, "strays"), where("status", "==", "under_review"));
  const snap = await getDocs(straysQ);
  console.log(`Found ${snap.docs.length} under_review strays`);
  for (const ds of snap.docs) {
    if (!ds.data().submissionId) {
      console.log(`Fixing stuck stray: ${ds.id}`);
      await updateDoc(ds.ref, { status: "approved" });
    }
  }

  const checkinsQ = query(collection(db, "check_ins"), where("status", "==", "under_review"));
  const csnap = await getDocs(checkinsQ);
  console.log(`Found ${csnap.docs.length} under_review check_ins`);
  for (const dc of csnap.docs) {
    if (!dc.data().submissionId) {
      console.log(`Fixing stuck check_in: ${dc.id}`);
      await updateDoc(dc.ref, { status: "approved" });
      if (dc.data().catId) {
        const catRef = doc(db, "strays", dc.data().catId);
        await updateDoc(catRef, { status: "approved" });
      }
    }
  }
  process.exit(0);
}

fix();
