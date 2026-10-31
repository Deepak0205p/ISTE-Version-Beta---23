"use client";

import React, { useEffect, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useFinancial();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#121008] text-[#F7F5F1] flex items-center justify-center font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-[#8F7D65] border-t-transparent animate-spin" />
          <span>Loading Money Matters...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex transition-colors duration-200 ${
        isDarkMode
          ? "dark bg-[#121008] text-[#F7F5F1]"
          : "light bg-[#F8F7F4] text-[#29241E]"
      }`}
    >
      <Sidebar />
      <main className="flex-1 min-w-0 h-screen overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
