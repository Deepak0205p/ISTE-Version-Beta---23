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
    const { auth } = await getFirebase();
    await fbSignOut(auth);
    setUser(null);
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
