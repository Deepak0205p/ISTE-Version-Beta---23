"use client";

/**
 * Client-side data hooks — thin fetchers over the API routes.
 * All heavy math stays server-side (or in pure functions already shipped
 * to the client via mathEngine imports).
 */
import { useCallback, useEffect, useState } from "react";
import type { LedgerTxn } from "@/lib/types";

export type IngestResponse = {
  ok: boolean;
  totals: { txns: number; accounts: number; first_date: string | null; last_date: string | null };
  accounts: { id: string; bank: string; label: string; last4: string | null }[];
  aliases: { pattern: string; category: string }[];
  transactions: LedgerTxn[];
  counts: {
    dup_p: number;
    transfers: number;
    card_bills: number;
    netted: number;
    anomalies: number;
    user_duplicates: number;
    one_off_income: number;
    uncategorized: number;
  };
  warnings: string[];
  message?: string;
};

export function useLedger(refreshKey = 0) {
  const [data, setData] = useState<IngestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", { cache: "no-store" });
      const json = (await res.json()) as IngestResponse;
      setData(json);
      setError(null);
    } catch {
      setError("Could not load the ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();

    const handleUpdate = () => {
      void reload();
    };

    window.addEventListener('mm_ledger_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    const interval = setInterval(() => {
      void reload();
    }, 8000);

    return () => {
      window.removeEventListener('mm_ledger_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [reload, refreshKey]);

  return { data, loading, error, reload };
}

export type ForecastResponse = {
  ok: boolean;
  band: { p10: number; p50: number; p90: number } | null;
  meta: Record<string, unknown>;
  balance_paise: number;
  months_of_data: number;
  needs: string | null;
  message?: string;
};

export function useForecast(refreshKey = 0) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/forecast", { cache: "no-store" });
      setData((await res.json()) as ForecastResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { data, loading, reload };
}
