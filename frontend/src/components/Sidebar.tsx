import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '@/lib/authContext';
import { AuthModal } from '@/components/auth-modal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NavigationTab } from '../types';
import {
  LayoutDashboard,
  Wallet,
  Landmark,
  Compass,
  Calculator,
  Bot,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Users,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Receipt,
  BadgeIndianRupee,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';

function UserAvatar({
  avatar,
  name,
  className = "w-9 h-9",
  textClass = "text-sm",
  isDarkMode = true,
}: {
  avatar?: string;
  name: string;
  className?: string;
  textClass?: string;
  isDarkMode?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const isUrl =
    !imgError &&
    Boolean(
      avatar &&
        (avatar.startsWith("http://") ||
          avatar.startsWith("https://") ||
          avatar.startsWith("/")),
    );

  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div
      className={`${className} rounded-full border flex items-center justify-center shrink-0 overflow-hidden font-semibold select-none ${
        isDarkMode
          ? "bg-[#2E2820] border-[#334155] text-[#ECEAE6]"
          : "bg-[#ECEAE6] border-[#CBD5E1] text-[#35291C]"
      }`}
    >
      {isUrl ? (
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={textClass}>{avatar && avatar.length <= 4 ? avatar : initials}</span>
      )}
    </div>
  );
}

export const Sidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    isDarkMode,
    toggleDarkMode,
    currentUser,
    setCurrentUser,
    family,
    isFamilyView,
    setIsFamilyView
  } = useFinancial();

  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const navItems: { id: NavigationTab; href: string; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', href: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'money-management', href: '/money-management', label: 'Money Management', icon: <Wallet size={20} /> },
    { id: 'banking', href: '/banking', label: 'Banking & Statements', icon: <Landmark size={20} /> },
    { id: 'goals-investments', href: '/goals', label: 'Goals & Investments', icon: <Compass size={20} /> },
    { id: 'affordability', href: '/affordability', label: 'Purchase Affordability', icon: <BadgeIndianRupee size={20} /> },
    { id: 'calculators', href: '/tools', label: 'Financial Tools', icon: <Calculator size={20} /> },
    { id: 'advisor', href: '/advisor', label: 'Financial Advisor', icon: <Bot size={20} /> },
    { id: 'reports', href: '/reports', label: 'Reports & Analytics', icon: <BarChart3 size={20} /> },
  ];

  // Synchronize currentTab with URL route if on a subpage
  useEffect(() => {
    const match = navItems.find(item => item.href === pathname);
    if (match && currentTab !== match.id) {
      setCurrentTab(match.id);
    }
  }, [pathname, setCurrentTab]);

  return (
    <aside
      className={`relative flex flex-col shrink-0 border-r transition-all duration-300 select-none z-30 ${
        isCollapsed ? 'w-20' : 'w-72'
      } ${
        isDarkMode
          ? 'bg-[#1D1913] border-[#3A3226] text-[#ECEAE6]'
          : 'bg-white border-[#E3DFD8] text-[#35291C]'
      } min-h-screen`}
    >
      {/* Brand Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E3DFD8]'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6E5A44] to-[#8D7A62] flex items-center justify-center shadow-lg shadow-[#8D7A62]/20 shrink-0">
            <TrendingUp size={22} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className={`font-bold tracking-tight text-lg font-tabular leading-tight ${isDarkMode ? 'text-white' : 'text-[#35291C]'}`}>
                MONEY MATTERS
              </span>
              <span className={`text-[11px] font-medium tracking-wide ${isDarkMode ? 'text-[#A79A8A]' : 'text-[#857767]'}`}>
                Unified Wealth Ecosystem
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg transition-colors ${
            isDarkMode
              ? 'hover:bg-[#241F17] text-[#A79A8A] hover:text-white'
              : 'hover:bg-[#ECEAE6] text-[#857767] hover:text-[#35291C]'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Authentication / Profile Header */}
      <div className={`p-3 border-b ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E3DFD8]'}`}>
        {user ? (
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
              showUserDropdown
                ? (isDarkMode ? 'bg-[#241F17]' : 'bg-[#ECEAE6]')
                : (isDarkMode ? 'hover:bg-[#241F17]/60' : 'hover:bg-[#F5F4F2]')
            }`}
          >
            <UserAvatar
              avatar={user.photoURL || undefined}
              name={user.displayName || user.email?.split('@')[0] || "User"}
              className="w-9 h-9"
              textClass="text-sm"
              isDarkMode={isDarkMode}
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-[#ECEAE6]' : 'text-[#35291C]'}`}>
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                    Online
                  </span>
                </div>
                <p className={`text-xs truncate ${isDarkMode ? 'text-[#A79A8A]' : 'text-[#857767]'}`}>
                  {user.email}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {!isCollapsed ? (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#8D7A62] hover:bg-[#6E5A44] text-white font-semibold text-xs transition shadow-md cursor-pointer"
              >
                <LogIn size={15} />
                <span>Log In / Sign Up</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full flex items-center justify-center p-2 rounded-xl bg-[#8D7A62] hover:bg-[#6E5A44] text-white transition cursor-pointer"
                title="Log In / Sign Up"
              >
                <LogIn size={18} />
              </button>
            )}
          </div>
        )}

        {/* Dropdown for Logged-In User Actions */}
        {showUserDropdown && !isCollapsed && user && (
          <div className={`mt-2 p-2 ${isDarkMode ? 'bg-[#241F17] border-[#3A3226]' : 'bg-white border-[#E3DFD8] shadow-lg'} rounded-xl border text-xs space-y-2`}>
            <div className={`flex items-center justify-between pb-1 border-b ${isDarkMode ? 'border-[#3A3226]/80' : 'border-[#E3DFD8]'} px-1`}>
              <span className={`font-medium ${isDarkMode ? 'text-[#A79A8A]' : 'text-[#857767]'}`}>Account Status</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Active Session</span>
            </div>

            <button
              onClick={async () => {
                await logout();
                setShowUserDropdown(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition cursor-pointer font-medium text-xs text-left"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) || (pathname === '/' && currentTab === item.id);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left relative group ${
                isActive
                  ? (isDarkMode
                      ? 'bg-gradient-to-r from-[#8D7A62]/20 to-transparent text-[#8D7A62] border-l-4 border-[#8D7A62]'
                      : 'bg-[#F1E9DC] text-[#6E5A44] border-l-4 border-[#6E5A44] font-semibold')
                  : (isDarkMode
                      ? 'text-[#A79A8A] hover:text-[#ECEAE6] hover:bg-[#241F17]/50'
                      : 'text-[#857767] hover:text-[#35291C] hover:bg-[#ECEAE6]')
              }`}
            >
              <div className={`${isActive ? (isDarkMode ? 'text-[#8D7A62]' : 'text-[#6E5A44]') : (isDarkMode ? 'text-[#A79A8A] group-hover:text-white' : 'text-[#857767] group-hover:text-[#35291C]')}`}>
                {item.icon}
              </div>
              {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
                  isDarkMode
                    ? 'bg-[#241F17] text-[#8D7A62] border-[#3A3226]'
                    : 'bg-[#F1E9DC] text-[#6E5A44] border-[#D6C0A2]'
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Collapsed Tooltip */}
              {isCollapsed && (
                <div className={`absolute left-full ml-2 px-2.5 py-1.5 text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none border transition-opacity z-50 ${
                  isDarkMode
                    ? 'bg-[#241F17] text-white border-[#3A3226]'
                    : 'bg-[#35291C] text-white border-[#3A3226]'
                }`}>
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Controls: Theme Toggle & Security Status */}
      <div className={`p-3 border-t ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E3DFD8]'} space-y-2`}>
        <button
          onClick={toggleDarkMode}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isDarkMode
              ? 'text-[#A79A8A] hover:text-white hover:bg-[#241F17]'
              : 'text-[#857767] hover:text-[#35291C] hover:bg-[#ECEAE6]'
          }`}
          title={isDarkMode ? 'Switch to Clean Light Mode' : 'Switch to Obsidian Dark Mode'}
        >
          <div className="flex items-center gap-3">
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
            {!isCollapsed && (
              <span className="font-semibold">{isDarkMode ? 'Obsidian Dark' : 'Clean Light'}</span>
            )}
          </div>
          {!isCollapsed && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              isDarkMode
                ? 'bg-[#241F17] text-amber-300 border-[#3A3226]'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {isDarkMode ? 'Toggle Light' : 'Toggle Obsidian'}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            isDarkMode
              ? 'bg-[#191510]/60 border-[#3A3226]/60 text-[#A79A8A]'
              : 'bg-[#F5F4F2] border-[#E3DFD8] text-[#857767]'
          }`}>
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <div className="truncate">
              <p className={`font-semibold ${isDarkMode ? 'text-[#CFC4B6]' : 'text-[#35291C]'}`}>Bank-Grade Isolation</p>
              <p className={`text-[10px] ${isDarkMode ? 'text-[#8A7C6D]' : 'text-[#857767]'}`}>256-Bit TLS • Zero Credentials Stored</p>
            </div>
          </div>
        )}
      </div>

      {/* Login / Sign Up Modal */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent showCloseButton={false} className="p-0 border-0 bg-transparent max-w-md shadow-none">
          <AuthModal onClose={() => setAuthModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </aside>
  );
};
