/**
 * firebaseAdmin.js
 * ------------------------------------------------------------------
 * Initializes the Firebase Admin SDK once for the whole backend and
 * exports a single shared Firestore instance (`db`).
 * ------------------------------------------------------------------
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// The Firebase service account credential, resolved below from one of
// two possible sources. Stays `undefined` if neither source is available.
let credential;

// --- Step 1: Resolve credentials -----------------------------------
// We support two ways of supplying the Firebase service account:
//   1. An env var (FIREBASE_SERVICE_ACCOUNT_KEY) containing the JSON as a string.
//   2. A local serviceAccountKey.json file - convenient for local dev.
// Env var takes priority so production config never silently falls back to a stale local file.
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    credential = cert(serviceAccount);
} else {
    try {
        // NOTE: this file is gitignored and must be provided manually per-environment.
        const serviceAccount = require('./serviceAccountKey.json');
        credential = cert(serviceAccount);
    } catch {
        // Neither source was available — we don't throw here because we want the server to still boot.
        console.error(
            'ERROR: No Firebase credentials found. Add backend/serviceAccountKey.json ' +
            'or set FIREBASE_SERVICE_ACCOUNT_KEY in backend/.env'
        );
    }
}

// The shared Firestore client. Stays `null` until (and unless) init succeeds.
let db = null;

// --- Step 2: Initialize the app and grab a Firestore handle ---------
try {
    // getApps().length === 0 guards against re-initializing if this module is ever require()'d more than once (e.g. hot reload).
    if (credential && getApps().length === 0) {
        initializeApp({ credential });
    }
    if (getApps().length > 0) {
        db = getFirestore();
    }
} catch (error) {
    // Initialization failures land here. We log and leave `db` as null rather than crashing.
    console.error('ERROR: Firebase Admin failed to initialize:', error.message);
}

module.exports = { db };