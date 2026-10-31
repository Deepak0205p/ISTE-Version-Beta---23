"use client";

import { useEffect, useState, createContext, useContext } from "react";
import {
  getFirebase,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fbSignOut,
  onAuthStateChanged,
  syncUserToFirestore,
} from "./firebase";
import type { User } from "firebase/auth";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, link: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  sendEmailOtp: async () => {},
  verifyEmailOtp: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;
    (async () => {
      try {
        const { auth } = await getFirebase();
        unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
          setUser(currentUser);
          if (currentUser) {
            await syncUserToFirestore(currentUser);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error("Firebase auth init error:", err);
        setLoading(false);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const { auth } = await getFirebase();
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      await syncUserToFirestore(result.user);
    }
  };

  const sendEmailOtp = async (email: string) => {
    const { auth } = await getFirebase();
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
  };

  const verifyEmailOtp = async (email: string, link: string) => {
    const { auth } = await getFirebase();
    if (isSignInWithEmailLink(auth, link)) {
      const result = await signInWithEmailLink(auth, email, link);
      window.localStorage.removeItem("emailForSignIn");
      if (result.user) {
        await syncUserToFirestore(result.user);
      }
    }
  };

  const logout = async () => {
    try {
      const { auth } = await getFirebase();
      await fbSignOut(auth);
    } catch (err) {
      console.warn("Logout error:", err);
    }
    setUser(null);

    if (typeof window !== "undefined") {
      // Clear all financial records and sessions from localStorage on logout
      const keysToPurge = [
        "mm_bank_accounts",
        "mm_expenses",
        "mm_habitual",
        "mm_medical",
        "mm_students",
        "mm_education",
        "mm_loans",
        "mm_investments",
        "mm_goals",
        "mm_transactions",
        "mm_category_overrides",
        "mm_advisor_sessions",
        "mm_sessions",
        "emailForSignIn",
      ];
      keysToPurge.forEach((k) => window.localStorage.removeItem(k));

      // Remove all user-scoped statement onboarding flags or keys
      Object.keys(window.localStorage).forEach((key) => {
        if (
          key.startsWith("mm_statement_onboarded_") ||
          key.startsWith("mm_user_") ||
          key.startsWith("mm_tx_")
        ) {
          window.localStorage.removeItem(key);
        }
      });

      // Dispatch event to reset running in-memory React state
      window.dispatchEvent(new CustomEvent("mm_logout"));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        sendEmailOtp,
        verifyEmailOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
