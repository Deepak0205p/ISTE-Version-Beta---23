import React, { useState, useEffect } from 'react';
import { TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';

interface IntroAnimationProps {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'INITIAL' | 'EXPAND' | 'FADE_OUT'>('INITIAL');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('EXPAND'), 400);
    const t2 = setTimeout(() => setPhase('FADE_OUT'), 2300);
    const t3 = setTimeout(() => onComplete(), 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#191510] transition-opacity duration-500 ${
        phase === 'FADE_OUT' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background radial gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#8D7A62]/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#3B82F6]/15 rounded-full blur-[100px] animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center text-center p-6 space-y-6">
        {/* Animated Brand Emblem */}
        <div
          className={`w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#6E5A44] via-[#8D7A62] to-[#60A5FA] p-[2px] shadow-2xl shadow-[#8D7A62]/30 transition-all duration-700 ease-out ${
            phase === 'INITIAL'
              ? 'scale-50 opacity-0 rotate-12'
              : 'scale-100 opacity-100 rotate-0'
          }`}
        >
          <div className="w-full h-full bg-[#191510] rounded-[22px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#8D7A62]/20 to-transparent animate-pulse" />
            <TrendingUp size={44} className="text-[#8D7A62] relative z-10" />
          </div>
        </div>

        {/* Text Reveal */}
        <div
          className={`space-y-2 transition-all duration-700 delay-150 ease-out ${
            phase === 'INITIAL'
              ? 'translate-y-6 opacity-0'
              : 'translate-y-0 opacity-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8D7A62] animate-ping" />
            <span className="text-xs uppercase font-bold tracking-widest text-[#8D7A62]">
              Autonomous FinTech Architecture
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight font-tabular">
            MONEY <span className="text-[#8D7A62]">MATTERS</span>
          </h1>

          <p className="text-sm text-[#A79A8A] font-medium tracking-wide max-w-sm mx-auto">
            Your Entire Financial Life. One Intelligent Platform.
          </p>
        </div>

        {/* Progress Indicator */}
        <div
          className={`w-48 h-1 bg-[#241F17] rounded-full overflow-hidden transition-all duration-500 delay-300 ${
            phase === 'INITIAL' ? 'opacity-0 scale-x-50' : 'opacity-100 scale-x-100'
          }`}
        >
          <div className="h-full bg-gradient-to-r from-[#8D7A62] to-[#60A5FA] animate-[progress_2s_ease-in-out_infinite]" />
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 text-[11px] text-[#857767] pt-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Local DPDP Compliant • In-Memory Zero Leak Processing</span>
        </div>
      </div>
    </div>
  );
};

