"use client";

import { AppShell } from "@/components/AppShell";
import { MoneyManagementModule } from "@/components/MoneyManagementModule";

export const dynamic = "force-dynamic";

export default function MoneyManagementPage() {
  return (
    <AppShell>
      <MoneyManagementModule />
    </AppShell>
  );
}
