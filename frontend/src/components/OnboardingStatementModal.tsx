"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useFinancial } from "@/context/FinancialContext";
import { UnifiedStatementUploader } from "@/components/UnifiedStatementUploader";
import { Sparkles, X, ShieldCheck, CheckCircle2 } from "lucide-react";

export function OnboardingStatementModal() {
  const { user } = useAuth();
  const { transactions } = useFinancial();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsOpen(false);
      return;
    }

    // Check if this user has already completed statement onboarding
    const storageKey = `mm_statement_onboarded_${user.uid}`;
    const alreadyOnboarded = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

    if (!alreadyOnboarded && !hasDismissed) {
      // Small timeout for smooth appearance after sign-in
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user, hasDismissed]);

  const handleComplete = (count: number) => {
    if (user && typeof window !== "undefined") {
      localStorage.setItem(`mm_statement_onboarded_${user.uid}`, "true");
    }
    setIsOpen(false);
    // Redirect to Cognitive Statement Insights / Banking
    router.push("/banking");
  };

  const handleClose = () => {
    if (user && typeof window !== "undefined") {
      localStorage.setItem(`mm_statement_onboarded_${user.uid}`, "dismissed");
    }
    setHasDismissed(true);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#161512] border border-[#3A3226] p-6 sm:p-8 shadow-2xl space-y-6 text-[#ECEAE6]">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#A79A8A] hover:text-white hover:bg-[#241F17] transition cursor-pointer"
          title="Skip for now"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="space-y-2 text-center sm:text-left pr-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4A373]/15 text-[#D4A373] text-xs font-semibold border border-[#D4A373]/30">
            <Sparkles size={14} />
            <span>New User Onboarding Setup</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Welcome, {user?.displayName || user?.email?.split("@")[0] || "Friend"}!
          </h2>
          <p className="text-xs sm:text-sm text-[#A79A8A]">
            Upload your bank statement (PDF or CSV) to automatically generate your verified reports, cognitive statement insights, category spend breakdown, and affordability forecast.
          </p>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-[#A79A8A]">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1D1913] border border-[#2C261E]">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>120+ Indian Bank Patterns</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1D1913] border border-[#2C261E]">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>Running Chain Audit</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1D1913] border border-[#2C261E]">
            <ShieldCheck size={15} className="text-[#D4A373] shrink-0" />
            <span>Local & In-Memory Privacy</span>
          </div>
        </div>

        {/* Unified Uploader */}
        <UnifiedStatementUploader onUploadSuccess={handleComplete} />
      </div>
    </div>
  );
}

