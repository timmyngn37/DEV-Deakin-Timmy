import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, validatePassword, type Auth, type User } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

/**
 * firebase.ts
 * ------------------------------------------------------------------
 * Sets up the Firebase client SDK (Auth + Firestore) for the frontend.
 * ------------------------------------------------------------------
 */

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// True only if the essential config values are present.
const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// `auth`/`db` are nullable by design.
export const auth: Auth | null = firebaseConfigured ? getAuth(firebaseApp) : null;
export const db = firebaseConfigured ? getFirestore(firebaseApp) : null;

// Throws instead of silently no-op'ing when Firebase isn't configured,
// so a misconfigured environment fails loudly at the call site instead
// of producing a confusing downstream error.
function requireAuth() {
  if (!auth) throw new Error("Firebase is not configured");
  return auth;
}

export const createAuthUserWithEmailAndPassword = (email: string, password: string) =>
  createUserWithEmailAndPassword(requireAuth(), email, password);
export const signInAuthUserWithEmailAndPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(requireAuth(), email, password);
export const validateAuthPassword = (password: string) =>
  validatePassword(requireAuth(), password);
export const updateAuthUserDisplayName = (user: User, displayName: string) =>
  updateProfile(user, { displayName });

/**
 * Creates a Firestore /users/{uid} document for a Firebase Auth user,
 * if one doesn't already exist. Only meaningful if something in the
 * app actually creates users via Firebase Auth.
 */
export async function createUserDocFromAuth(user: User, additionalInformation: Record<string, unknown> = {}) {
  if (!db) throw new Error("Firebase is not configured");
  const userDocRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userDocRef);

  if (!userSnapshot.exists()) {
    await setDoc(userDocRef, {
      displayName: user.displayName,
      email: user.email,
      createdAt: new Date(),
      ...additionalInformation,
    });
  }

  return userDocRef;
}