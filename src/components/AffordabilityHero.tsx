import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowRight,
  User,
  Sparkles,
  HelpCircle,
  Tag,
  IndianRupee,
  Layers,
} from 'lucide-react';
import { PersonaProfile } from '../types/finance';

interface AffordabilityHeroProps {
  currentQuery: string;
  onChangeQuery: (query: string) => void;
  onSubmitQuery: () => void;
  isLoading: boolean;
  activePersonaId: string;
  onSelectPersona: (personaId: 'rohan' | 'meera' | 'arjun') => void;
  personas: Record<string, PersonaProfile>;
  parsedItem: string;
  parsedAmount: number | null;
  onUpdateManualPrice: (newPrice: number) => void;
}

export const AffordabilityHero: React.FC<AffordabilityHeroProps> = ({
  currentQuery,
  onChangeQuery,
  onSubmitQuery,
  isLoading,
  activePersonaId,
  onSelectPersona,
  personas,
  parsedItem,
  parsedAmount,
  onUpdateManualPrice,
}) => {
  const [localQuery, setLocalQuery] = useState(currentQuery);

  useEffect(() => {
    setLocalQuery(currentQuery);
  }, [currentQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeQuery(localQuery);
    onSubmitQuery();
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-xs mb-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-5">
        <div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
            30-Day Moving-Block Bootstrap Engine
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
            Can I Afford It Next Month?
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mt-1.5 leading-relaxed">
            Deterministic cash flow simulation across 500 block draws. No generic AI math,
            no rule-of-thumb guesswork—grounded strictly in your multi-account bank ledger.
          </p>
        </div>

        {/* Natural Language Query Bar */}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
          <div className="relative flex items-center shadow-sm rounded-xl border-2 border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 transition-colors bg-white dark:bg-slate-800">
            <div className="pl-4 text-slate-400">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="e.g., Can I afford a 20,000 laptop next month?"
              className="w-full py-3.5 sm:py-4 pl-3 pr-32 sm:pr-40 text-sm sm:text-base bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !localQuery.trim()}
              className="absolute right-2 sm:right-2.5 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <span>Check Affordability</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Parsed Parameter Feedback Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Target Purchase:</span>
            <strong className="text-slate-900 dark:text-white font-medium">
              {parsedItem || 'Item'}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Target Price:</span>
            <strong className="text-slate-900 dark:text-white font-mono font-semibold tabular-nums">
              ₹{(parsedAmount ?? 0).toLocaleString('en-IN')}
            </strong>
          </div>

          {/* Quick price incrementers */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUpdateManualPrice(Math.max(1000, (parsedAmount || 20000) - 5000))}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              -₹5k
            </button>
            <button
              type="button"
              onClick={() => onUpdateManualPrice((parsedAmount || 20000) + 5000)}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              +₹5k
            </button>
            <button
              type="button"
              onClick={() => onUpdateManualPrice((parsedAmount || 20000) + 20000)}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              +₹20k
            </button>
          </div>
        </div>

        {/* Persona quick chips */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mr-1">
              Test Personas:
            </span>
            {(['rohan', 'meera', 'arjun'] as const).map((pId) => {
              const persona = personas[pId];
              const isActive = activePersonaId === pId;
              return (
                <button
                  key={pId}
                  onClick={() => onSelectPersona(pId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>
                    {persona.name} ({persona.archetype})
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            {personas[activePersonaId]?.description}
          </p>
        </div>
      </div>
    </div>
  );
};
