import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore/lite";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB97s5J-pvOHiToyokr1HMwZIfwCMQ1A5s",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "asset-master-jwpark.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "asset-master-jwpark",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
async function test() {
  try {
    const col = collection(db, 'test');
    await addDoc(col, { test: 1 });
    console.log("Success add");
    const snapshot = await getDocs(col);
    console.log("Docs len", snapshot.docs.length);
  } catch(e) { console.error(e); }
}
test();
