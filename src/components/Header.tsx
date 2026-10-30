import React from 'react';
import {
  Wallet,
  Cpu,
  Database,
  Moon,
  Sun,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  selectedAccount: string;
  onSelectAccount: (account: string) => void;
  availableAccounts: string[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  seed: number;
  onCycleSeed: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedAccount,
  onSelectAccount,
  availableAccounts,
  darkMode,
  onToggleDarkMode,
  seed,
  onCycleSeed,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              Can I Afford It Next Month?
            </span>
            <span className="text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase">
              PS-4 Engine
            </span>
          </div>
        </div>

        {/* Global status indicator & Account Switcher */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div
            onClick={onCycleSeed}
            className="cursor-pointer group flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            title="Click to cycle deterministic PRNG seed"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:rotate-45 transition-transform" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Local Engine Active
            </span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span className="font-mono tabular-nums">Seed: {seed}</span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-500" />
              <span>SQLite Sync</span>
            </div>
          </div>
        </div>

        {/* Quick Account Switcher & Theme Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Account Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedAccount}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="appearance-none text-xs font-semibold pl-3 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="ALL">All Accounts (Consolidated)</option>
              {availableAccounts.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
