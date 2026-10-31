"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export async function getFirebase() {
  if (app && auth && db) return { app, auth, db };

  // Fetch credentials strictly from backend
  const res = await fetch("/api/config");
  const data = await res.json();
  const firebaseConfig = data.firebase;

  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error("Firebase config not available from backend");
  }

  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  return { app, auth, db };
}

/**
 * Record user profile in Firestore under a structured SQL-table format
 * Table: users
 * Row: document id = user.uid
 */
export async function syncUserToFirestore(user: User) {
  try {
    const { db } = await getFirebase();
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    const userData = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      photoURL: user.photoURL || "",
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        role: "user",
      });
    } else {
      await setDoc(userRef, userData, { merge: true });
    }
  } catch (err) {
    console.error("Failed to sync user to Firestore:", err);
  }
}

/**
 * Sync complete financial profile to Firestore for real-time personalization
 */
export async function syncFinancialProfileToFirestore(userId: string, profileData: Record<string, any>) {
  try {
    const { db } = await getFirebase();
    const profileRef = doc(db, "financial_profiles", userId);
    await setDoc(
      profileRef,
      {
        userId,
        ...profileData,
        lastSyncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[firestore] Could not sync financial profile to cloud:", err);
  }
}

/**
 * Save chat session or message to Firestore
 */
export async function saveChatMessageToFirestore(userId: string, message: { sender: string; text: string; id: string; timestamp: string; sources?: any[] }) {
  try {
    const { db } = await getFirebase();
    const chatDocRef = doc(db, "advisor_chats", `${userId}_${message.id}`);
    await setDoc(chatDocRef, {
      userId,
      ...message,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[firestore] Could not save chat to cloud:", err);
  }
}

export {
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fbSignOut,
  onAuthStateChanged,
};
