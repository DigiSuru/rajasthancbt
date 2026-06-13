import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
export const isLocalMode = !firebaseConfigStr; 

const firebaseConfig = firebaseConfigStr ? JSON.parse(firebaseConfigStr) : {
  apiKey: "mock-key",
  authDomain: "mock-domain",
  projectId: "mock-project",
  storageBucket: "mock-bucket",
  messagingSenderId: "mock-sender",
  appId: "mock-app"
};

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'rpsc-rssb-spa-app';
export const safeAppId = rawAppId.replace(/\//g, '-');

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exporting necessary firebase functions for components
export { signInWithCustomToken, signInAnonymously, onAuthStateChanged, collection, addDoc, onSnapshot };
