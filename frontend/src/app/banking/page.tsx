"use client";

import { AppShell } from "@/components/AppShell";
import { BankingModule } from "@/components/BankingModule";

export const dynamic = "force-dynamic";

export default function BankingPage() {
  return (
    <AppShell>
      <BankingModule />
    </AppShell>
  );
}
