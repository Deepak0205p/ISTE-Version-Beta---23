"use client";

import { AppShell } from "@/components/AppShell";
import { AdvisorModule } from "@/components/AdvisorModule";

export const dynamic = "force-dynamic";

export default function AdvisorPage() {
  return (
    <AppShell fullWidth noPadding>
      <AdvisorModule />
    </AppShell>
  );
}
