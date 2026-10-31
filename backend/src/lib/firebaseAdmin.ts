import { initializeApp, getApps, getApp, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

/**
 * Detect and parse Firebase service account credentials if available.
 * Supports:
 *  1. FIREBASE_SERVICE_ACCOUNT_PATH (file path)
 *  2. FIREBASE_SERVICE_ACCOUNT_KEY (inline JSON string or base64)
 *  3. GOOGLE_APPLICATION_CREDENTIALS (standard GCP file path)
 */
function resolveServiceAccount(): ServiceAccount | null {
  // 1. Explicit file path
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    const candidates = [
      saPath,
      path.resolve(process.cwd(), saPath),
      path.resolve(process.cwd(), "backend", saPath),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, "utf8");
          return JSON.parse(content) as ServiceAccount;
        } catch (e) {
          console.warn(`[FirebaseAdmin] Failed to parse JSON from ${p}:`, e instanceof Error ? e.message : e);
        }
      }
    }
  }

  // 2. Inline JSON string or Base64 in environment variable
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saKey && saKey.trim()) {
    try {
      const trimmed = saKey.trim();
      const content = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
      return JSON.parse(content) as ServiceAccount;
    } catch (e) {
      console.warn("[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e instanceof Error ? e.message : e);
    }
  }

  // 3. Standard Google Application Credentials
  const gAuthPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gAuthPath && fs.existsSync(gAuthPath)) {
    try {
      const content = fs.readFileSync(gAuthPath, "utf8");
      return JSON.parse(content) as ServiceAccount;
    } catch (e) {
      console.warn(`[FirebaseAdmin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS from ${gAuthPath}:`, e instanceof Error ? e.message : e);
    }
  }

  return null;
}

/**
 * Check if Firebase Admin credentials or local Firestore emulator are configured.
 */
export function isFirestoreConfigured(): boolean {
  if (Boolean(process.env.FIRESTORE_EMULATOR_HOST)) {
    return true;
  }
  return resolveServiceAccount() !== null;
}

/**
 * Get initialized Firebase Admin instances, or null if credentials are not configured.
 * This prevents @google-cloud/firestore from throwing unhandled "Could not load default credentials"
 * errors when running locally without a service account.
 */
export function getFirebaseAdmin(): { app: App; db: Firestore; auth: Auth } | null {
  if (!isFirestoreConfigured()) {
    return null;
  }

  try {
    if (getApps().length === 0) {
      const sa = resolveServiceAccount();
      const projectId = process.env.FIREBASE_PROJECT_ID || (sa as Record<string, string> | null)?.project_id || "money-matters-207e8";

      if (sa) {
        adminApp = initializeApp({
          credential: cert(sa),
          projectId,
        });
      } else if (process.env.FIRESTORE_EMULATOR_HOST) {
        adminApp = initializeApp({
          projectId,
        });
      } else {
        return null;
      }
    } else {
      adminApp = getApp();
    }

    if (!adminDb && adminApp) {
      adminDb = getFirestore(adminApp);
    }
    if (!adminAuth && adminApp) {
      adminAuth = getAuth(adminApp);
    }

    if (adminApp && adminDb && adminAuth) {
      return { app: adminApp, db: adminDb, auth: adminAuth };
    }
    return null;
  } catch (err) {
    console.warn("[FirebaseAdmin] Initialization failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
