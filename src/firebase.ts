// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ESTES DADOS SÃO INDIVIDUAIS - COPIA DA TUA CONSOLA FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBwZSP9g7kJb_djqx_1-tHdtgO3XLChm6E",
  authDomain: "vizinhomais.firebaseapp.com",
  projectId: "vizinhomais",
  storageBucket: "vizinhomais.firebasestorage.app",
  messagingSenderId: "626292460867",
  appId: "1:626292460867:web:4d18ab05ebb88c4bbcf3f6",
  measurementId: "G-GZ2H4YW2Q4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);