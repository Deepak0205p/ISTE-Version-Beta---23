"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Wallet,
  Landmark,
  Compass,
  Receipt,
  BadgeIndianRupee,
  Calculator,
  Bot,
  BarChart3,
  Sun,
  Moon,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { AuthModal } from "@/components/auth-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/money-management", label: "Money Management", icon: Wallet },
  { href: "/banking", label: "Banking & Statements", icon: Landmark },
  { href: "/goals", label: "Goals & Investments", icon: Compass },
  { href: "/affordability", label: "Can I Afford It?", icon: Receipt },
  { href: "/ask", label: "Ask: Afford ₹X Next Month", icon: BadgeIndianRupee },
  { href: "/tools", label: "Financial Tools", icon: Calculator },
  { href: "/advisor", label: "Financial Advisor", icon: Bot },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className={`flex min-h-screen transition-colors duration-200 ${isDark ? "bg-[#121008] text-[#ECEAE6]" : "bg-[#FAF8F5] text-[#1E1B18]"}`}>
      {/* SIDEBAR */}
      <aside
        className={`relative flex flex-col border-r transition-all duration-300 select-none z-30 shrink-0 ${
          collapsed ? "w-20" : "w-72"
        } ${isDark ? "bg-[#1D1913] border-[#3A3226]" : "bg-[#FFFFFF] border-[#E5DECE] shadow-sm"}`}
      >
        {/* Brand */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-[#3A3226]" : "border-[#E5DECE]"}`}>
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6E5A44] to-[#8D7A62] flex items-center justify-center shadow-lg shadow-[#8D7A62]/20 shrink-0">
              <TrendingUp className="text-white" size={22} />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className={`font-bold tracking-tight text-lg font-tabular leading-tight ${isDark ? "text-white" : "text-[#1E1B18]"}`}>
                  MONEY MATTERS
                </span>
                <span className={`text-[11px] font-medium tracking-wide ${isDark ? "text-[#A79A8A]" : "text-[#7A6F62]"}`}>
                  Unified Wealth Ecosystem
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-[#241F17] text-[#A79A8A] hover:text-white" : "hover:bg-[#F2ECE1] text-[#7A6F62] hover:text-black"}`}
            title="Toggle Sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* User Card */}
        {!collapsed && (
          <div className={`p-3 border-b ${isDark ? "border-[#3A3226]" : "border-[#E5DECE]"}`}>
            <div
              onClick={() => (!user ? setAuthOpen(true) : null)}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isDark ? "hover:bg-[#241F17]/60" : "hover:bg-[#F5EFE4]"}`}
            >
              <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 overflow-hidden font-semibold select-none ${isDark ? "bg-[#2E2820] border-[#334155] text-white" : "bg-[#EDE5D5] border-[#D6CBB9] text-[#2E2820]"}`}>
                <span>{user ? user.email?.[0].toUpperCase() : "👤"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold truncate ${isDark ? "text-[#ECEAE6]" : "text-[#1E1B18]"}`}>
                    {user ? user.displayName || user.email?.split("@")[0] : "Account Owner"}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8D7A62]/20 text-[#8D7A62] font-medium">
                    {user ? "VERIFIED" : "GUEST"}
                  </span>
                </div>
                <p className={`text-xs truncate ${isDark ? "text-[#A79A8A]" : "text-[#7A6F62]"}`}>
                  {user ? user.email : "Sign In to Cloud"}
                </p>
              </div>
              {user && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    logout();
                  }}
                  title="Logout"
                  className="p-1 text-[#A79A8A] hover:text-red-500"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nav list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left relative group ${
                  isActive
                    ? isDark
                      ? "bg-gradient-to-r from-[#8D7A62]/25 to-transparent text-[#D4AF37] border-l-4 border-[#8D7A62]"
                      : "bg-[#F3EDE2] text-[#8D7A62] border-l-4 border-[#8D7A62] font-semibold"
                    : isDark
                    ? "text-[#A79A8A] hover:text-[#ECEAE6] hover:bg-[#241F17]/50"
                    : "text-[#7A6F62] hover:text-[#1E1B18] hover:bg-[#F5EFE4]"
                }`}
              >
                <div className={isActive ? "text-[#8D7A62]" : isDark ? "text-[#A79A8A] group-hover:text-white" : "text-[#7A6F62] group-hover:text-black"}>
                  <Icon size={20} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${isDark ? "bg-[#241F17] text-[#8D7A62] border-[#3A3226]" : "bg-[#EDE5D5] text-[#8D7A62] border-[#D6CBB9]"}`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Theme toggle */}
        <div className={`p-3 border-t ${isDark ? "border-[#3A3226]" : "border-[#E5DECE]"} space-y-2`}>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              isDark ? "text-[#A79A8A] hover:text-white hover:bg-[#241F17]" : "text-[#7A6F62] hover:text-black hover:bg-[#F5EFE4]"
            }`}
          >
            <div className="flex items-center gap-3">
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-amber-600" />}
              {!collapsed && <span className="font-semibold">{isDark ? "Obsidian Dark" : "Clean Light"}</span>}
            </div>
            {!collapsed && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${isDark ? "bg-[#241F17] text-amber-300 border-[#3A3226]" : "bg-[#EDE5D5] text-amber-800 border-[#D6CBB9]"}`}>
                Toggle
              </span>
            )}
          </button>
          {!collapsed && (
            <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${isDark ? "bg-[#191510]/60 border-[#3A3226]/60 text-[#A79A8A]" : "bg-[#FAF5EC] border-[#E5DECE] text-[#7A6F62]"}`}>
              <ShieldCheck className="text-emerald-500 shrink-0" size={16} />
              <div className="truncate">
                <p className={`font-semibold ${isDark ? "text-[#CFC4B6]" : "text-[#2E2820]"}`}>Bank-Grade Isolation</p>
                <p className={`text-[10px] ${isDark ? "text-[#8A7C6D]" : "text-[#8A7C6D]"}`}>Firebase Spark • Zero Creds Leaked</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto px-4 sm:px-8 py-6">
        {children}
      </main>

      {/* Auth Modal */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md p-0 border-none bg-transparent">
          <AuthModal onClose={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
