"use client";

import { AppShell } from "@/components/AppShell";
import { GoalsInvestmentsModule } from "@/components/GoalsInvestmentsModule";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  return (
    <AppShell>
      <GoalsInvestmentsModule />
    </AppShell>
  );
}
