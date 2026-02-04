// Add this to your firebase.js file temporarily to debug

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log("🔥 Firebase Config:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };

// Debug: Check authentication and Firestore user document
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("👤 Logged in as:", user.email);
    console.log("👤 User UID:", user.uid);
    
    // Try to fetch the user document from Firestore
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        console.log("✅ User document found:", userDoc.data());
        console.log("✅ User role:", userDoc.data().role);
      } else {
        console.error("❌ No user document found for UID:", user.uid);
        console.log("💡 You need to create a document in Firestore:");
        console.log(`   Collection: users`);
        console.log(`   Document ID: ${user.uid}`);
        console.log(`   Fields: { role: "admin", email: "${user.email}" }`);
      }
    } catch (error) {
      console.error("❌ Error fetching user document:", error.message);
    }
  } else {
    console.log("👤 Not logged in");
  }
});

export default app;