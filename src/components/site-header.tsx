import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/", label: "Ask" },
  { href: "/upload", label: "Upload" },
  { href: "/#ledger", label: "Ledger" },
];

export function SiteHeader() {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <Wallet className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Can I Afford It Next Month?
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            PS4 · full build
          </Badge>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
