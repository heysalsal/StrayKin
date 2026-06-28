import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d');

async function list() {
  const querySnapshot = await getDocs(collection(db, 'hubs'));
  querySnapshot.forEach((doc) => {
    console.log(`${doc.id} =>`, doc.data());
  });
  process.exit(0);
}
list();
