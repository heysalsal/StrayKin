import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const strays = await getDocs(collection(db, "strays"));
  strays.forEach(doc => {
      const d = doc.data();
      console.log(`Stray ${doc.id}: status=${d.status}, submissionId=${d.submissionId}, submittedBy=${d.submittedBy}`);
  });
  
  const checkins = await getDocs(collection(db, "check_ins"));
  checkins.forEach(doc => {
      const d = doc.data();
      console.log(`Checkin ${doc.id}: status=${d.status}, submissionId=${d.submissionId}, submittedBy=${d.submittedBy}`);
  });
}
run().then(() => process.exit(0)).catch(console.error);
