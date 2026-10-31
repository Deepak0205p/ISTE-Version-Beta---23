import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import fs from "node:fs";

let adminApp: App;

export function getFirebaseAdmin(): { app: App; db: Firestore; auth: Auth } {
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const sa = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      adminApp = initializeApp({
        credential: cert(sa),
        projectId: process.env.FIREBASE_PROJECT_ID || sa.project_id,
      });
    } else {
      adminApp = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "money-matters-207e8",
      });
    }
  } else {
    adminApp = getApp();
  }

  const db = getFirestore(adminApp);
  const auth = getAuth(adminApp);

  return { app: adminApp, db, auth };
}
