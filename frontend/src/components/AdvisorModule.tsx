import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Target
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

export const AdvisorModule: React.FC = () => {
  const { metrics, loans, goals, currentUser, investments, bankAccounts, expenses } = useFinancial();
  const { user: firebaseUser } = useAuth();

  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync complete user data to Firebase Firestore whenever it updates
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

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const hasData = metrics.monthlyIncome > 0 || metrics.totalSavingsBalance > 0 || loans.length > 0;
    const initialText = hasData
      ? `### Financial Snapshot Overview
* **Liquid Savings Balance:** **${formatINR(metrics.totalSavingsBalance)}**
* **Monthly In-Hand Income:** **${formatINR(metrics.monthlyIncome)}**
* **Monthly EMI Commitments:** **${formatINR(metrics.monthlyEmiCommitments)}** across ${loans.length} active loan(s)
* **Investments Valuation:** **${formatINR(metrics.totalInvestmentValuation)}**

How may I assist you with your budget, debt repayment strategy, savings goals, or market benchmark rates?`
      : `### Financial AI Advisor
* Connected and ready to assist.
* Direct sync with your personal financial ledger.
* Real-time automated external market lookup via Tavily.

Ask any specific question regarding your financial planning, loans, or investments to get started.`;

    return [
      {
        id: 'init-1',
        sender: 'AI',
        text: initialText,
        timestamp: 'Just now',
      }
    ];
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || userInput;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'USER',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!customText) setUserInput('');
    setIsTyping(true);

    const userId = firebaseUser?.uid || currentUser.id || 'default_user';
    saveChatMessageToFirestore(userId, userMsg);

    try {
      // Prepare comprehensive financial payload for the model
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
          history: chatMessages.slice(-8),
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

      setChatMessages(prev => [...prev, aiMsg]);
      saveChatMessageToFirestore(userId, aiMsg);
    } catch (err) {
      console.error('Advisor Chat Error:', err);
      const fallbackAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'AI',
        text: `Based on your connected ledger data: your liquid savings balance is ${formatINR(metrics.totalSavingsBalance)} and monthly income is ${formatINR(metrics.monthlyIncome)}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages(prev => [...prev, fallbackAiMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-2 sm:p-4 animate-fadeIn">
      {/* Interactive Chatbot Interface - Full Screen Utilization */}
      <div className="bg-white dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] rounded-2xl flex flex-col h-[calc(100vh-2rem)] w-full shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-[#E6E1D8] dark:border-[#3A3226] bg-[#F8F7F4] dark:bg-[#241F17] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#8F7D65] flex items-center justify-center text-white shadow-xs">
              <Bot size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#121008] dark:text-white flex items-center gap-2">
                Financial AI Advisor
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gemini 3.5 Flash Lite • Automated Real-time Internet Search • Personal Ledger Grounding
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setChatMessages([
                {
                  id: `reset-${Date.now()}`,
                  sender: 'AI',
                  text: `### Session Reset\n* Context refreshed.\n* Ready to analyze your financial parameters or market metrics.\n\nWhat would you like to review?`,
                  timestamp: 'Just now'
                }
              ]);
            }}
            className="p-2 text-slate-400 hover:text-[#121008] dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Messages Scroll View */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-[#121008]/40">
          {chatMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {msg.sender === 'USER' ? (
                  <>
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">You</span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-[#8F7D65] flex items-center gap-1">
                      <Sparkles size={11} /> AI Advisor
                    </span>
                    <span className="text-[10px] text-slate-400">• {msg.timestamp}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[92%] sm:max-w-[85%] md:max-w-[80%] p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'USER'
                    ? 'bg-[#8F7D65] text-white rounded-br-none shadow-xs whitespace-pre-wrap'
                    : 'bg-white text-[#121008] border border-[#E6E1D8] dark:bg-[#1D1913] dark:text-[#F8F7F4] dark:border-[#3A3226] rounded-bl-none shadow-xs'
                }`}
              >
                {msg.sender === 'USER' ? (
                  msg.text
                ) : (
                  <div className="space-y-2.5 leading-relaxed text-slate-800 dark:text-slate-100">
                    <ReactMarkdown
                      components={{
                        h1: ({ ...props }) => <h1 className="text-base sm:text-lg font-bold text-[#121008] dark:text-white mt-1 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-sm sm:text-base font-bold text-[#121008] dark:text-white mt-2 mb-1" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-xs sm:text-sm font-bold text-[#121008] dark:text-white mt-2 mb-1 flex items-center gap-1.5" {...props} />,
                        p: ({ ...props }) => <p className="leading-relaxed mb-2 last:mb-0" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 my-1.5 marker:text-[#8F7D65]" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1 my-1.5 marker:text-[#8F7D65]" {...props} />,
                        li: ({ ...props }) => <li className="leading-relaxed pl-0.5" {...props} />,
                        strong: ({ ...props }) => <strong className="font-bold text-[#121008] dark:text-white" {...props} />,
                        hr: ({ ...props }) => <hr className="my-3 border-t border-slate-200 dark:border-slate-700" {...props} />,
                        code: ({ ...props }) => <code className="bg-slate-100 dark:bg-slate-800 text-[#8F7D65] font-mono px-1.5 py-0.5 rounded text-[11px]" {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Web Sources Citations if query triggered search */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                      <Globe size={11} className="text-[#8F7D65]" /> Verified Web Sources:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {msg.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-slate-50 dark:bg-[#121008] border border-slate-200 dark:border-slate-800 hover:border-[#8F7D65] transition flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 truncate"
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
          ))}

          {/* AI Typing Indicator */}
          {isTyping && (
            <div className="flex flex-col items-start animate-fadeIn">
              <span className="text-[11px] font-semibold text-[#8F7D65] flex items-center gap-1 mb-1 px-1">
                <Sparkles size={11} className="animate-spin" /> Thinking...
              </span>
              <div className="p-3 rounded-2xl bg-white dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] rounded-bl-none shadow-xs flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-[#8F7D65] animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#241F17] border-t border-[#E6E1D8] dark:border-[#3A3226] flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder="Ask about your loans, emergency fund, investments, or current market interest rates..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            disabled={isTyping}
            className="flex-1 bg-[#F8F7F4] dark:bg-[#121008] border border-[#CBD5E1] dark:border-[#3A3226] text-[#121008] dark:text-white text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#8F7D65] transition"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isTyping || !userInput.trim()}
            className="p-3 bg-[#8F7D65] hover:bg-[#6F5D48] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition cursor-pointer shadow-xs shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
