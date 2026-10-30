import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { Header } from './components/Header';
import { StatementIngestion } from './components/StatementIngestion';
import { AffordabilityHero } from './components/AffordabilityHero';
import { VerdictCard } from './components/VerdictCard';
import { ForecastDistribution } from './components/ForecastDistribution';
import { TransparentReceiptDrawer } from './components/TransparentReceiptDrawer';
import { LedgerTable } from './components/LedgerTable';
import { PasswordUnlockModal } from './components/PasswordUnlockModal';
import { PERSONAS } from './mock/personasData';
import {
  BankStatementFile,
  Transaction,
  PersonaProfile,
  VerdictType,
} from './types/finance';
import {
  runMovingBlockBootstrap,
  calculateRecommendedBuffer,
  computeVerdict,
  parseAffordabilityQuery,
  generateAuditReceipt,
} from './utils/bootstrapEngine';

export default function App() {
  // Dark mode state: default to dark for sleek fintech appearance
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Seed & Engine state
  const [seed, setSeed] = useState<number>(42);

  // Active persona and local mutable state
  const [activePersonaId, setActivePersonaId] = useState<'rohan' | 'meera' | 'arjun'>('rohan');
  const [personasData, setPersonasData] = useState<Record<string, PersonaProfile>>(() =>
    JSON.parse(JSON.stringify(PERSONAS))
  );

  const activePersona = personasData[activePersonaId];

  // Affordability query state
  const [currentQuery, setCurrentQuery] = useState(activePersona.defaultQuestion);
  const [parsedItem, setParsedItem] = useState('Laptop');
  const [parsedAmount, setParsedAmount] = useState<number>(activePersona.defaultPrice);

  // Account filter
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');

  // Loading and recalculation states
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [learnedRuleNotice, setLearnedRuleNotice] = useState<string | null>(null);

  // Password unlock modal state
  const [unlockModalFile, setUnlockModalFile] = useState<BankStatementFile | null>(null);

  // Buffer components calculation
  const bufferComponents = useMemo(() => {
    return calculateRecommendedBuffer(activePersona.transactions, activePersona.archetype);
  }, [activePersona.transactions, activePersona.archetype]);

  // User interactive buffer slider state
  const [userBuffer, setUserBuffer] = useState<number>(bufferComponents.userBufferTotal);

  // Update buffer default whenever active persona changes
  useEffect(() => {
    setUserBuffer(bufferComponents.userBufferTotal);
  }, [activePersonaId, bufferComponents.userBufferTotal]);

  // Initialize query when persona changes
  const handleSelectPersona = (pId: 'rohan' | 'meera' | 'arjun') => {
    setActivePersonaId(pId);
    const p = personasData[pId];
    setCurrentQuery(p.defaultQuestion);
    const parsed = parseAffordabilityQuery(p.defaultQuestion);
    setParsedItem(parsed.parsedItem || 'Planned Item');
    setParsedAmount(parsed.parsedAmount ?? p.defaultPrice);
    setSelectedAccount('ALL');
  };

  // Sync / query parser effect
  const handleRunQueryCheck = () => {
    setIsCalculating(true);
    const parsed = parseAffordabilityQuery(currentQuery);
    setParsedItem(parsed.parsedItem);
    if (parsed.parsedAmount) {
      setParsedAmount(parsed.parsedAmount);
    }
    setTimeout(() => {
      setIsCalculating(false);
    }, 450);
  };

  const handleUpdateManualPrice = (newPrice: number) => {
    setParsedAmount(newPrice);
    setCurrentQuery(`Can I afford a ${newPrice.toLocaleString('en-IN')} ${parsedItem} next month?`);
  };

  // Filter transactions by selected account
  const filteredTransactions = useMemo(() => {
    if (selectedAccount === 'ALL') {
      return activePersona.transactions;
    }
    return activePersona.transactions.filter((t) => t.account === selectedAccount);
  }, [activePersona.transactions, selectedAccount]);

  // Distinct accounts available
  const availableAccounts = useMemo(() => {
    const accSet = new Set<string>();
    activePersona.transactions.forEach((t) => accSet.add(t.account));
    return Array.from(accSet);
  }, [activePersona.transactions]);

  // Run Bootstrap forecast calculation
  const forecast = useMemo(() => {
    return runMovingBlockBootstrap(
      filteredTransactions,
      activePersona.currentBalance,
      parsedAmount,
      activePersona.monthsOfData,
      seed,
      500
    );
  }, [
    filteredTransactions,
    activePersona.currentBalance,
    parsedAmount,
    activePersona.monthsOfData,
    seed,
  ]);

  // Compute deterministic verdict
  const verdict: VerdictType = useMemo(() => {
    return computeVerdict(
      activePersona.monthsOfData,
      forecast.p10,
      forecast.p50,
      userBuffer
    );
  }, [activePersona.monthsOfData, forecast.p10, forecast.p50, userBuffer]);

  // Generate transparent audit receipt
  const auditReceipt = useMemo(() => {
    return generateAuditReceipt(
      activePersona.name,
      selectedAccount === 'ALL' ? availableAccounts : [selectedAccount],
      filteredTransactions,
      activePersona.currentBalance,
      parsedAmount,
      userBuffer,
      forecast,
      verdict,
      activePersona.monthsOfData,
      seed
    );
  }, [
    activePersona.name,
    selectedAccount,
    availableAccounts,
    filteredTransactions,
    activePersona.currentBalance,
    parsedAmount,
    userBuffer,
    forecast,
    verdict,
    activePersona.monthsOfData,
    seed,
  ]);

  // Handlers for interactive actions
  const handleUploadFile = (newFile: BankStatementFile) => {
    setPersonasData((prev) => {
      const current = prev[activePersonaId];
      return {
        ...prev,
        [activePersonaId]: {
          ...current,
          files: [newFile, ...current.files],
        },
      };
    });
  };

  const handleUnlockSuccess = (fileId: string) => {
    setPersonasData((prev) => {
      const current = prev[activePersonaId];
      const updatedFiles = current.files.map((f) => {
        if (f.id === fileId) {
          return {
            ...f,
            status: 'RECONCILED' as const,
            transactionCount: 34,
            dateRange: '01 Jul 2026 – 28 Oct 2026',
            openingBalance: 14200,
            closingBalance: 39500,
            calculatedClosingBalance: 39500,
            isReconciled: true,
            passwordPromptNeeded: false,
          };
        }
        return f;
      });

      // Inject unlocked transactions
      const newTx: Transaction = {
        id: `tx-unlocked-${Date.now()}`,
        date: '2026-10-19',
        rawNarration: 'E-STATEMENT DECRYPTED ICICI SALARY ACC',
        normalizedMerchant: 'ICICI Reconciled Inflow',
        category: 'Income & Salary',
        account: 'ICICI - 4402',
        type: 'CREDIT',
        amount: 25300,
      };

      return {
        ...prev,
        [activePersonaId]: {
          ...current,
          files: updatedFiles,
          transactions: [newTx, ...current.transactions],
          currentBalance: current.currentBalance + 25300,
        },
      };
    });
  };

  const handleSyncLedger = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLearnedRuleNotice('Ledger reconciled: 0 parsing drift detected across accounts.');
      setTimeout(() => setLearnedRuleNotice(null), 4000);
    }, 700);
  };

  const handleUpdateCategory = (txnId: string, newCategory: string) => {
    let merchantName = '';
    setPersonasData((prev) => {
      const current = prev[activePersonaId];
      const updatedTxns = current.transactions.map((t) => {
        if (t.id === txnId) {
          merchantName = t.normalizedMerchant;
          return { ...t, category: newCategory };
        }
        return t;
      });
      return {
        ...prev,
        [activePersonaId]: {
          ...current,
          transactions: updatedTxns,
        },
      };
    });

    setLearnedRuleNotice(
      `Rule learned: All future transactions from "${merchantName || 'Merchant'}" will automatically categorize as "${newCategory}".`
    );
    setTimeout(() => setLearnedRuleNotice(null), 5000);
  };

  const handleResolveDuplicate = (txnId: string, action: 'KEEP' | 'MERGE') => {
    setPersonasData((prev) => {
      const current = prev[activePersonaId];
      const updatedTxns = current.transactions.map((t) => {
        if (t.id === txnId) {
          if (action === 'MERGE') {
            return {
              ...t,
              duplicateMergedWith: 'primary',
              isExcludedFromBootstrap: true,
            };
          } else {
            return {
              ...t,
              anomaly: 'NORMAL' as const,
              anomalyDetails: 'Verified as legitimate secondary charge',
            };
          }
        }
        return t;
      });

      return {
        ...prev,
        [activePersonaId]: {
          ...current,
          transactions: updatedTxns,
        },
      };
    });
  };

  const handleToggleMadExclusion = (txnId: string) => {
    setPersonasData((prev) => {
      const current = prev[activePersonaId];
      const updatedTxns = current.transactions.map((t) => {
        if (t.id === txnId) {
          const newOverride = !t.isManualOverride;
          return {
            ...t,
            isManualOverride: newOverride,
            isExcludedFromBootstrap: !newOverride,
          };
        }
        return t;
      });
      return {
        ...prev,
        [activePersonaId]: {
          ...current,
          transactions: updatedTxns,
        },
      };
    });
  };

  // Arjun simulate 6-month ingestion
  const handleExtendArjunHistory = () => {
    setPersonasData((prev) => {
      const current = prev['arjun'];
      const extendedTxns: Transaction[] = [
        ...current.transactions,
        {
          id: 'a-hist-1',
          date: '2026-08-01',
          rawNarration: 'SALARY CREDIT/INFOSYS TECHNOLOGIES',
          normalizedMerchant: 'Infosys Ltd (Salary)',
          category: 'Income & Salary',
          account: 'SBI - 8890',
          type: 'CREDIT',
          amount: 32000,
        },
        {
          id: 'a-hist-2',
          date: '2026-07-01',
          rawNarration: 'SALARY CREDIT/INFOSYS TECHNOLOGIES',
          normalizedMerchant: 'Infosys Ltd (Salary)',
          category: 'Income & Salary',
          account: 'SBI - 8890',
          type: 'CREDIT',
          amount: 32000,
        },
        {
          id: 'a-hist-3',
          date: '2026-06-01',
          rawNarration: 'JOINING BONUS / SIGN-ON',
          normalizedMerchant: 'Infosys Sign-On Bonus',
          category: 'Income & Salary',
          account: 'SBI - 8890',
          type: 'CREDIT',
          amount: 25000,
        },
      ];

      return {
        ...prev,
        arjun: {
          ...current,
          monthsOfData: 6,
          currentBalance: 58400,
          transactions: extendedTxns,
          description:
            'Extended to 6 months of historical statements (+120 days). Bootstrap engine active!',
        },
      };
    });
  };

  const cycleSeed = () => {
    setSeed((prev) => (prev === 42 ? 108 : prev === 108 ? 777 : 42));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header & Navigation */}
      <Header
        selectedAccount={selectedAccount}
        onSelectAccount={setSelectedAccount}
        availableAccounts={availableAccounts}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        seed={seed}
        onCycleSeed={cycleSeed}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Section 2: Multi-Account Statement Ingestion Section */}
        <StatementIngestion
          files={activePersona.files}
          onUploadFile={handleUploadFile}
          onRequestUnlock={(f) => setUnlockModalFile(f)}
          onSyncLedger={handleSyncLedger}
          isSyncing={isSyncing}
          totalTransactionsCount={filteredTransactions.length}
        />

        {/* Section 3: Affordability Question Input (Hero Section) */}
        <AffordabilityHero
          currentQuery={currentQuery}
          onChangeQuery={setCurrentQuery}
          onSubmitQuery={handleRunQueryCheck}
          isLoading={isCalculating}
          activePersonaId={activePersonaId}
          onSelectPersona={handleSelectPersona}
          personas={personasData}
          parsedItem={parsedItem}
          parsedAmount={parsedAmount}
          onUpdateManualPrice={handleUpdateManualPrice}
        />

        {/* Section 4: Verdict & Forecast Display (The Core Feature) */}
        {isCalculating ? (
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xs animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            <div className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          </div>
        ) : (
          <>
            <VerdictCard
              verdict={verdict}
              itemPrice={parsedAmount}
              itemName={parsedItem}
              currentBalance={activePersona.currentBalance}
              forecast={forecast}
              safetyBuffer={userBuffer}
              monthsOfData={activePersona.monthsOfData}
              onSimulateExtendHistory={
                activePersonaId === 'arjun' ? handleExtendArjunHistory : undefined
              }
            />

            <ForecastDistribution
              forecast={forecast}
              bufferComponents={bufferComponents}
              currentBuffer={userBuffer}
              onChangeBuffer={setUserBuffer}
              currentBalance={activePersona.currentBalance}
              itemPrice={parsedAmount}
            />
          </>
        )}

        {/* Section 5: Transparent Receipt Panel (Collapsible / Slide-over Drawer) */}
        <TransparentReceiptDrawer receipt={auditReceipt} />

        {/* Section 6: Clean Ledger Table & Anomaly Flags (Bottom Section) */}
        <LedgerTable
          transactions={filteredTransactions}
          onUpdateCategory={handleUpdateCategory}
          onResolveDuplicate={handleResolveDuplicate}
          onToggleMadExclusion={handleToggleMadExclusion}
          learnedRuleNotice={learnedRuleNotice}
        />
      </main>

      {/* Password Unlock Modal for Encrypted PDFs */}
      <PasswordUnlockModal
        file={unlockModalFile}
        isOpen={!!unlockModalFile}
        onClose={() => setUnlockModalFile(null)}
        onUnlockSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
