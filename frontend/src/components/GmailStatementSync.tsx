"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authContext";
import { useFinancial } from "@/context/FinancialContext";
import {
  Mail,
  RefreshCw,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
  Sparkles,
  Info,
  Calendar,
  CreditCard,
  User,
  Phone
} from "lucide-react";

interface GmailStatus {
  success: boolean;
  configured: boolean;
  connected: boolean;
  userId: string;
  error?: string | null;
}

interface StatementSyncResult {
  success: boolean;
  userId: string;
  statements_synced: number;
  statements: Array<{
    bank_name: string;
    card_last_4_digits: string;
    statement_date: string;
    due_date: string;
    total_amount_due: number;
    minimum_amount_due: number;
    credit_limit?: number | null;
    hidden_charges_detected: boolean;
    hidden_charges_summary?: string | null;
    transactions: Array<{
      date: string;
      merchant: string;
      amount: number;
      type: "DEBIT" | "CREDIT";
      category: string;
    }>;
  }>;
  error?: string | null;
}

export function GmailStatementSync() {
  const { user } = useAuth();
  const { syncWithBackend } = useFinancial();

  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<StatementSyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User Profile Credentials for PDF Password Derivation
  const [fullName, setFullName] = useState<string>(user?.displayName || "Aman Yadav");
  const [dob, setDob] = useState<string>("2003-05-14");
  const [panNumber, setPanNumber] = useState<string>("ABCDE1234F");
  const [mobileNumber, setMobileNumber] = useState<string>("9876543210");
  const [cardLast4, setCardLast4] = useState<string>("4321");

  const effectiveUserId = user?.uid || user?.email || "default_user";

  // Check connection status
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/auth/google/status?userId=${encodeURIComponent(effectiveUserId)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({
          success: false,
          configured: false,
          connected: false,
          userId: effectiveUserId,
          error: "Ingestion service not reachable."
        });
      }
    } catch (e) {
      setStatus({
        success: false,
        configured: false,
        connected: false,
        userId: effectiveUserId,
        error: "Failed to connect to ingestion server."
      });
    } finally {
      setIsLoadingStatus(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle URL params for redirect feedback (e.g. ?gmail_sync=success)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("gmail_sync") === "success") {
        fetchStatus();
      } else if (params.get("gmail_sync") === "denied") {
        setErrorMessage("Gmail authorization was cancelled or denied by user.");
      }
    }
  }, [fetchStatus]);

  // Connect Gmail: generate OAuth URL and redirect
  const handleConnectGmail = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/auth/google/url?userId=${encodeURIComponent(effectiveUserId)}`);
      const data = await res.json();

      if (data.configured === false) {
        setErrorMessage(
          data.message ||
          "Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env."
        );
        return;
      }

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setErrorMessage(data.error || "Failed to acquire Google authorization URL.");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to initiate Gmail OAuth.");
    }
  };

  // Trigger Statement Sync
  const handleSyncStatements = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSyncResult(null);

    const profilePayload = {
      full_name: fullName,
      dob: dob,
      pan_number: panNumber.toUpperCase(),
      registered_mobile: mobileNumber,
      known_cards: {
        HDFC: cardLast4,
        SBI: cardLast4,
        ICICI: cardLast4,
        Axis: cardLast4,
      }
    };

    try {
      const res = await fetch(`/sync-statements/${encodeURIComponent(effectiveUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Sync failed.");
      }

      setSyncResult(data);
      // Immediately refresh financial context ledger
      await syncWithBackend();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to sync statements from Gmail.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner / Integration Explanation */}
      <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Mail size={160} className="text-[#C9A87E]" />
        </div>

        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A87E]/10 border border-[#C9A87E]/20 text-[#C9A87E] text-xs font-semibold">
            <Sparkles size={13} />
            <span>Automated Gmail E-Statement Pipeline</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Connect Gmail & Auto-Ingest Bank E-Statements
          </h2>
          <p className="text-xs sm:text-sm text-[#A79A8A] leading-relaxed">
            Directly fetch credit card statements (HDFC, SBI, ICICI, Axis) from your inbox using secure Google OAuth 2.0 with read-only scope (<code className="text-[#D9C0A0] text-xs font-mono">gmail.readonly</code>). The backend decrypts statements in-memory via <strong className="text-white">pikepdf</strong> and runs multimodal AI extraction with <strong className="text-white">Gemini</strong> to flag hidden fees and record transactions into Firestore.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="mt-6 pt-5 border-t border-[#2C261E] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#A79A8A]">Connection Status:</span>
            {isLoadingStatus ? (
              <span className="text-xs text-[#A79A8A] flex items-center gap-1.5">
                <RefreshCw size={12} className="animate-spin text-[#C9A87E]" /> Checking status...
              </span>
            ) : status?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 size={13} /> Gmail Connected & Tokens Active
              </span>
            ) : status?.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                <AlertTriangle size={13} /> Ready to Connect (Not Linked)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <AlertTriangle size={13} /> OAuth Setup Needed in .env
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              className="p-2 text-xs text-[#A79A8A] hover:text-white rounded-lg hover:bg-[#241F17] transition border border-transparent hover:border-[#3A3226]"
              title="Refresh status"
            >
              <RefreshCw size={14} className={isLoadingStatus ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleConnectGmail}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A87E] hover:bg-[#D9C0A0] text-[#121008] font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              <Mail size={14} />
              <span>{status?.connected ? "Re-authorize Gmail" : "Connect with Google Gmail"}</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Error or Alert banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold text-rose-200">
            <AlertTriangle size={15} />
            <span>Notice</span>
          </div>
          <p>{errorMessage}</p>
          {!status?.configured && (
            <p className="text-[11px] text-rose-400/80 mt-1">
              Add <code className="text-white font-mono">GOOGLE_CLIENT_ID</code> and <code className="text-white font-mono">GOOGLE_CLIENT_SECRET</code> into <code className="text-white font-mono">backend/.env</code> from your Google Cloud Console (OAuth 2.0 Client ID) to enable real-time Gmail OAuth sync.
            </p>
          )}
        </div>
      )}

      {/* Two Column Section: Password Derivation Configuration + Sync Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: User Identifier Profile for Password Generation */}
        <div className="lg:col-span-2 bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#2C261E]">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Key size={16} className="text-[#C9A87E]" />
              <span>Statement Decryption Profile Identifiers</span>
            </div>
            <span className="text-[11px] text-[#A79A8A]">Used strictly in-memory</span>
          </div>

          <p className="text-xs text-[#A79A8A] leading-relaxed">
            Bank statements use standard Indian encryption rules (e.g. HDFC = First 4 name letters + DDMM, SBI = DDMM + Card digits, ICICI = First 4 letters lowercase + DDMM). These identifiers are passed to <strong className="text-white">pikepdf</strong> to decrypt PDF byte streams purely in RAM without writing raw files to disk.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[#A79A8A] font-medium flex items-center gap-1.5">
                <User size={13} className="text-[#C9A87E]" /> Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aman Yadav"
                className="w-full bg-[#161512] border border-[#3A3226] rounded-xl px-3 py-2.5 text-white placeholder-[#5A5248] focus:border-[#C9A87E] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#A79A8A] font-medium flex items-center gap-1.5">
                <Calendar size={13} className="text-[#C9A87E]" /> Date of Birth (YYYY-MM-DD)
              </label>
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="YYYY-MM-DD (e.g. 2003-05-14)"
                className="w-full bg-[#161512] border border-[#3A3226] rounded-xl px-3 py-2.5 text-white placeholder-[#5A5248] focus:border-[#C9A87E] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#A79A8A] font-medium flex items-center gap-1.5">
                <Lock size={13} className="text-[#C9A87E]" /> PAN Number
              </label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                placeholder="10-digit PAN (e.g. ABCDE1234F)"
                className="w-full bg-[#161512] border border-[#3A3226] rounded-xl px-3 py-2.5 text-white uppercase placeholder-[#5A5248] focus:border-[#C9A87E] focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#A79A8A] font-medium flex items-center gap-1.5">
                <Phone size={13} className="text-[#C9A87E]" /> Registered Mobile Number
              </label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full bg-[#161512] border border-[#3A3226] rounded-xl px-3 py-2.5 text-white placeholder-[#5A5248] focus:border-[#C9A87E] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[#A79A8A] font-medium flex items-center gap-1.5">
                <CreditCard size={13} className="text-[#C9A87E]" /> Known Card (Last 4 digits for SBI/Axis)
              </label>
              <input
                type="text"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value)}
                placeholder="e.g. 4321"
                maxLength={4}
                className="w-full bg-[#161512] border border-[#3A3226] rounded-xl px-3 py-2.5 text-white placeholder-[#5A5248] focus:border-[#C9A87E] focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Trigger Button */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#A79A8A]">
              Triggers Gmail query: <code className="text-[#D9C0A0]">from:(*@hdfcbank.com OR *@sbicard.com) has:attachment</code>
            </span>
            <button
              onClick={status?.connected ? handleSyncStatements : handleConnectGmail}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                isSyncing
                  ? "bg-[#241F17] text-[#A79A8A] cursor-not-allowed"
                  : status?.connected
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-[#C9A87E] hover:bg-[#D9C0A0] text-[#121008] shadow-lg shadow-[#C9A87E]/20"
              }`}
            >
              {status?.connected ? (
                <>
                  <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                  <span>{isSyncing ? "Ingesting Statements..." : "Sync Bank Statements Now"}</span>
                </>
              ) : (
                <>
                  <Mail size={14} />
                  <span>Step 1: Connect Gmail Account First</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 1 Col: Security & Privacy Guarantees */}
        <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm pb-2 border-b border-[#2C261E]">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Privacy & Architecture</span>
            </div>

            <div className="space-y-3 text-xs text-[#A79A8A]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">RAM Decryption Only</strong>
                  Zero raw or decrypted PDF bytes touch disk storage. pikepdf executes in-memory.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Gemini Multimodal AI</strong>
                  Pydantic JSON schema parses transactions, interest penalties, and hidden GST charges directly.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Firestore Idempotency</strong>
                  Statements deduplicate by hash and bank statement cycle date.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#161512] rounded-xl border border-[#2C261E] text-[11px] text-[#A79A8A] flex items-center gap-2">
            <Info size={14} className="text-[#C9A87E] shrink-0" />
            <span>Automated recurring sync runs continuously once tokens are stored in Firestore.</span>
          </div>
        </div>
      </div>

      {/* Sync Results View */}
      {syncResult && (
        <div className="p-5 rounded-2xl bg-[#1D1913] border border-emerald-500/30 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>Sync Completed Successfully</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-mono">
              {syncResult.statements_synced} statement(s) ingested
            </span>
          </div>

          {syncResult.statements.length === 0 ? (
            <p className="text-xs text-[#A79A8A]">
              No new bank e-statements found matching the search filter in this inbox. Statements will auto-sync as soon as your bank sends the monthly email!
            </p>
          ) : (
            <div className="space-y-3">
              {syncResult.statements.map((stmt, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#161512] border border-[#3A3226] text-xs space-y-2">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>{stmt.bank_name} Credit Card (Ending {stmt.card_last_4_digits})</span>
                    <span className="text-emerald-400 font-mono">Total Due: ₹{stmt.total_amount_due.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#A79A8A]">
                    <div>Statement Date: {stmt.statement_date}</div>
                    <div>Payment Due: {stmt.due_date}</div>
                    <div>Min Due: ₹{stmt.minimum_amount_due}</div>
                    <div>Transactions: {stmt.transactions.length} rows</div>
                  </div>
                  {stmt.hidden_charges_detected && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                      ⚠️ <strong>Hidden Charges Detected:</strong> {stmt.hidden_charges_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
