"use client";

import React, { useEffect, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({
  children,
  fullWidth = false,
  noPadding = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}) {
  const { isDarkMode } = useFinancial();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-[#16A579] border-t-transparent animate-spin" />
          <span>Loading Money Matters...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex transition-colors duration-200 ${isDarkMode
          ? "dark bg-[#0F172A] text-[#F8FAFC]"
          : "light bg-[#F8FAFC] text-[#0F172A]"
        }`}
    >
      <Sidebar />
      <main
        className={`flex-1 min-w-0 h-screen overflow-y-auto ${
          noPadding ? "p-0" : fullWidth ? "p-3 sm:p-4" : "px-4 sm:px-8 py-6"
        }`}
      >
        <div className={fullWidth ? "w-full h-full" : "max-w-7xl mx-auto"}>
          {children}
        </div>
      </main>
    </div>
  );
}
