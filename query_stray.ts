import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d");

async function run() {
  const targetId = "qF9rA2hnBwRt18nitF8l7Vl0VtF3";
  console.log("Checking strays...");
  
  // 1. Check if it's a doc ID
  let d = await getDoc(doc(db, "strays", targetId));
  if (d.exists()) {
    console.log("Found stray by docId:", d.data());
  }
  
  // 2. Check if it's a submissionId
  let q = query(collection(db, "strays"), where("submissionId", "==", targetId));
  let snap = await getDocs(q);
  snap.forEach(doc => console.log("Found stray by submissionId:", doc.id, doc.data()));
  
  // 3. Check submittedBy
  let q2 = query(collection(db, "strays"), where("submittedBy", "==", targetId));
  let snap2 = await getDocs(q2);
  snap2.forEach(doc => {
      if (doc.data().status === "under_review") {
          console.log("Found stuck stray for user:", doc.id, doc.data().status, doc.data().submissionId);
      }
  });

  console.log("Checking check_ins...");
  // 1. check_in doc ID
  let d3 = await getDoc(doc(db, "check_ins", targetId));
  if (d3.exists()) {
    console.log("Found check_in by docId:", d3.data());
  }

  // 2. check_in submissionId
  let q4 = query(collection(db, "check_ins"), where("submissionId", "==", targetId));
  let snap4 = await getDocs(q4);
  snap4.forEach(doc => console.log("Found check_in by submissionId:", doc.id, doc.data()));

  // 3. check_in submittedBy
  let q5 = query(collection(db, "check_ins"), where("submittedBy", "==", targetId));
  let snap5 = await getDocs(q5);
  snap5.forEach(doc => {
      if (doc.data().status === "under_review") {
          console.log("Found stuck check_in for user:", doc.id, doc.data().status, doc.data().submissionId);
      }
  });

  process.exit(0);
}
run().catch(console.error);
