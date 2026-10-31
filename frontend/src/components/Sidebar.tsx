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
          ? "bg-[#273549] border-[#3A3226] text-[#ECEAE6]"
          : "bg-[#ECEAE6] border-[#CBD5E1] text-[#3A3226]"
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mm_sidebar_collapsed');
      return saved === 'true';
    }
    return false;
  });
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mm_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

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
      className={`relative flex flex-col h-screen sticky top-0 shrink-0 border-r transition-[width] duration-300 ease-in-out select-none z-30 ${
        isCollapsed ? 'w-20' : 'w-72'
      } ${
        isDarkMode
          ? 'bg-[#1D1913] border-[#3A3226] text-[#F8F7F4]'
          : 'bg-[#FFFFFF] border-[#E6E1D8] text-[#121008]'
      }`}
    >
      {/* Brand Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-4 border-b ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E6E1D8]'}`}>
        <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6F5D48] to-[#8F7D65] flex items-center justify-center shadow-lg shadow-[#8F7D65]/20 shrink-0">
            <TrendingUp size={22} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className={`font-bold tracking-tight text-lg font-tabular leading-tight truncate ${isDarkMode ? 'text-white' : 'text-[#121008]'}`}>
                MONEY MATTERS
              </span>
              <span className={`text-[11px] font-medium tracking-wide truncate ${isDarkMode ? 'text-[#94A3B8]' : 'text-black dark:text-[#94A3B8]'}`}>
                Unified Wealth Ecosystem
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className={`p-1.5 rounded-lg transition-colors shrink-0 ${
            isDarkMode
              ? 'hover:bg-[#273549] text-[#94A3B8] hover:text-white'
              : 'hover:bg-[#F1F5F9] text-black dark:text-[#94A3B8] hover:text-[#121008]'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Authentication / Profile Header */}
      <div className={`p-3 border-b ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E6E1D8]'}`}>
        {user ? (
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
              showUserDropdown
                ? (isDarkMode ? 'bg-[#273549]' : 'bg-[#F1F5F9]')
                : (isDarkMode ? 'hover:bg-[#273549]/60' : 'hover:bg-[#F8F7F4]')
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
                  <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-[#F8F7F4]' : 'text-[#121008]'}`}>
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#16A579]/20 text-[#16A579] font-medium">
                    Online
                  </span>
                </div>
                <p className={`text-xs truncate ${isDarkMode ? 'text-[#94A3B8]' : 'text-black dark:text-[#94A3B8]'}`}>
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
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#8F7D65] hover:bg-[#6F5D48] text-white font-semibold text-xs transition shadow-md cursor-pointer"
              >
                <LogIn size={15} />
                <span>Log In / Sign Up</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full flex items-center justify-center p-2 rounded-xl bg-[#8F7D65] hover:bg-[#6F5D48] text-white transition cursor-pointer"
                title="Log In / Sign Up"
              >
                <LogIn size={18} />
              </button>
            )}
          </div>
        )}

        {/* Dropdown for Logged-In User Actions */}
        {showUserDropdown && !isCollapsed && user && (
          <div className={`mt-2 p-2 ${isDarkMode ? 'bg-[#273549] border-[#3A3226]' : 'bg-[#FFFFFF] border-[#E6E1D8] shadow-lg'} rounded-xl border text-xs space-y-2`}>
            <div className={`flex items-center justify-between pb-1 border-b ${isDarkMode ? 'border-[#3A3226]/80' : 'border-[#E6E1D8]'} px-1`}>
              <span className={`font-medium ${isDarkMode ? 'text-[#94A3B8]' : 'text-black dark:text-[#94A3B8]'}`}>Account Status</span>
              <span className="text-[10px] text-[#16A579] font-semibold">Active Session</span>
            </div>

            <button
              onClick={async () => {
                await logout();
                setShowUserDropdown(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-[#D95C52] hover:bg-[#D95C52]/10 transition cursor-pointer font-medium text-xs text-left"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-3'} space-y-1 overflow-y-auto overflow-x-hidden`}>
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) || (pathname === '/' && currentTab === item.id);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl font-medium text-sm transition-all text-left relative group ${
                isActive
                  ? (isDarkMode
                      ? 'bg-gradient-to-r from-[#8F7D65]/20 to-transparent text-[#7C3AED] border-l-4 border-[#7C3AED]'
                      : 'bg-[#F2ECE3] text-[#6F5D48] border-l-4 border-[#8F7D65] font-semibold')
                  : (isDarkMode
                      ? 'text-[#94A3B8] hover:text-[#F8F7F4] hover:bg-[#273549]/50'
                      : 'text-black dark:text-[#94A3B8] hover:text-[#121008] hover:bg-[#F1F5F9]')
              }`}
            >
              <div className={`shrink-0 flex items-center justify-center ${isActive ? (isDarkMode ? 'text-[#7C3AED]' : 'text-[#6F5D48]') : (isDarkMode ? 'text-[#94A3B8] group-hover:text-white' : 'text-black dark:text-[#94A3B8] group-hover:text-[#121008]')}`}>
                {item.icon}
              </div>
              {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${
                  isDarkMode
                    ? 'bg-[#273549] text-[#7C3AED] border-[#3A3226]'
                    : 'bg-[#F2ECE3] text-[#6F5D48] border-[#E6E1D8]'
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Collapsed Tooltip */}
              {isCollapsed && (
                <div className={`absolute left-full ml-3 px-2.5 py-1.5 text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none border transition-opacity z-50 ${
                  isDarkMode
                    ? 'bg-[#273549] text-white border-[#3A3226]'
                    : 'bg-[#121008] text-white border-[#3A3226]'
                }`}>
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Controls: Theme Toggle & Security Status */}
      <div className={`p-3 border-t ${isDarkMode ? 'border-[#3A3226]' : 'border-[#E6E1D8]'} space-y-2`}>
        <button
          onClick={toggleDarkMode}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isDarkMode
              ? 'text-[#94A3B8] hover:text-white hover:bg-[#273549]'
              : 'text-black dark:text-[#94A3B8] hover:text-[#121008] hover:bg-[#F1F5F9]'
          }`}
          title={isDarkMode ? 'Switch to Warm Taupe Light Mode' : 'Switch to Obsidian Dark Mode'}
        >
          <div className="flex items-center gap-3">
            {isDarkMode ? <Sun size={18} className="text-[#7C3AED] shrink-0" /> : <Moon size={18} className="text-[#8F7D65] shrink-0" />}
            {!isCollapsed && (
              <span className="font-semibold truncate">{isDarkMode ? 'Obsidian Dark' : 'Warm Off-White'}</span>
            )}
          </div>
          {!isCollapsed && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0 ${
              isDarkMode
                ? 'bg-[#273549] text-[#7C3AED] border-[#3A3226]'
                : 'bg-[#F2ECE3] text-[#6F5D48] border-[#E6E1D8]'
            }`}>
              {isDarkMode ? 'Switch to Warm Light' : 'Switch to Obsidian'}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            isDarkMode
              ? 'bg-[#121008]/60 border-[#3A3226]/60 text-[#94A3B8]'
              : 'bg-[#F8F7F4] border-[#E6E1D8] text-black dark:text-[#94A3B8]'
          }`}>
            <ShieldCheck size={16} className="text-[#16A579] shrink-0" />
            <div className="truncate">
              <p className={`font-semibold ${isDarkMode ? 'text-[#F8F7F4]' : 'text-[#121008]'}`}>Bank-Grade Isolation</p>
              <p className={`text-[10px] ${isDarkMode ? 'text-[#94A3B8]' : 'text-black dark:text-[#94A3B8]'}`}>256-Bit TLS • Zero Credentials Stored</p>
            </div>
          </div>
        )}
      </div>

      {/* Login / Sign Up Modal */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="p-0 border-0 bg-transparent max-w-md shadow-2xl">
          <AuthModal onClose={() => setAuthModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </aside>
  );
};
