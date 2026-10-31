import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR } from '../utils/currency';
import {
  Bot,
  Sparkles,
  Send,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
}

export const AdvisorModule: React.FC = () => {
  const { metrics, loans, goals, habitualExpenses, currentUser, investments } = useFinancial();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const hasData = metrics.monthlyIncome > 0 || metrics.totalSavingsBalance > 0 || loans.length > 0;
    const initialText = hasData
      ? `Hello ${currentUser.name}! I have scanned your current ledger. Your liquid savings balance is ${formatINR(metrics.totalSavingsBalance)} and your monthly expenses are ${formatINR(metrics.monthlyExpenses)}. How can I assist your financial planning today?`
      : `Hello ${currentUser.name}! Welcome to Money Matters. No accounts or transactions have been added yet. Connect an account or import statements in the Banking module to receive personalized ledger-grounded insights.`;
    return [
      {
        id: 'm1',
        sender: 'AI',
        text: initialText,
        timestamp: 'Just now'
      }
    ];
  });
  const [userInput, setUserInput] = useState('');

  // Proactive Intelligence Alerts backed strictly by recorded numbers
  const proactiveInsights = useMemo(() => {
    const insights: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];

    if (habitualExpenses.length > 0) {
      const sum = habitualExpenses.reduce((s, h) => s + h.amount, 0);
      insights.push({
        id: 'ins-1',
        type: 'HABITUAL_SAVING',
        title: 'Recurring Outflow Commitments',
        description: `Your recurring subscriptions and utilities total ${formatINR(sum)} each month across ${habitualExpenses.length} recurring item(s).`,
        urgency: 'MEDIUM'
      });
    }

    if (loans.length > 0) {
      insights.push({
        id: 'ins-2',
        type: 'DEBT_ACCELERATION',
        title: 'Loan Prepayment Acceleration',
        description: `You have ${loans.length} active loan(s) totaling ${formatINR(metrics.totalLoanPrincipal)} outstanding principal with ${formatINR(metrics.monthlyEmiCommitments)}/month in EMI obligations.`,
        urgency: 'HIGH'
      });
    }

    const emergencyGoal = goals.find(g => g.category === 'Emergency Fund');
    if (emergencyGoal) {
      insights.push({
        id: 'ins-3',
        type: 'EMERGENCY_RESERVE',
        title: 'Emergency Cushion Target',
        description: `Your active emergency fund goal is currently at ${formatINR(emergencyGoal.currentAmount)} of its ${formatINR(emergencyGoal.targetAmount)} target.`,
        urgency: 'LOW'
      });
    }

    return insights;
  }, [habitualExpenses, loans, goals, metrics]);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'USER',
      text: userInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setUserInput('');

    // Contextual responses based on real numbers
    setTimeout(() => {
      let reply = `Based on your recorded ledger: your liquid bank balance is ${formatINR(metrics.totalSavingsBalance)} and your total investment valuation is ${formatINR(metrics.totalInvestmentValuation)}.`;
      
      const lower = userMsg.text.toLowerCase();
      if (lower.includes('loan') || lower.includes('emi')) {
        reply = loans.length > 0
          ? `Your active loans have a total outstanding principal of ${formatINR(metrics.totalLoanPrincipal)} with ${formatINR(metrics.monthlyEmiCommitments)}/month in EMI commitments.`
          : `You currently have zero active loans or EMI obligations recorded.`;
      } else if (lower.includes('invest') || lower.includes('sip') || lower.includes('asset')) {
        reply = investments.length > 0
          ? `Your recorded investments stand at ${formatINR(metrics.totalInvestmentValuation)} current valuation across ${investments.length} asset(s) with ${formatINR(metrics.totalInvestedPrincipal)} invested principal.`
          : `No investments recorded yet. You can add mutual funds, stocks, or deposits in the Goals & Investments tab.`;
      } else if (lower.includes('goal')) {
        reply = goals.length > 0
          ? `You have ${goals.length} active financial goal(s) with total target outlay of ${formatINR(goals.reduce((s, g) => s + g.targetAmount, 0))}.`
          : `No active goals set yet. Set a goal in Goals & Investments to begin tracking.`;
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Advisor Header */}
      <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot size={20} className="text-[#8D7A62]" />
            <span className="text-xs font-bold text-[#8D7A62] uppercase tracking-wider">
              FinTech Intelligence Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">Data-Grounded Financial Advisory</h2>
          <p className="text-xs text-[#A79A8A] mt-1 max-w-xl">
            Synthesizing banking transactions, loan amortization, habitual trends, and goal velocity without hallucinations or unverified external advice.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Automated High-Impact Insights */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-[#8D7A62]" />
            Algorithmic Observations
          </h3>

          {proactiveInsights.length === 0 ? (
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-xl text-center text-xs text-[#A79A8A]">
              No active observations yet. As you record transactions, loans, and goals, algorithmic insights will appear here.
            </div>
          ) : (
            proactiveInsights.map(item => (
              <div
                key={item.id}
                className="bg-[#1D1913] border border-[#3A3226] p-4 rounded-xl space-y-2 hover:border-[#8D7A62]/40 transition"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    item.urgency === 'HIGH'
                      ? 'bg-red-500/10 text-red-400'
                      : item.urgency === 'MEDIUM'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {item.urgency} Priority
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{item.title}</h4>
                <p className="text-[11px] text-[#A79A8A] leading-relaxed">{item.description}</p>
              </div>
            ))
          )}
        </div>

        {/* Right: Interactive FinTech Advisory Chat */}
        <div className="lg:col-span-2 bg-[#1D1913] border border-[#3A3226] rounded-2xl flex flex-col h-[520px] shadow-xl overflow-hidden">
          <div className="p-4 border-b border-[#3A3226] bg-[#241F17] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#8D7A62]/20 border border-[#8D7A62]/40 flex items-center justify-center text-[#8D7A62]">
                <Bot size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Money Matters Financial AI</h4>
                <p className="text-[10px] text-emerald-400">Ledger Grounded • Private & Encrypted</p>
              </div>
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'USER'
                      ? 'bg-[#8D7A62] text-white rounded-br-none'
                      : 'bg-[#241F17] text-[#ECEAE6] border border-[#3A3226] rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#A79A8A] mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-[#241F17] border-t border-[#3A3226] flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about your loans, emergency fund, SIP projections, or spending habits..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-[#191510] border border-[#3A3226] text-white text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#8D7A62]"
            />
            <button
              onClick={handleSendMessage}
              className="p-2.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white rounded-xl transition cursor-pointer"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

