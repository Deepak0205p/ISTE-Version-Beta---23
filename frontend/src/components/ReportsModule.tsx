import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR, formatCompactINR, formatDate } from '../utils/currency';
import {
  BarChart3,
  Download,
  Calendar,
  FileText,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export const ReportsModule: React.FC = () => {
  const { metrics, expenses, transactions, bankAccounts, family } = useFinancial();

  const [reportType, setReportType] = useState<'monthly' | 'category' | 'member'>('monthly');

  // Member-wise expense aggregation
  const memberSpendMap: { [name: string]: number } = {};
  expenses.forEach(e => {
    memberSpendMap[e.familyMemberName] = (memberSpendMap[e.familyMemberName] || 0) + e.amount;
  });

  const memberChartData = Object.entries(memberSpendMap).map(([name, spend]) => ({
    name,
    spend
  }));

  // CSV Export simulator
  const exportCSV = () => {
    const headers = 'ID,Date,Description,Category,Member,Amount\n';
    const rows = expenses.map(e => `"${e.id}","${e.date}","${e.description}","${e.category}","${e.familyMemberName}",${e.amount}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Money_Matters_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white">Comprehensive Financial Reporting Center</h2>
          <p className="text-xs text-[#A79A8A] mt-1">
            Aggregated audit trails, tax-ready statements, and multi-member expense accountability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#8D7A62]/20 transition cursor-pointer"
          >
            <Download size={14} /> Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Scope Navigation */}
      <div className="flex items-center gap-2 border-b border-[#3A3226] pb-3">
        <button
          onClick={() => setReportType('monthly')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            reportType === 'monthly'
              ? 'bg-[#8D7A62] text-white'
              : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
          }`}
        >
          Monthly Cash Flow Summary
        </button>
        <button
          onClick={() => setReportType('member')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            reportType === 'member'
              ? 'bg-[#8D7A62] text-white'
              : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
          }`}
        >
          Family Member Breakdown
        </button>
      </div>

      {reportType === 'monthly' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A]">Gross Monthly Inflows</span>
              <div className="text-2xl font-bold text-emerald-400 font-tabular mt-1">
                {formatINR(metrics.monthlyIncome)}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">Salaries, Dividends & Retainers</p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A]">Actual Living Expenses</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">
                {formatINR(metrics.monthlyExpenses)}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">Zero Double-Counted Contra-Entries</p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A]">Net Monthly Capital Surplus</span>
              <div className="text-2xl font-bold text-[#8D7A62] font-tabular mt-1">
                {formatINR(metrics.remainingBalance)}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">Effective Savings Rate: {metrics.savingsRatePercentage}%</p>
            </div>
          </div>

          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">
              {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })} Audit Trail Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226]">
                  <tr>
                    <th className="p-3">Reference ID</th>
                    <th className="p-3">Posting Date</th>
                    <th className="p-3">Particulars</th>
                    <th className="p-3">Member</th>
                    <th className="p-3 text-right">Debit (Expense)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3226]">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#A79A8A]">
                        No expenses recorded yet. Upload a statement or add transactions to view audit records.
                      </td>
                    </tr>
                  ) : (
                    expenses.map(e => (
                      <tr key={e.id}>
                        <td className="p-3 font-mono text-[#A79A8A]">{e.id}</td>
                        <td className="p-3 text-[#A79A8A]">{formatDate(e.date)}</td>
                        <td className="p-3 font-semibold text-white">{e.description}</td>
                        <td className="p-3 text-[#B3A595]">{e.familyMemberName}</td>
                        <td className="p-3 text-right font-bold text-white font-tabular">{formatINR(e.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'member' && (
        <div className="space-y-6">
          <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Expenditure by Family Member</h3>
            <p className="text-xs text-[#A79A8A] mb-4">Accountability distribution across members</p>

            {memberChartData.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#A79A8A]">
                No member spending records found.
              </div>
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <BarChart data={memberChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3226" vertical={false} />
                    <XAxis dataKey="name" stroke="#A79A8A" fontSize={12} tickLine={false} />
                    <YAxis stroke="#A79A8A" fontSize={11} tickFormatter={val => formatCompactINR(val)} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#241F17', borderColor: '#3A3226', borderRadius: '12px', color: '#ECEAE6' }}
                      formatter={(val: any) => [formatINR(Number(val)), 'Spent']}
                    />
                    <Bar dataKey="spend" fill="#8D7A62" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
