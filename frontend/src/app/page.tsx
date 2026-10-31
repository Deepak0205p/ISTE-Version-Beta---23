"use client";

import { AppShell } from "@/components/AppShell";
import { OverviewModule } from "@/components/OverviewModule";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell>
      <OverviewModule />
    </AppShell>
  );
}
