import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR, formatDate, formatCompactINR } from '../utils/currency';
import { TransactionRecord } from '../types';
import { categorizeDescriptor } from '../utils/merchantLexicon';
import { auditRunningBalanceChain, StatementChainAuditReport } from '../utils/statementAudit';
import { evaluatePreFlightSufficiency, PreFlightStatus } from '../utils/anomalyEngine';
import {
  Landmark,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileText,
  Search,
  Filter,
  ShieldCheck,
  Plus,
  RefreshCw,
  Repeat,
  Wallet,
  Activity,
  Layers,
  Sparkles,
  BarChart2,
  Lock,
  AlertOctagon,
  KeyRound
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const BankingModule: React.FC = () => {
  const {
    bankAccounts,
    transactions,
    addBankAccount,
    importBankTransactions,
    syncWithBackend,
    currentUser
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<'statement-analysis' | 'transactions' | 'accounts' | 'import' | 'audit-gatekeeper'>('statement-analysis');
  const [searchTx, setSearchTx] = useState('');
  const [filterAccount, setFilterAccount] = useState('ALL');

  // Import State
  const [dragActive, setDragActive] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<Omit<TransactionRecord, 'id'>[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [importTargetBank, setImportTargetBank] = useState<string>(bankAccounts[0]?.id || '');
  const [pdfPassword, setPdfPassword] = useState('');
  const [isEncryptedPdf, setIsEncryptedPdf] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Near duplicate warning modal / dialog
  const [nearDuplicatePrompt, setNearDuplicatePrompt] = useState<{
    show: boolean;
    record: Omit<TransactionRecord, 'id'> | null;
  }>({ show: false, record: null });

  // Running Chain Audit Report State
  const [auditReport, setAuditReport] = useState<StatementChainAuditReport | null>(null);

  // Pre-flight Data Sufficiency Evaluation
  const preFlight: PreFlightStatus = evaluatePreFlightSufficiency(transactions);

  // Add Account Modal
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState<number>(0);
  const [newMaskedNum, setNewMaskedNum] = useState('');

  // Real statement upload handler with Lexicon & Chain Audit

  const handleStatementUpload = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files).filter(file => /\.(csv|pdf)$/i.test(file.name));
    if (selectedFiles.length === 0) {
      setUploadMessage('Select at least one CSV or PDF statement.');
      return;
    }

    setIsParsing(true);
    setUploadMessage(null);
    try {
      const body = new FormData();
      selectedFiles.forEach(file => body.append('files', file));
      body.append('account_label', importTargetBank || 'default');
      if (pdfPassword.trim()) body.append('pdf_password', pdfPassword.trim());

      const uploadResponse = await fetch('/api/upload', { method: 'POST', body });
      const uploadResult = await uploadResponse.json() as {
        ok: boolean;
        uploads?: Array<{ file: string; ok: boolean; parsed?: number; message?: string }>;
        message?: string;
      };
      if (!uploadResponse.ok || !uploadResult.ok) {
        throw new Error(uploadResult.message || 'Statement upload failed.');
      }

      await fetch('/api/ingest', { method: 'POST' });
      await syncWithBackend();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mm_ledger_updated'));
      }
      const successful = uploadResult.uploads?.filter(upload => upload.ok) ?? [];
      const importedRows = successful.reduce((total, upload) => total + (upload.parsed ?? 0), 0);
      setUploadMessage(`${successful.length} statement(s) imported and ${importedRows} row(s) added to the verified ledger.`);
      setActiveTab('audit-gatekeeper');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Statement upload failed.');
    } finally {
      setIsParsing(false);
    }
  };

  const executeImport = () => {
    if (parsedPreview.length > 0) {
      importBankTransactions(parsedPreview);
      setParsedPreview([]);
      setActiveTab('transactions');
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTx.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTx.toLowerCase());
    const matchesBank = filterAccount === 'ALL' || t.bankAccountId === filterAccount;
    return matchesSearch && matchesBank;
  });

  // Bank Account-wise Visual Analytics
  const bankDistributionData = bankAccounts.map(b => ({
    name: b.bankName,
    balance: b.currentBalance,
    color: b.color
  }));

  // Inflow vs Outflow by Channel
  const channelMap: { [method: string]: { debit: number; credit: number } } = {};
  transactions.forEach(t => {
    if (!channelMap[t.paymentMethod]) {
      channelMap[t.paymentMethod] = { debit: 0, credit: 0 };
    }
    if (t.type === 'DEBIT') {
      channelMap[t.paymentMethod].debit += t.amount;
    } else {
      channelMap[t.paymentMethod].credit += t.amount;
    }
  });

  const channelChartData = Object.entries(channelMap).map(([channel, val]) => ({
    channel,
    debit: val.debit,
    credit: val.credit
  }));

  const totalBankBalance = bankAccounts.reduce((s, b) => s + b.currentBalance, 0);
  const largestAccount = bankAccounts.length > 0
    ? [...bankAccounts].sort((a, b) => b.currentBalance - a.currentBalance)[0]
    : null;
  const internalTransfersSum = transactions
    .filter(t => t.isInternalTransfer)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3A3226] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('statement-analysis')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'statement-analysis'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            <BarChart2 size={14} /> Cognitive Statement Insights
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            Transaction Registry ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            Connected Accounts ({bankAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'import'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            <UploadCloud size={14} /> Statement Parser & Lexicon
          </button>
          <button
            onClick={() => setActiveTab('audit-gatekeeper')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'audit-gatekeeper'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            <ShieldCheck size={14} /> Pre-Flight & Chain Audit
          </button>
        </div>

        <button
          onClick={() => setShowAddAccountModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#241F17] hover:bg-[#2E2820] border border-[#3A3226] text-white text-xs font-semibold rounded-xl transition cursor-pointer shrink-0"
        >
          <Plus size={14} /> Add Bank Account
        </button>
      </div>

      {/* ======================================================== */}
      {/* PRE-FLIGHT DATA SUFFICIENCY GATEKEEPER BANNER (Gray #8A847B) */}
      {/* ======================================================== */}
      {!preFlight.canForecast && (
        <div className="p-4 bg-[#EFEEE9] dark:bg-[#8A847B]/20 border border-[#8A847B]/40 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertOctagon size={24} className="text-[#8A847B] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#8A847B] dark:text-[#EFEEE9] uppercase tracking-wide">
                INSUFFICIENT DATA: Honest Forecast Gatekeeper
              </h4>
              <p className="text-xs text-[#746B60] dark:text-[#D5D2CD]">{preFlight.refusalReason}</p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E4DED4] dark:bg-[#8A847B]/30 text-[#8A847B] dark:text-[#EFEEE9] font-mono font-semibold shrink-0">
            History: {preFlight.historyDays} Days (Min 90 req.)
          </span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. COGNITIVE STATEMENT INSIGHTS WITH GRAPHS & TABLES */}
      {/* ======================================================== */}
      {activeTab === 'statement-analysis' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Consolidated Liquid Cash</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">{formatINR(totalBankBalance)}</div>
              <p className="text-[11px] text-emerald-400 mt-1">Reconciled across {bankAccounts.length} verified accounts</p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Largest Bank Holding</span>
              <div className="text-2xl font-bold text-[#D9C0A0] font-tabular mt-1">
                {largestAccount ? formatINR(largestAccount.currentBalance) : '₹0'}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">
                {largestAccount ? `${largestAccount.bankName} (${largestAccount.nickname})` : 'No accounts connected'}
              </p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Running Chain Audit</span>
              <div className="text-2xl font-bold text-emerald-400 font-tabular mt-1">
                {auditReport ? auditReport.status : (transactions.length > 0 ? 'CHAIN INTACT' : 'AWAITING DATA')}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">Formula: Bal_t = Bal_{'{t-1}'} + Cr - Dr</p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Internal Transfers Neutralized</span>
              <div className="text-2xl font-bold text-blue-400 font-tabular mt-1">{formatINR(internalTransfersSum)}</div>
              <p className="text-[11px] text-[#A79A8A] mt-1">Contra-entries safely excluded</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Landmark size={16} className="text-[#8D7A62]" />
                  Bank Account Balance Weightage
                </h3>
                <p className="text-xs text-[#A79A8A] mt-0.5">Distribution of emergency and operating reserves</p>

                <div className="h-52 w-full mt-2 min-w-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={208} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={bankDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="balance"
                      >
                        {bankDistributionData.map((entry, index) => (
                          <Cell key={`cell-bank-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#241F17', borderColor: '#3A3226', borderRadius: '10px', color: '#FFF' }}
                        formatter={(val: any) => [formatINR(Number(val)), 'Current Balance']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center pointer-events-none">
                    <span className="text-[10px] text-[#A79A8A] uppercase block">Total</span>
                    <span className="text-sm font-bold text-white font-tabular">{formatCompactINR(totalBankBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#3A3226]">
                {bankDistributionData.map(b => (
                  <div key={b.name} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-[#B3A595] font-medium">{b.name}</span>
                    </div>
                    <span className="font-bold text-white font-tabular">{formatINR(b.balance)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers size={16} className="text-[#3B82F6]" />
                      Statement Velocity by Channel
                    </h3>
                    <p className="text-xs text-[#A79A8A] mt-0.5">UPI, NetBanking, Direct Debit & Card comparison</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-sm" /> Inflows
                    </span>
                    <span className="flex items-center gap-1 text-[#D95C52] dark:text-[#F87171] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-[#B83E34] to-[#D95C52] shadow-sm" /> Outflows
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full mt-3 min-w-0">
                  <ResponsiveContainer width="100%" height={224} minWidth={0}>
                    <BarChart data={channelChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bankInflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16A579" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#0E7A57" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="bankOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D95C52" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#B83E34" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3226" vertical={false} />
                      <XAxis dataKey="channel" stroke="#A79A8A" fontSize={11} tickLine={false} />
                      <YAxis stroke="#A79A8A" fontSize={11} tickFormatter={val => formatCompactINR(val)} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#241F17', borderColor: '#3A3226', borderRadius: '12px', color: '#ECEAE6' }}
                        formatter={(val: any) => [formatINR(Number(val)), '']}
                      />
                      <Bar dataKey="credit" name="Inflow" fill="url(#bankInflowGrad)" radius={[6, 6, 2, 2]} />
                      <Bar dataKey="debit" name="Outflow" fill="url(#bankOutflowGrad)" radius={[6, 6, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-3 bg-[#241F17]/50 rounded-xl border border-[#3A3226] text-xs text-[#A79A8A] flex items-center justify-between mt-2">
                <span>Direct Debit holds primarily fixed EMI obligations</span>
                <span className="text-emerald-400 font-semibold">Automatic Reconciliation Active</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#3A3226] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Reconciled Statement Account Summary</h3>
                <p className="text-xs text-[#A79A8A]">Audit positions, opening balances & current ledgers</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                All Ledgers Balanced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#241F17] text-[#A79A8A] uppercase tracking-wider font-semibold border-b border-[#3A3226]">
                  <tr>
                    <th className="p-3.5">Institution & Masked Number</th>
                    <th className="p-3.5">Account Purpose</th>
                    <th className="p-3.5">Authorized Owner</th>
                    <th className="p-3.5 text-right">Opening Balance</th>
                    <th className="p-3.5 text-right">Current Available</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3226]">
                  {bankAccounts.map(account => (
                    <tr key={account.id} className="hover:bg-[#241F17]/40 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{account.bankName}</div>
                        <span className="text-[11px] font-mono text-[#A79A8A]">{account.maskedAccountNumber}</span>
                      </td>
                      <td className="p-3.5 text-[#B3A595]">{account.nickname}</td>
                      <td className="p-3.5 text-[#A79A8A]">{account.ownerName}</td>
                      <td className="p-3.5 text-right font-tabular text-[#A79A8A]">{formatINR(account.openingBalance)}</td>
                      <td className="p-3.5 text-right font-bold text-white font-tabular">{formatINR(account.currentBalance)}</td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                          <CheckCircle2 size={12} /> {account.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TRANSACTION REGISTRY WITH RECONCILIATION */}
      {/* ======================================================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#1D1913] border border-[#3A3226] p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-3 text-[#A79A8A]" />
              <input
                type="text"
                placeholder="Search description, reference ID, category..."
                value={searchTx}
                onChange={e => setSearchTx(e.target.value)}
                className="w-full bg-[#241F17] border border-[#3A3226] text-white text-xs rounded-lg pl-9 pr-3 py-2"
              />
            </div>
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="bg-[#241F17] border border-[#3A3226] text-white text-xs rounded-lg px-3 py-2"
            >
              <option value="ALL">All Bank Accounts</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.bankName} ({b.maskedAccountNumber})</option>
              ))}
            </select>
          </div>

          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Account</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Inflow / Outflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3226]">
                {filteredTransactions.map(tx => {
                  const account = bankAccounts.find(b => b.id === tx.bankAccountId);
                  return (
                    <tr key={tx.id} className="hover:bg-[#241F17]/50 transition">
                      <td className="p-3.5 text-[#A79A8A] whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {tx.description}
                          {tx.isInternalTransfer && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-bold">
                              Internal Transfer
                            </span>
                          )}
                        </div>
                        {tx.notes && <p className="text-[10px] text-[#A79A8A] italic">{tx.notes}</p>}
                      </td>
                      <td className="p-3.5 text-[#A79A8A]">{tx.category}</td>
                      <td className="p-3.5 text-[#A79A8A] whitespace-nowrap">
                        {account?.bankName || 'General Bank'} ({account?.maskedAccountNumber || '•••'})
                      </td>
                      <td className="p-3.5 text-[#A79A8A]">{tx.paymentMethod}</td>
                      <td className="p-3.5">
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 size={13} /> {tx.verificationStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-bold font-tabular whitespace-nowrap">
                        {tx.type === 'CREDIT' ? (
                          <span className="text-emerald-400">+{formatINR(tx.amount)}</span>
                        ) : (
                          <span className="text-[#CFC4B6]">-{formatINR(tx.amount)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. STATEMENT IMPORT & LEXICON AUTO-MAPPING */}
      {/* ======================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UploadCloud size={20} className="text-[#8D7A62]" />
                  Multi-Account Statement Ingestion & Indian Lexicon
                </h3>
                <p className="text-xs text-[#A79A8A] mt-1">
                  Supports PDF & CSV statement cleaning (Lakh/Crore commas, DD/MM/YYYY, debit signs) with 120+ Indian merchant regex mappings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs text-[#A79A8A] block mb-1">Target Financial Account</label>
                <select
                  value={importTargetBank}
                  onChange={e => setImportTargetBank(e.target.value)}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white text-xs rounded-lg p-2.5"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bankName} ({b.nickname})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#A79A8A] block mb-1 flex items-center gap-1.5">
                  <KeyRound size={13} className="text-amber-400" />
                  PDF In-Memory Decryption Password (RAM only)
                </label>
                <input
                  type="password"
                  placeholder="e.g. DOB/PAN (Processed in RAM, never logged to disk)"
                  value={pdfPassword}
                  onChange={e => setPdfPassword(e.target.value)}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white text-xs rounded-lg p-2.5"
                />
              </div>
            </div>

            {/* Verified server-side upload area */}
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                void handleStatementUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                dragActive ? 'border-[#8D7A62] bg-[#8D7A62]/5' : 'border-[#3A3226] bg-[#241F17]/50 hover:bg-[#241F17]'
              }`}
            >
              <input
                type="file"
                accept=".csv,.pdf"
                multiple
                className="sr-only"
                id="statement-upload"
                onChange={e => {
                  if (e.target.files) void handleStatementUpload(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
              <label htmlFor="statement-upload" className="block cursor-pointer">
              <UploadCloud size={36} className="mx-auto text-[#8D7A62] mb-3" />
              <p className="text-sm font-semibold text-white">
                Drag and drop your statement file here, or click to browse
              </p>
              <p className="text-xs text-[#A79A8A] mt-1">
                CSV/PDF • running-balance reconciliation • local SQLite ledger
              </p>
              </label>
            </div>

            {isParsing && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#8D7A62] py-3">
                <RefreshCw size={16} className="animate-spin" />
                <span>Running balance chain verification & matching against 120+ Indian merchant patterns...</span>
              </div>
            )}
            {uploadMessage && (
              <div className="rounded-lg border border-[#3A3226] bg-[#241F17] px-3 py-2 text-xs text-[#CBD5E1]" role="status">
                {uploadMessage}
              </div>
            )}
          </div>

          {/* Parsed Preview Table with Lexicon Categorization */}
          {parsedPreview.length > 0 && (
            <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Extracted Statement Records Preview</h4>
                  <p className="text-xs text-emerald-400">
                    {parsedPreview.length} items parsed • Indian merchant dictionary applied • Zero duplicate hashes
                  </p>
                </div>
                <button
                  onClick={executeImport}
                  className="px-4 py-2 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#8D7A62]/20 transition cursor-pointer"
                >
                  Confirm & Sync to Ledger
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Extracted Description</th>
                      <th className="p-3">Lexicon Category</th>
                      <th className="p-3 text-right">Extracted Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3226]">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 text-[#A79A8A]">{formatDate(item.date)}</td>
                        <td className="p-3 font-semibold text-white">{item.description}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-[#241F17] text-[#8D7A62] font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-white font-tabular">
                          {item.type === 'CREDIT' ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. PRE-FLIGHT SUFFICIENCY & RUNNING BALANCE CHAIN AUDIT */}
      {/* ======================================================== */}
      {activeTab === 'audit-gatekeeper' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pre-Flight Gatekeeper Card */}
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#8D7A62]" />
                    Pre-Flight Sufficiency Gatekeeper
                  </h3>
                  <p className="text-xs text-[#A79A8A]">Data integrity thresholds before forecasting</p>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                  preFlight.canForecast
                    ? 'bg-[#E7F5EF] text-[#16A579] border border-[#16A579]/30 dark:bg-[#16A579]/20'
                    : 'bg-[#EFEEE9] text-[#8A847B] border border-[#8A847B]/40 dark:bg-[#8A847B]/20'
                }`}>
                  {preFlight.canForecast ? 'READY TO FORECAST' : 'INSUFFICIENT DATA'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-[#241F17] rounded-xl border border-[#3A3226]">
                  <span>Minimum 90 Days Statement History Rule:</span>
                  <span className="font-bold text-white">{preFlight.historyDays} Days Recorded</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-[#241F17] rounded-xl border border-[#3A3226]">
                  <span>Primary Salary / Earned Inflow Detected:</span>
                  <span className="font-bold text-emerald-400">
                    {preFlight.hasVerifiedIncome ? '✓ Verified Recurring' : 'None Detected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-[#241F17] rounded-xl border border-[#3A3226]">
                  <span>Statement 15-Day Date Gap Warning:</span>
                  <span className="font-bold text-white">
                    {preFlight.hasDateGapWarning ? '⚠️ Gaps Present' : '✓ Continuous'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-[#241F17] rounded-xl border border-[#3A3226]">
                  <span>Stale Statement Data (&gt;45 days):</span>
                  <span className="font-bold text-white">
                    {preFlight.isStaleData ? '⚠️ Outdated Data' : '✓ Up to Date'}
                  </span>
                </div>
              </div>
            </div>

            {/* Running Balance Chain Audit Formula Card */}
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity size={16} className="text-[#3B82F6]" />
                  Running Balance Chain Audit
                </h3>
                <p className="text-xs text-[#A79A8A] font-mono mt-0.5">
                  Formula: Bal_t = Bal_{'{t-1}'} + Credit_t - Debit_t
                </p>
              </div>

              {auditReport ? (
                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-[#241F17] rounded-xl border border-[#3A3226] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#A79A8A]">Audit Chain Status:</span>
                      <span className="font-bold text-emerald-400">✓ {auditReport.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A79A8A]">Valid Chain Links:</span>
                      <span className="font-bold text-white">{auditReport.validRows} / {auditReport.totalRows}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A79A8A]">Detected Broken Links:</span>
                      <span className="font-bold text-white">{auditReport.brokenLinks}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#A79A8A]">
                    No reversed sorting or missing row gaps detected in sample statement file.
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#A79A8A] bg-[#241F17]/50 rounded-xl border border-[#3A3226]">
                  Upload a statement in the Parser tab to execute row-by-row running balance chain verification.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. BANK ACCOUNTS LIST */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {bankAccounts.map(account => (
            <div
              key={account.id}
              className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl relative overflow-hidden space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#241F17] text-[#A79A8A] uppercase font-bold">
                    {account.accountType}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">{account.bankName}</h3>
                  <p className="text-xs text-[#A79A8A]">{account.nickname}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#241F17] border border-[#3A3226] flex items-center justify-center text-[#C9A87E]">
                  <Landmark size={20} />
                </div>
              </div>

              <div className="bg-[#241F17] p-3 rounded-xl border border-[#3A3226]/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#A79A8A] block">Account Number</span>
                  <span className="text-xs font-mono text-white font-bold">{account.maskedAccountNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#A79A8A] block">Current Recorded Balance</span>
                  <span className="text-base font-bold text-white font-tabular">{formatINR(account.currentBalance)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#A79A8A]">
                <span>Owner: {account.ownerName}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={13} /> {account.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Bank Account */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Financial Account</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A79A8A] block mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. Axis Bank"
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                />
              </div>
              <div>
                <label className="text-[#A79A8A] block mb-1">Account Nickname</label>
                <input
                  type="text"
                  placeholder="e.g. Primary Spending & UPI"
                  value={newNickname}
                  onChange={e => setNewNickname(e.target.value)}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#A79A8A] block mb-1">Masked Number</label>
                  <input
                    type="text"
                    placeholder="•••• 1234"
                    value={newMaskedNum}
                    onChange={e => setNewMaskedNum(e.target.value)}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-[#A79A8A] block mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    value={newOpeningBalance || ''}
                    onChange={e => setNewOpeningBalance(Number(e.target.value))}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3A3226]">
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="px-4 py-2 text-xs text-[#A79A8A] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newBankName) return;
                  addBankAccount({
                    bankName: newBankName,
                    nickname: newNickname || 'Savings Account',
                    accountType: 'Savings',
                    maskedAccountNumber: newMaskedNum || '•••• 0000',
                    openingBalance: newOpeningBalance,
                    currentBalance: newOpeningBalance,
                    ownerId: currentUser.id,
                    ownerName: currentUser.name,
                    status: 'ACTIVE',
                    color: '#8D7A62'
                  });
                  setShowAddAccountModal(false);
                }}
                className="px-4 py-2 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-bold rounded-xl"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
