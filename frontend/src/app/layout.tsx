import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/index.css";
import { AuthProvider } from "@/lib/authContext";
import { FinancialProvider } from "@/context/FinancialContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Money Matters",
  description:
    "Money Matters — Unified Wealth Ecosystem & Verifiable Affordability Engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-[#121008] text-[#ECEAE6]`}
      >
        <AuthProvider>
          <FinancialProvider>{children}</FinancialProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
