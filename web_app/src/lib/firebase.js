import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB97s5J-pvOHiToyokr1HMwZIfwCMQ1A5s",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "asset-master-jwpark.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "asset-master-jwpark",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "asset-master-jwpark.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "815700546936",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:815700546936:web:92f35bb098cfe39562648d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
