import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import fs from "node:fs";

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseAdmin(): { app: App | null; db: Firestore | null; auth: Auth | null } {
  try {
    if (getApps().length === 0) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        const sa = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        adminApp = initializeApp({
          credential: cert(sa),
          projectId: process.env.FIREBASE_PROJECT_ID || sa.project_id,
        });
        firestoreDb = getFirestore(adminApp);
        firebaseAuth = getAuth(adminApp);
      } else {
        // Safe fallback: when no service account file exists, do not trigger ADC throw
        return { app: null, db: null, auth: null };
      }
    } else {
      adminApp = getApp();
      firestoreDb = getFirestore(adminApp);
      firebaseAuth = getAuth(adminApp);
    }

    return { app: adminApp, db: firestoreDb, auth: firebaseAuth };
  } catch (err) {
    console.warn("[FirebaseAdmin] Running with in-memory ledger (no service account JSON):", (err as Error).message);
    return { app: null, db: null, auth: null };
  }
}
