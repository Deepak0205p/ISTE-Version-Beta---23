"use client";

import React from "react";
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

  return (
    <div
      suppressHydrationWarning
      className={`min-h-screen flex transition-colors duration-200 ${
        isDarkMode
          ? "dark bg-[#121008] text-[#F8F7F4]"
          : "light bg-[#F8F7F4] text-[#29241E]"
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
