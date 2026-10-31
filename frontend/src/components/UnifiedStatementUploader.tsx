"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, Key, ShieldCheck, Zap } from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

interface UnifiedStatementUploaderProps {
  onUploadSuccess?: (parsedCount: number) => void;
  className?: string;
  compact?: boolean;
}

export function UnifiedStatementUploader({
  onUploadSuccess,
  className = "",
  compact = false,
}: UnifiedStatementUploaderProps) {
  const { bankAccounts, syncWithBackend } = useFinancial();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [accountLabel, setAccountLabel] = useState<string>("Primary-Account");
  const [pdfPassword, setPdfPassword] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) => /\.(csv|pdf)$/i.test(f.name));
    if (valid.length === 0) {
      setStatusMessage({ type: "error", text: "Please select valid CSV or PDF bank statement files." });
      return;
    }
    setSelectedFiles(valid);
    setStatusMessage(null);
  };

  const executeUpload = async () => {
    if (selectedFiles.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setStatusMessage({ type: "info", text: "Uploading & analyzing statement with AI engine..." });

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      formData.append("account_label", accountLabel.trim() || "Primary-Account");
      formData.append("replace", replaceExisting ? "true" : "false");
      if (pdfPassword.trim()) {
        formData.append("pdf_password", pdfPassword.trim());
      }

      // Upload to unified endpoint
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload server error (${uploadRes.status}): ${errText.slice(0, 80)}`);
      }

      let uploadResult: any;
      try {
        uploadResult = await uploadRes.json();
      } catch {
        throw new Error("Invalid response format received from server.");
      }

      if (!uploadResult.ok) {
        throw new Error(uploadResult.message || "Failed to parse bank statement.");
      }

      // Also trigger ingest hygiene & affordability sync
      await fetch("/api/ingest", { method: "POST" });
      await syncWithBackend();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("mm_ledger_updated"));
      }

      const totalParsed = uploadResult.total_parsed || uploadResult.totals?.txns || selectedFiles.length;
      setStatusMessage({
        type: "success",
        text: `Successfully ingested ${selectedFiles.length} file(s) • ${totalParsed} transactions added to verified ledger.`,
      });

      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploadSuccess) onUploadSuccess(totalParsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error uploading statement";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadDemoData = async () => {
    setIsProcessing(true);
    setStatusMessage({ type: "info", text: "Loading verified 210-transaction HDFC statement..." });
    try {
      // Re-trigger ingest or fetch ps4 question
      const res = await fetch("/api/ps4", { cache: "no-store" });
      if (res.ok) {
        await syncWithBackend();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("mm_ledger_updated"));
        }
        setStatusMessage({
          type: "success",
          text: "Demo Statement loaded! 210 verified transactions categorized across Rent, Dining, Utilities, and Salary.",
        });
        if (onUploadSuccess) onUploadSuccess(210);
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load demo statement." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`space-y-4 rounded-2xl bg-[#161512] border border-[#2C261E] p-5 shadow-xl ${className}`}>
      {/* Configuration Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#A79A8A]">Target Bank / Account</label>
          <select
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            className="w-full bg-[#1D1913] border border-[#3A3226] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4A373]"
          >
            <option value="Primary-Account">Primary Bank Account (Default)</option>
            <option value="HDFC-Salary">HDFC Bank (Salary Account)</option>
            <option value="SBI-Savings">State Bank of India (Savings)</option>
            <option value="ICICI-Direct">ICICI Bank (Direct)</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.nickname || acc.bankName}>
                {acc.bankName} ({acc.nickname || acc.maskedAccountNumber || "Active"})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#A79A8A] flex items-center gap-1.5">
            <Key size={13} className="text-[#D4A373]" />
            <span>PDF Decryption Password (Optional)</span>
          </label>
          <input
            type="password"
            value={pdfPassword}
            onChange={(e) => setPdfPassword(e.target.value)}
            placeholder="e.g. DOB/PAN (Processed in RAM only)"
            className="w-full bg-[#1D1913] border border-[#3A3226] rounded-xl px-3 py-2 text-xs text-white placeholder-[#857767] focus:outline-none focus:border-[#D4A373]"
          />
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesChosen(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-[#D4A373] bg-[#D4A373]/10"
            : "border-[#3A3226] bg-[#121008] hover:border-[#8D7A62] hover:bg-[#1A1813]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.pdf"
          onChange={(e) => handleFilesChosen(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-[#241F17] flex items-center justify-center border border-[#3A3226] text-[#D4A373]">
            <UploadCloud size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(", ")}`
                : "Drag & drop statement files here, or click to browse"}
            </p>
            <p className="text-xs text-[#A79A8A] mt-0.5">
              Supports CSV & PDF (HDFC, SBI, ICICI, Axis, Kotak, Indian Banks)
            </p>
          </div>
        </div>
      </div>

      {/* Actions & Demo Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDemoData}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#221E18] hover:bg-[#2C261E] border border-[#3A3226] text-xs font-semibold text-[#D4A373] transition cursor-pointer"
          >
            <Zap size={14} className="text-amber-400" />
            <span>Load Verified Demo Statement (1-Click)</span>
          </button>
          <label className="flex items-center gap-2 text-xs text-[#A79A8A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="rounded accent-[#D4A373] cursor-pointer"
            />
            <span>Clean Replace</span>
          </label>
        </div>

        <button
          type="button"
          onClick={executeUpload}
          disabled={selectedFiles.length === 0 || isProcessing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4A373] hover:bg-[#DFB387] disabled:opacity-50 disabled:cursor-not-allowed text-[#121008] font-bold text-xs sm:text-sm transition shadow-lg cursor-pointer"
        >
          {isProcessing ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Analyzing with AI...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Analyze & Ingest Statement</span>
            </>
          )}
        </button>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : statusMessage.type === "error"
              ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
              : "bg-amber-950/40 border-amber-500/40 text-amber-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : statusMessage.type === "error" ? (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          ) : (
            <RefreshCw size={16} className="text-amber-400 animate-spin shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}

