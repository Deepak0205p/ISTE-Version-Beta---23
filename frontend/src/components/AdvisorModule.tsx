import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../lib/authContext';
import { formatINR } from '../utils/currency';
import { syncFinancialProfileToFirestore, saveChatMessageToFirestore } from '../lib/firebase';
import {
  Bot,
  Sparkles,
  Send,
  Globe,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Landmark,
  CreditCard,
  Target,
  History,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  Zap,
  Compass,
  RefreshCw,
  X,
  Shield,
  Lock,
  ArrowUpRight
} from 'lucide-react';

interface WebSource {
  title: string;
  url: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
  sources?: WebSource[];
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'mm_advisor_sessions_v2';

export const AdvisorModule: React.FC = () => {
  const { metrics, loans, goals, currentUser, investments, bankAccounts, expenses } = useFinancial();
  const { user: firebaseUser } = useAuth();

  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync profile data to cloud
  useEffect(() => {
    const userId = firebaseUser?.uid || currentUser.id || 'default_user';
    const profileData = {
      name: currentUser.name,
      email: currentUser.email || firebaseUser?.email || '',
      metrics: {
        totalSavingsBalance: metrics.totalSavingsBalance,
        monthlyIncome: metrics.monthlyIncome,
        monthlyExpenses: metrics.monthlyExpenses,
        remainingBalance: metrics.remainingBalance,
        totalLoanPrincipal: metrics.totalLoanPrincipal,
        monthlyEmiCommitments: metrics.monthlyEmiCommitments,
        totalInvestedPrincipal: metrics.totalInvestedPrincipal,
        totalInvestmentValuation: metrics.totalInvestmentValuation,
      },
      loans: loans.map(l => ({ name: l.name, outstanding: l.outstandingPrincipal, emi: l.emiAmount, rate: l.interestRate })),
      goals: goals.map(g => ({ title: g.title, target: g.targetAmount, current: g.currentAmount, date: g.targetDate })),
      investments: investments.map(i => ({ name: i.name, valuation: i.currentValuation, category: i.category })),
      bankAccounts: bankAccounts.map(b => ({ bankName: b.bankName, accountType: b.accountType, balance: b.balance })),
      updatedAt: new Date().toISOString(),
    };
    syncFinancialProfileToFirestore(userId, profileData);
  }, [firebaseUser, currentUser, metrics, loans, goals, investments, bankAccounts]);

  const generateWelcomeMessage = useCallback((): string => {
    const hasData = metrics.monthlyIncome > 0 || metrics.totalSavingsBalance > 0 || loans.length > 0;
    return hasData
      ? `### Fiduciary Financial Advisory Active
* **Liquid Savings Cushion:** **${formatINR(metrics.totalSavingsBalance)}**
* **Monthly In-Hand Inflow:** **${formatINR(metrics.monthlyIncome)}**
* **Monthly Debt Servicing:** **${formatINR(metrics.monthlyEmiCommitments)}** across ${loans.length} active loan(s)
* **Investments Valuation:** **${formatINR(metrics.totalInvestmentValuation)}**

I am ready to assist with debt optimization, scam screening, budget defense, and real-time market interest rate benchmarks.`
      : `### Fiduciary AI Wealth Strategist
* Live financial ledger integration active.
* Automated real-time internet verification via Tavily search.
* 3-Tier Guardrails: Financial Domain Strictness, False Payment Detection, and Impulsive Spending Warnings.

Ask a question or select a verified inquiry below to get started.`;
  }, [metrics, loans]);

  // Load chat sessions from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Could not read advisor sessions from localStorage:', err);
      }
    }
    const initialId = `session-${Date.now()}`;
    return [
      {
        id: initialId,
        title: 'Initial Consultation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: `init-${Date.now()}`,
            sender: 'AI',
            text: `### Fiduciary AI Wealth Strategist
* Connected and ready to assist with your personal balance sheet.
* 3-Tier Guardrails: Financial Domain Strictness, False Payment Radar, and Impulsive Spending Warnings.

Ask any specific question regarding your loans, emergency fund runway, scam verification, or tax regime optimization.`,
            timestamp: 'Just now',
          }
        ]
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || `session-${Date.now()}`;
  });

  // Keep localStorage updated with sessions
  useEffect(() => {
    if (typeof window !== 'undefined' && sessions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (e) {
        console.warn('Could not save sessions to localStorage:', e);
      }
    }
  }, [sessions]);

  // Current active session
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isTyping]);

  // Create a new chat session
  const handleCreateNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'New Consultation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: `init-${Date.now()}`,
          sender: 'AI',
          text: generateWelcomeMessage(),
          timestamp: 'Just now',
        }
      ]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    if (window.innerWidth < 768) {
      setIsHistoryOpen(false);
    }
  };

  // Delete a chat session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // If deleting the last session, just reset it
      const resetId = `session-${Date.now()}`;
      const freshSession: ChatSession = {
        id: resetId,
        title: 'Initial Consultation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: `init-${Date.now()}`,
            sender: 'AI',
            text: generateWelcomeMessage(),
            timestamp: 'Just now',
          }
        ]
      };
      setSessions([freshSession]);
      setActiveSessionId(resetId);
      return;
    }

    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id);
    }
  };

  // Reset active conversation
  const handleResetCurrentSession = () => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: [
              {
                id: `reset-${Date.now()}`,
                sender: 'AI',
                text: `### Session Reset\n* Context refreshed.\n* Ready to analyze your financial parameters, scan for fraudulent payment vectors, or check market rates.\n\nWhat would you like to review?`,
                timestamp: 'Just now'
              }
            ]
          };
        }
        return s;
      })
    );
  };

  // Copy message text
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || userInput;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'USER',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update active session with user message and update title if it's the first question
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          const isInitialTitle = s.title === 'New Consultation' || s.title === 'Initial Consultation';
          const newTitle = isInitialTitle
            ? textToSend.trim().length > 38
              ? textToSend.trim().substring(0, 35) + '...'
              : textToSend.trim()
            : s.title;

          return {
            ...s,
            title: newTitle,
            updatedAt: Date.now(),
            messages: [...s.messages, userMsg],
          };
        }
        return s;
      })
    );

    if (!customText) setUserInput('');
    setIsTyping(true);

    const userId = firebaseUser?.uid || currentUser.id || 'default_user';
    saveChatMessageToFirestore(userId, userMsg);

    try {
      const userDataPayload = {
        name: currentUser.name,
        email: currentUser.email || firebaseUser?.email,
        metrics: {
          totalSavingsBalance: metrics.totalSavingsBalance,
          monthlyIncome: metrics.monthlyIncome,
          monthlyExpenses: metrics.monthlyExpenses,
          remainingBalance: metrics.remainingBalance,
          totalLoanPrincipal: metrics.totalLoanPrincipal,
          monthlyEmiCommitments: metrics.monthlyEmiCommitments,
          totalInvestedPrincipal: metrics.totalInvestedPrincipal,
          totalInvestmentValuation: metrics.totalInvestmentValuation,
        },
        loans: loans.map(l => ({ name: l.name, type: l.type, outstandingPrincipal: l.outstandingPrincipal, emiAmount: l.emiAmount, interestRate: l.interestRate })),
        goals: goals.map(g => ({ title: g.title, category: g.category, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate })),
        investments: investments.map(i => ({ name: i.name, category: i.category, investedPrincipal: i.investedPrincipal, currentValuation: i.currentValuation, cagrOrXirr: i.cagrOrXirr })),
        bankAccounts: bankAccounts.map(b => ({ bankName: b.bankName, accountType: b.accountType, balance: b.balance })),
        topCategories: expenses.slice(0, 10).map(e => `${e.category}: ₹${e.amount}`).join(', '),
      };

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: currentSession?.messages.slice(-8) || [],
          userData: userDataPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch AI response');
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources && data.sources.length > 0 ? data.sources : undefined,
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, aiMsg],
            };
          }
          return s;
        })
      );
      saveChatMessageToFirestore(userId, aiMsg);
    } catch (err) {
      console.error('Advisor Chat Error:', err);
      const fallbackAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'AI',
        text: `### 🛡️ Local Fiduciary Fallback\nUnable to reach cloud inference. Based on your connected ledger data:\n* **Liquid Savings:** **${formatINR(metrics.totalSavingsBalance)}**\n* **Monthly Expenses:** **${formatINR(metrics.monthlyExpenses)}**\n* **Safe Reserve Runway:** **${(metrics.totalSavingsBalance / (metrics.monthlyExpenses || 1)).toFixed(1)} months**\n* **Debt Servicing Ratio:** **${metrics.monthlyIncome > 0 ? ((metrics.monthlyEmiCommitments / metrics.monthlyIncome) * 100).toFixed(1) : 0}%**`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, fallbackAiMsg],
            };
          }
          return s;
        })
      );
    } finally {
      setIsTyping(false);
    }
  };

  const starterPromptCards = [
    {
      title: 'False Payment & Scam Check',
      desc: 'Verify if asking for UPI PIN or QR code to receive a refund is a scam',
      icon: ShieldAlert,
      accent: 'border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400',
      badge: 'Fraud Shield',
      prompt: 'Someone sent me a QR code on WhatsApp and asked me to enter my UPI PIN to receive ₹25,000 refund/prize. Is this legitimate or a scam?',
    },
    {
      title: 'Prudent Spend & Runway Check',
      desc: 'Audit whether an unplanned ₹65,000 splurge is safe without risking your buffer',
      icon: AlertTriangle,
      accent: 'border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400',
      badge: 'Capital Prudence',
      prompt: 'Can I afford an unplanned discretionary spend of ₹65,000 right now without hurting my emergency cushion or savings goals?',
    },
    {
      title: 'RBI Repo Rate & Floating EMIs',
      desc: 'Check live repo rate benchmarks and calculate impact on floating loans',
      icon: Landmark,
      accent: 'border-[#8F7D65]/30 text-[#8F7D65]',
      badge: 'Live Market Data',
      prompt: 'What is the current RBI repo rate and how does it directly impact floating home loan EMIs in India?',
    },
    {
      title: 'Tax Regime Comparison',
      desc: 'Compare Old vs New Tax Regime deductions for maximum tax savings',
      icon: TrendingUp,
      accent: 'border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400',
      badge: 'Tax Optimization',
      prompt: 'Based on my salary and standard deductions, should I choose the New Tax Regime or Old Tax Regime for the financial year?',
    },
  ];

  return (
    <div className="w-full h-full flex flex-col p-2 sm:p-4 animate-fadeIn">
      {/* Outer Executive Container with Guilloche Micro-Texture */}
      <div className="relative bg-[#FAF9F5] dark:bg-[#18140E] border border-[#E6E1D8] dark:border-[#332A1F] rounded-2xl flex flex-row h-[calc(100vh-2rem)] w-full shadow-sm overflow-hidden">
        
        {/* Subtle Watermark Micro-Lattice Background Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.045]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, #8F7D65 1.2px, transparent 1.2px),
              linear-gradient(to right, #8F7D65 0.5px, transparent 0.5px),
              linear-gradient(to bottom, #8F7D65 0.5px, transparent 0.5px)
            `,
            backgroundSize: '28px 28px, 28px 28px, 28px 28px'
          }}
        />

        {/* Ambient Top Glow in Warm Taupe */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-gradient-to-b from-[#8F7D65]/10 via-[#8F7D65]/3 to-transparent blur-3xl pointer-events-none -z-10" />

        {/* ========================================================================= */}
        {/* LEFT PANEL: Chat History & Consultations Drawer */}
        {/* ========================================================================= */}
        <div
          className={`${
            isHistoryOpen ? 'w-72 sm:w-80' : 'w-0'
          } shrink-0 transition-all duration-300 ease-in-out border-r border-[#E6E1D8] dark:border-[#332A1F] bg-[#F4F2EB] dark:bg-[#1E1912] flex flex-col overflow-hidden relative z-20`}
        >
          {/* History Header */}
          <div className="p-3.5 border-b border-[#E6E1D8] dark:border-[#332A1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[#8F7D65]" />
              <span className="text-xs font-bold text-[#29241E] dark:text-[#F8F7F4] uppercase tracking-wider">
                Consultations
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EAE6DF] dark:bg-[#2B231A] text-[#8F7D65]">
                {sessions.length}
              </span>
            </div>

            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1.5 text-stone-400 hover:text-[#29241E] dark:hover:text-white rounded-lg hover:bg-[#EAE6DF] dark:hover:bg-[#2B231A] transition cursor-pointer"
              title="Close consultation history"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* New Consultation Action */}
          <div className="p-3">
            <button
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#8F7D65] hover:bg-[#786751] active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus size={15} />
              <span>New Consultation</span>
            </button>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
            {sessions.map(session => {
              const isActive = session.id === activeSessionId;
              const dateStr = new Date(session.updatedAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    if (window.innerWidth < 768) setIsHistoryOpen(false);
                  }}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition ${
                    isActive
                      ? 'bg-white dark:bg-[#282117] text-[#29241E] dark:text-[#F8F7F4] shadow-xs border border-[#E6E1D8] dark:border-[#3E3426]'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-[#EBE7DF] dark:hover:bg-[#251F16]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <MessageSquare
                      size={14}
                      className={isActive ? 'text-[#8F7D65] shrink-0' : 'text-stone-400 shrink-0'}
                    />
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${isActive ? 'text-[#29241E] dark:text-white font-semibold' : ''}`}>
                        {session.title}
                      </p>
                      <span className="text-[10px] text-stone-400">
                        {dateStr} • {session.messages.length} msg{session.messages.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={e => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-500 rounded transition cursor-pointer shrink-0"
                    title="Delete thread"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Security Assurance Badge in Sidebar */}
          <div className="p-3 border-t border-[#E6E1D8] dark:border-[#332A1F] bg-[#EFECE3]/60 dark:bg-[#19150E]/80 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2">
            <Lock size={12} className="text-[#8F7D65] shrink-0" />
            <span className="truncate">Encrypted Fiduciary Storage</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Chat Area */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
          
          {/* Executive Header with Custom Luxury Emblem */}
          <div className="px-4 py-3.5 border-b border-[#E6E1D8] dark:border-[#332A1F] bg-[#F7F5EE]/90 dark:bg-[#1F1912]/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* History Toggle Button if closed */}
              {!isHistoryOpen && (
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="p-2 text-stone-500 hover:text-[#29241E] dark:hover:text-white rounded-xl bg-white dark:bg-[#282117] border border-[#E6E1D8] dark:border-[#3E3426] transition shadow-2xs cursor-pointer relative"
                  title="Open consultations"
                >
                  <History size={16} />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#8F7D65]" />
                </button>
              )}

              {/* Bespoke Luxury Emblem */}
              <div className="relative shrink-0">
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-xs">
                  <rect width="32" height="32" rx="9" fill="url(#emblem_grad)" />
                  <path d="M16 5.5L24.5 9.5V16C24.5 21.8 20.8 25.8 16 27.2C11.2 25.8 7.5 21.8 7.5 16V9.5L16 5.5Z" stroke="#F5F2EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
                  <path d="M11 18.5L14.8 14.7L18.2 17.7L22.2 11.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 11.5H22.2V14.7" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="22.2" cy="11.5" r="1.5" fill="#FAF9F5" />
                  <defs>
                    <linearGradient id="emblem_grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#9C8B72" />
                      <stop offset="0.5" stopColor="#8F7D65" />
                      <stop offset="1" stopColor="#544431" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-[#29241E] dark:text-[#F8F7F4] tracking-tight truncate">
                    Money Matters Advisor
                  </h3>
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Fiduciary Guardrail Active
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  Finance-Only Verification • False Payment Radar • Prudent Spend Buffer
                </p>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCreateNewChat}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#282117] border border-[#E6E1D8] dark:border-[#3E3426] text-stone-700 dark:text-stone-300 hover:text-[#29241E] dark:hover:text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Start a new chat"
              >
                <Plus size={14} />
                <span>New</span>
              </button>

              <button
                onClick={handleResetCurrentSession}
                className="p-2 text-stone-400 hover:text-[#29241E] dark:hover:text-white rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition cursor-pointer"
                title="Reset active consultation thread"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4">
            
            {/* If consultation has only initial message, show bespoke starter cards */}
            {currentSession?.messages.length <= 1 && (
              <div className="mb-6 animate-fadeIn">
                {/* Hero Minimalist Banner */}
                <div className="p-5 rounded-2xl bg-white/80 dark:bg-[#221C14]/80 border border-[#E6E1D8] dark:border-[#332A1F] shadow-xs mb-4 text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#8F7D65]/10 flex items-center justify-center text-[#8F7D65] shrink-0">
                    <ShieldCheck size={26} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-[#29241E] dark:text-[#F8F7F4]">
                      Certified Personal Wealth Strategist & Scam Shield
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-2xl">
                      Exclusively calibrated for financial advice. Every incoming transaction prompt is scanned for false payment scams, fraudulent UPI PIN requests, and unproductive lifestyle splurges.
                    </p>
                  </div>
                </div>

                {/* 4 Interactive Quick-Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {starterPromptCards.map((card, idx) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSendMessage(card.prompt)}
                        className={`group p-3.5 rounded-xl bg-white dark:bg-[#211B13] border ${card.accent} hover:shadow-md hover:border-[#8F7D65] cursor-pointer transition-all duration-200 flex items-start gap-3`}
                      >
                        <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-900 shrink-0 group-hover:scale-105 transition">
                          <CardIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h5 className="text-xs font-bold text-[#29241E] dark:text-[#F8F7F4] group-hover:text-[#8F7D65] transition truncate">
                              {card.title}
                            </h5>
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                              {card.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">
                            {card.desc}
                          </p>
                        </div>
                        <ArrowUpRight size={14} className="text-stone-400 group-hover:text-[#8F7D65] shrink-0 transition" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {currentSession?.messages.map(msg => {
              const isUser = msg.sender === 'USER';
              const isFraudAlert = msg.text.includes('FRAUD & SUSPICIOUS PAYMENT ALERT');
              const isPrudenceAlert = msg.text.includes('FINANCIAL PRUDENCE & UNPRODUCTIVE SPEND WARNING');
              const isScopeAlert = msg.text.includes('Out of Financial Scope');

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fadeIn`}
                >
                  {/* Sender Metadata Bar */}
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    {isUser ? (
                      <>
                        <span className="text-[10px] text-stone-400">{msg.timestamp}</span>
                        <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">You</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full bg-[#8F7D65] flex items-center justify-center text-white text-[9px] font-bold">
                          ₹
                        </div>
                        <span className="text-[11px] font-semibold text-[#8F7D65] flex items-center gap-1">
                          Advisor AI
                        </span>
                        <span className="text-[10px] text-stone-400">• {msg.timestamp}</span>
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`group relative max-w-[94%] sm:max-w-[85%] md:max-w-[80%] p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#8F7D65] text-white rounded-br-xs shadow-xs whitespace-pre-wrap'
                        : isFraudAlert
                        ? 'bg-rose-50/90 dark:bg-[#251012] text-rose-950 dark:text-rose-100 border-2 border-rose-400 dark:border-rose-800 rounded-bl-xs shadow-sm'
                        : isPrudenceAlert
                        ? 'bg-amber-50/90 dark:bg-[#241A0E] text-amber-950 dark:text-amber-100 border-2 border-amber-400 dark:border-amber-800 rounded-bl-xs shadow-sm'
                        : isScopeAlert
                        ? 'bg-stone-100/90 dark:bg-[#1D1812] text-stone-900 dark:text-stone-200 border-2 border-stone-300 dark:border-stone-700 rounded-bl-xs shadow-sm'
                        : 'bg-white dark:bg-[#201A13] text-[#29241E] dark:text-[#F8F7F4] border border-[#E6E1D8] dark:border-[#382F22] rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {isUser ? (
                      msg.text
                    ) : (
                      <div className="space-y-2.5 leading-relaxed">
                        <ReactMarkdown
                          components={{
                            h1: ({ ...props }) => (
                              <h1 className="text-base sm:text-lg font-bold text-[#29241E] dark:text-white mt-1 mb-2 border-b border-stone-200 dark:border-stone-700 pb-1" {...props} />
                            ),
                            h2: ({ ...props }) => (
                              <h2 className="text-sm sm:text-base font-bold text-[#29241E] dark:text-white mt-2.5 mb-1.5" {...props} />
                            ),
                            h3: ({ children, ...props }) => {
                              const text = String(children);
                              if (text.includes('FRAUD') || text.includes('SUSPICIOUS PAYMENT')) {
                                return (
                                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500 text-white font-bold text-xs sm:text-sm my-2 shadow-xs">
                                    <ShieldAlert size={18} className="shrink-0" />
                                    <span>{children}</span>
                                  </div>
                                );
                              }
                              if (text.includes('PRUDENCE') || text.includes('UNPRODUCTIVE SPEND')) {
                                return (
                                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500 text-white font-bold text-xs sm:text-sm my-2 shadow-xs">
                                    <AlertTriangle size={18} className="shrink-0" />
                                    <span>{children}</span>
                                  </div>
                                );
                              }
                              if (text.includes('Out of Financial Scope')) {
                                return (
                                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#8F7D65] text-white font-bold text-xs sm:text-sm my-2 shadow-xs">
                                    <Shield size={18} className="shrink-0" />
                                    <span>{children}</span>
                                  </div>
                                );
                              }
                              return (
                                <h3 className="text-xs sm:text-sm font-bold text-[#29241E] dark:text-white mt-2 mb-1 flex items-center gap-1.5" {...props}>
                                  {children}
                                </h3>
                              );
                            },
                            p: ({ ...props }) => <p className="leading-relaxed mb-2 last:mb-0" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 my-1.5 marker:text-[#8F7D65]" {...props} />,
                            ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1 my-1.5 marker:text-[#8F7D65]" {...props} />,
                            li: ({ ...props }) => <li className="leading-relaxed pl-0.5" {...props} />,
                            strong: ({ ...props }) => <strong className="font-bold text-[#29241E] dark:text-white font-tabular" {...props} />,
                            hr: ({ ...props }) => <hr className="my-3 border-t border-stone-200 dark:border-stone-700" {...props} />,
                            code: ({ ...props }) => (
                              <code className="bg-stone-100 dark:bg-stone-800 text-[#8F7D65] font-mono px-1.5 py-0.5 rounded text-[11px]" {...props} />
                            ),
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>

                        {/* Copy button on AI messages */}
                        <div className="pt-2 flex items-center justify-end">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-stone-400 hover:text-[#8F7D65] hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Copy response"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Verified Web Sources Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-stone-700/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1 uppercase tracking-wider">
                          <Globe size={11} className="text-[#8F7D65]" /> Real-time Internet Sources (Tavily Verified):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {msg.sources.map((src, idx) => (
                            <a
                              key={idx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-stone-50 dark:bg-[#18130C] border border-stone-200 dark:border-stone-800 hover:border-[#8F7D65] transition flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 truncate"
                            >
                              <span className="truncate pr-1 font-medium">{src.title}</span>
                              <ExternalLink size={11} className="shrink-0 text-[#8F7D65]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI Typing Indicator */}
            {isTyping && (
              <div className="flex flex-col items-start animate-fadeIn">
                <span className="text-[11px] font-semibold text-[#8F7D65] flex items-center gap-1 mb-1 px-1">
                  <Sparkles size={11} className="animate-spin" /> Analyzing with Fiduciary Guardrails...
                </span>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#201A13] border border-[#E6E1D8] dark:border-[#382F22] rounded-bl-xs shadow-xs flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 bg-white/90 dark:bg-[#1D1812]/90 backdrop-blur-md border-t border-[#E6E1D8] dark:border-[#332A1F] flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about loans, tax slabs, emergency runway, or verify a payment's legitimacy..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
              className="flex-1 bg-[#F8F7F4] dark:bg-[#14100A] border border-[#CBD5E1] dark:border-[#382F22] text-[#29241E] dark:text-[#F8F7F4] text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#8F7D65] focus:ring-1 focus:ring-[#8F7D65] transition"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isTyping || !userInput.trim()}
              className="p-3 bg-[#8F7D65] hover:bg-[#786751] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition cursor-pointer shadow-xs shrink-0"
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
