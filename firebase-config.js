// firebase-config.js
// Initialise Firebase pour toute l'app (Auth + Firestore).
// Doit être chargé en <script type="module"> dans chaque page qui en a besoin.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDY-e4C0ib8hXca6nF_8i4_Pa-RhHD3Ngg",
  authDomain: "cat-sitting-86ac2.firebaseapp.com",
  projectId: "cat-sitting-86ac2",
  storageBucket: "cat-sitting-86ac2.firebasestorage.app",
  messagingSenderId: "177180439659",
  appId: "1:177180439659:web:28288338f8104b2404ed2e"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
