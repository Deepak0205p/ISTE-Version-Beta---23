"use client";

import { AppShell } from "@/components/AppShell";
import { ReportsModule } from "@/components/ReportsModule";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsModule />
    </AppShell>
  );
}
