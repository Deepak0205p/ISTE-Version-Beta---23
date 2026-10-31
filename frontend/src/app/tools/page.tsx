"use client";

import { AppShell } from "@/components/AppShell";
import { FinancialToolsModule } from "@/components/FinancialToolsModule";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  return (
    <AppShell>
      <FinancialToolsModule />
    </AppShell>
  );
}
