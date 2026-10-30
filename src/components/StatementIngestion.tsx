import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  ShieldCheck,
  FileSpreadsheet,
  AlertOctagon,
  FileUp,
} from 'lucide-react';
import { BankStatementFile } from '../types/finance';

interface StatementIngestionProps {
  files: BankStatementFile[];
  onUploadFile: (file: BankStatementFile) => void;
  onRequestUnlock: (file: BankStatementFile) => void;
  onSyncLedger: () => void;
  isSyncing: boolean;
  totalTransactionsCount: number;
}

export const StatementIngestion: React.FC<StatementIngestionProps> = ({
  files,
  onUploadFile,
  onRequestUnlock,
  onSyncLedger,
  isSyncing,
  totalTransactionsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSimulatedUpload(e.dataTransfer.files[0].name);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSimulatedUpload(e.target.files[0].name);
    }
  };

  const processSimulatedUpload = (name: string) => {
    const isPdf = name.toLowerCase().endsWith('.pdf');
    const newFile: BankStatementFile = {
      id: `file-custom-${Date.now()}`,
      fileName: name,
      accountLabel: 'HDFC - 9128',
      bankFormat: 'HDFC Bank',
      fileType: isPdf ? 'PDF' : 'CSV',
      status: 'RECONCILED',
      transactionCount: 48,
      dateRange: '01 Aug 2026 – 28 Oct 2026',
      openingBalance: 31000,
      closingBalance: 76500,
      calculatedClosingBalance: 76500,
      isReconciled: true,
    };
    onUploadFile(newFile);
  };

  const addSampleFile = (type: 'HDFC_CSV' | 'SBI_PDF' | 'PASSWORD_PDF' | 'SCANNED_PDF') => {
    const id = `file-sample-${Date.now()}`;
    if (type === 'HDFC_CSV') {
      onUploadFile({
        id,
        fileName: 'HDFC_Q3_NetBanking_Export.csv',
        accountLabel: 'HDFC - 1234',
        bankFormat: 'HDFC Bank',
        fileType: 'CSV',
        status: 'RECONCILED',
        transactionCount: 86,
        dateRange: '01 Jul 2026 – 25 Oct 2026',
        openingBalance: 52000,
        closingBalance: 124000,
        calculatedClosingBalance: 124000,
        isReconciled: true,
      });
    } else if (type === 'SBI_PDF') {
      onUploadFile({
        id,
        fileName: 'SBI_YONO_EStatement.pdf',
        accountLabel: 'SBI - 8890',
        bankFormat: 'State Bank of India',
        fileType: 'PDF',
        status: 'RECONCILED',
        transactionCount: 38,
        dateRange: '01 Jun 2026 – 20 Oct 2026',
        openingBalance: 18000,
        closingBalance: 24250,
        calculatedClosingBalance: 24250,
        isReconciled: true,
      });
    } else if (type === 'PASSWORD_PDF') {
      onUploadFile({
        id,
        fileName: 'ICICI_Secured_Statement_Q3.pdf',
        accountLabel: 'ICICI - 4402',
        bankFormat: 'ICICI Bank',
        fileType: 'PDF',
        status: 'PASSWORD_PROTECTED',
        transactionCount: 0,
        dateRange: 'Locked Document',
        openingBalance: 0,
        closingBalance: 0,
        calculatedClosingBalance: 0,
        isReconciled: false,
        passwordPromptNeeded: true,
      });
    } else {
      onUploadFile({
        id,
        fileName: 'Axis_Branch_Passbook_Scan_Raw.pdf',
        accountLabel: 'Axis - 9912',
        bankFormat: 'Axis Bank',
        fileType: 'PDF',
        status: 'SCANNED_NO_TEXT',
        transactionCount: 0,
        dateRange: 'Unreadable image raster',
        openingBalance: 0,
        closingBalance: 0,
        calculatedClosingBalance: 0,
        isReconciled: false,
      });
    }
  };

  const reconciledCount = files.filter((f) => f.status === 'RECONCILED').length;
  const warningCount = files.filter((f) => f.status !== 'RECONCILED').length;

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-xs mb-6">
      {/* Collapsible Bar Header */}
      <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Multi-Account Statement Ingestion
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({files.length} statements · {reconciledCount} reconciled
                {warningCount > 0 ? ` · ${warningCount} attention required` : ''})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSyncLedger}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{isSyncing ? 'Reconciling...' : 'Sync & Analyze Ledger'}</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expand Statement Panel' : 'Collapse Statement Panel'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Dropzone (4 cols on lg) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`lg:col-span-4 border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-2">
                <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Drop bank statements here
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Supports CSV & PDF exports (HDFC, SBI, ICICI, Axis)
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 w-full">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 w-full text-center">
                  Or load simulated test files:
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addSampleFile('HDFC_CSV');
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  + HDFC CSV
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addSampleFile('SBI_PDF');
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  + SBI PDF
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addSampleFile('PASSWORD_PDF');
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                >
                  + Encrypted PDF
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addSampleFile('SCANNED_PDF');
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 hover:bg-rose-100"
                >
                  + Scanned PDF
                </button>
              </div>
            </div>

            {/* Ingested File Status List (8 cols on lg) */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Ingested Statements & Validation Status
                </span>
                <span>
                  Total active parsed records:{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {totalTransactionsCount}
                  </strong>
                </span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {file.accountLabel}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            · {file.bankFormat} ({file.fileType})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                          {file.fileName} · {file.dateRange}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {file.status === 'RECONCILED' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">
                            Running balance reconciled
                          </span>
                          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 font-mono">
                            ({file.transactionCount} txns)
                          </span>
                        </div>
                      )}

                      {file.status === 'PASSWORD_PROTECTED' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 text-xs">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-medium">Password-Protected PDF</span>
                          </div>
                          <button
                            onClick={() => onRequestUnlock(file)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-colors"
                          >
                            Unlock
                          </button>
                        </div>
                      )}

                      {file.status === 'SCANNED_NO_TEXT' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 text-xs">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">
                            Scanned PDF (No text layer - use CSV)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
