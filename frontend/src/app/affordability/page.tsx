"use client";

import { AppShell } from "@/components/AppShell";
import { AffordabilityWorkspace } from "@/components/AffordabilityWorkspace";

export const dynamic = "force-dynamic";

export default function AffordabilityPage() {
  return (
    <AppShell>
      <AffordabilityWorkspace />
    </AppShell>
  );
}
