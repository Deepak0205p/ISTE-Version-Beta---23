import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]">
      <h2 className="text-3xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-sm text-black dark:text-[#94A3B8] mb-6">
        Could not find requested resource.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition"
      >
        Return to Overview
      </Link>
    </div>
  );
}
