// js/firebase-init.js
// Exposes firebase app, auth and firestore utilities for the simple static pages.
// IMPORTANT: replace firebaseConfig with your project's values

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/* ----- REPLACE THIS WITH YOUR FIREBASE CONFIG ----- */
const firebaseConfig = {
  apiKey: "AIzaSyClytrnHKs4AafkKGL6wKJPGAwfjED8P30",
  authDomain: "airavat-e679d.firebaseapp.com",
  databaseURL: "https://airavat-e679d-default-rtdb.firebaseio.com",
  projectId: "airavat-e679d",
  storageBucket: "airavat-e679d.firebasestorage.app",
  messagingSenderId: "402851409523",
  appId: "1:402851409523:web:2c7c16253525aa9546c406",
  measurementId: "G-28V8CGNNKF"
};
/* ------------------------------------------------- */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export what pages will need
export {
  app,
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
};
