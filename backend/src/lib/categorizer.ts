/**
 * Categorization funnel (Build Bible §7) — cheap layers first, LLM last.
 *
 *   1. alias dictionary (category_aliases table + built-in Indian merchants)
 *   2. deterministic rules (UPI/P2A, ATM, charges, refunds, salary, rent…)
 *   3. LLM — unknown merchants only, redacted, confidence-gated
 *
 * Every assignment is traceable to a rule id, an alias hit, or an LLM call
 * with its confidence — that trace is the transparency criterion.
 */
import type { LedgerTxn } from "@/lib/types";

export type CategorySource = "dict" | "rules" | "llm" | "user";

export type CategorizeResult = {
  category: string;
  source: CategorySource;
  /** Rule name / alias pattern / merchant — shown in the receipt trail. */
  matched_on: string;
  confidence: number;
};

/** Built-in layer-1 dictionary: substring → category (~Indian merchants). */
export const BUILTIN_ALIASES: { pattern: string; category: string }[] = [
  { pattern: "BLINKIT", category: "groceries" },
  { pattern: "BIGBASKET", category: "groceries" },
  { pattern: "DMART", category: "groceries" },
  { pattern: "ZOMATO", category: "dining" },
  { pattern: "SWIGGY", category: "dining" },
  { pattern: "CHAI", category: "dining" },
  { pattern: "CAFÉ", category: "dining" },
  { pattern: "CAFE", category: "dining" },
  { pattern: "RESTAURANT", category: "dining" },
  { pattern: "AMAZON", category: "shopping" },
  { pattern: "FLIPKART", category: "shopping" },
  { pattern: "MYNTRA", category: "shopping" },
  { pattern: "AJIO", category: "shopping" },
  { pattern: "NETFLIX", category: "entertainment" },
  { pattern: "SPOTIFY", category: "entertainment" },
  { pattern: "HOTSTAR", category: "entertainment" },
  { pattern: "PRIME VIDEO", category: "entertainment" },
  { pattern: "JIO", category: "utilities" },
  { pattern: "AIRTEL", category: "utilities" },
  { pattern: "VODAFONE", category: "utilities" },
  { pattern: "VI POSTPAID", category: "utilities" },
  { pattern: "ELECTRIC", category: "utilities" },
  { pattern: "ELECTRICITY", category: "utilities" },
  { pattern: "WATER BILL", category: "utilities" },
  { pattern: "GAS", category: "utilities" },
  { pattern: "UBER", category: "transport" },
  { pattern: "OLA", category: "transport" },
  { pattern: "IRCTC", category: "transport" },
  { pattern: "METRO", category: "transport" },
  { pattern: "PETROL", category: "transport" },
  { pattern: "FUEL", category: "transport" },
  { pattern: "MEDICAL", category: "health" },
  { pattern: "PHARMACY", category: "health" },
  { pattern: "HOSPITAL", category: "health" },
  { pattern: "APOLLO", category: "health" },
  { pattern: "CULT.FIT", category: "health" },
  { pattern: "GYM", category: "health" },
  { pattern: "HORIZON", category: "housing" },
  { pattern: "APARTMENT", category: "housing" },
  { pattern: "RENT", category: "housing" },
  { pattern: "MAINT", category: "housing" },
  { pattern: "SOCIETY", category: "housing" },
  { pattern: "APEX POWER", category: "utilities" },
  { pattern: "STREAMNET", category: "entertainment" },
  { pattern: "CITY MARKET", category: "groceries" },
  { pattern: "MAHINDRA", category: "emi" },
  { pattern: "HDFC LOAN", category: "emi" },
  { pattern: "EMI", category: "emi" },
  { pattern: "LIC", category: "insurance" },
  { pattern: "PREMIUM", category: "insurance" },
  { pattern: "SCHOOL", category: "education" },
  { pattern: "COURSE", category: "education" },
  { pattern: "UDMY", category: "education" },
  // --- Tier-2 expansion: investments / SIP / EMI / salary (≥120 patterns) ---
  { pattern: "ZERODHA", category: "investments" },
  { pattern: "GROWW", category: "investments" },
  { pattern: "GROWW SIP", category: "investments" },
  { pattern: "ANGEL ONE", category: "investments" },
  { pattern: "UPSTOX", category: "investments" },
  { pattern: "G PAY INVEST", category: "investments" },
  { pattern: "MUTUAL FUND", category: "investments" },
  { pattern: "HDFC MF", category: "investments" },
  { pattern: "ICICI PRU", category: "investments" },
  { pattern: "SBI MAGNUM", category: "investments" },
  { pattern: "NIPPON", category: "investments" },
  { pattern: "AXIS MF", category: "investments" },
  { pattern: "KOTAK MAHINDRA MF", category: "investments" },
  { pattern: "PARAG PARIKH", category: "investments" },
  { pattern: "MIRRAE ASSET", category: "investments" },
  { pattern: "SIP", category: "investments" },
  { pattern: "COIN ZERODHA", category: "investments" },
  { pattern: "NSC", category: "investments" },
  { pattern: "PPF", category: "investments" },
  { pattern: "KVP", category: "investments" },
  { pattern: "GOLD ETF", category: "investments" },
  { pattern: "NPS", category: "investments" },
  { pattern: "SHAREKHAN", category: "investments" },
  { pattern: "5PAISA", category: "investments" },
  { pattern: "GOLDPLUS", category: "investments" },
  // --- more Indian merchants ---
  { pattern: "JIO MART", category: "groceries" },
  { pattern: "ZEPTO", category: "groceries" },
  { pattern: "SWIGGY INSTAMART", category: "groceries" },
  { pattern: "BIG BAZAAR", category: "groceries" },
  { pattern: "RELIANCE FRESH", category: "groceries" },
  { pattern: "MORE SUPERMARKET", category: "groceries" },
  { pattern: "NIRMAL", category: "groceries" },
  { pattern: "RELIANCE SMART", category: "groceries" },
  { pattern: "LOCALBAZAAR", category: "groceries" },
  { pattern: "GROFERS", category: "groceries" },
  { pattern: "FAASOS", category: "dining" },
  { pattern: "REBEL FOODS", category: "dining" },
  { pattern: "MOJO PIZZA", category: "dining" },
  { pattern: "DOMINOS", category: "dining" },
  { pattern: "PIZZA HUT", category: "dining" },
  { pattern: "MCDONALD", category: "dining" },
  { pattern: "BURGER KING", category: "dining" },
  { pattern: "KFC", category: "dining" },
  { pattern: "BARBEQUE", category: "dining" },
  { pattern: "BARBEQUE NATION", category: "dining" },
  { pattern: "HALDIRAM", category: "dining" },
  { pattern: "Bikanervala", category: "dining" },
  { pattern: "SARAVANA BHAVAN", category: "dining" },
  { pattern: "CAF COFFEE", category: "dining" },
  { pattern: "STARBUCKS", category: "dining" },
  { pattern: "BLUE TOKAI", category: "dining" },
  { pattern: "WAVE COFFEE", category: "dining" },
  { pattern: "DUNKIN", category: "dining" },
  { pattern: "SUBWAY", category: "dining" },
  { pattern: "WOW MOMO", category: "dining" },
  { pattern: "BOX8", category: "dining" },
  { pattern: "EATFIT", category: "dining" },
  { pattern: "LA PINOZ", category: "dining" },
  { pattern: "PAPER PLATE", category: "dining" },
  { pattern: "SNACKWALLA", category: "dining" },
  { pattern: "CATERING", category: "dining" },
  { pattern: "MEGHANA FOODS", category: "dining" },
  { pattern: "PARADISE BIRYANI", category: "dining" },
  { pattern: " BIRYANI", category: "dining" },
  { pattern: "KAKA HALWAI", category: "dining" },
  { pattern: "SWEETS", category: "dining" },
  { pattern: "MOITHRI", category: "dining" },
  { pattern: "PANTALOONS", category: "shopping" },
  { pattern: "RELIANCE RETAIL", category: "shopping" },
  { pattern: "RELIANCE DIGITAL", category: "shopping" },
  { pattern: "CROMA", category: "shopping" },
  { pattern: "RELIANCE TREND", category: "shopping" },
  { pattern: "WESTSIDE", category: "shopping" },
  { pattern: "LIFESTYLE", category: "shopping" },
  { pattern: "DECATHLON", category: "shopping" },
  { pattern: "NIKE", category: "shopping" },
  { pattern: "ADIDAS", category: "shopping" },
  { pattern: "PUMA", category: "shopping" },
  { pattern: "H&M", category: "shopping" },
  { pattern: "ZARA", category: "shopping" },
  { pattern: "UNIQLO", category: "shopping" },
  { pattern: "TATA CLIQ", category: "shopping" },
  { pattern: "NYKAA", category: "shopping" },
  { pattern: "MEESHO", category: "shopping" },
  { pattern: "SNAPDEAL", category: "shopping" },
  { pattern: "PEPPERFRY", category: "shopping" },
  { pattern: "URBAN LADDER", category: "shopping" },
  { pattern: "IKEA", category: "shopping" },
  { pattern: "HOMECENTER", category: "shopping" },
  { pattern: "BOOKMYSHOW", category: "entertainment" },
  { pattern: "PVR", category: "entertainment" },
  { pattern: "INOX", category: "entertainment" },
  { pattern: "CINEPOLIS", category: "entertainment" },
  { pattern: "GAANA", category: "entertainment" },
  { pattern: "WYNK", category: "entertainment" },
  { pattern: "YOUTUBE PREMIUM", category: "entertainment" },
  { pattern: "YOUTUBE MUSIC", category: "entertainment" },
  { pattern: "JIOSAAVN", category: "entertainment" },
  { pattern: "APPLE MEDIA", category: "entertainment" },
  { pattern: "PLAYSTATION", category: "entertainment" },
  { pattern: "STEAM GAMES", category: "entertainment" },
  { pattern: "EPIC GAMES", category: "entertainment" },
  { pattern: "MINDMINE", category: "entertainment" },
  { pattern: "ACT BROADBAND", category: "utilities" },
  { pattern: "HATHWAY", category: "utilities" },
  { pattern: "GTPL", category: "utilities" },
  { pattern: "TATA PLAY", category: "utilities" },
  { pattern: "DISH TV", category: "utilities" },
  { pattern: "SUN DIRECT", category: "utilities" },
  { pattern: "UTILITY BILL", category: "utilities" },
  { pattern: "SEWERAGE", category: "utilities" },
  { pattern: "MAHANAGAR GAS", category: "utilities" },
  { pattern: "INDANE", category: "utilities" },
  { pattern: "HP GAS", category: "utilities" },
  { pattern: "BHARATGAS", category: "utilities" },
  { pattern: "ELECTRICITY BOARD", category: "utilities" },
  { pattern: "MSEDCL", category: "utilities" },
  { pattern: "BESCOM", category: "utilities" },
  { pattern: "APSPDCL", category: "utilities" },
  { pattern: "DVVNL", category: "utilities" },
  { pattern: "BEST", category: "utilities" },
  { pattern: "PAYTM ELECTRIC", category: "utilities" },
  { pattern: "OLA ELECTRIC", category: "transport" },
  { pattern: "RAPIDO", category: "transport" },
  { pattern: "IN DRIVE", category: "transport" },
  { pattern: "INDRIVE", category: "transport" },
  { pattern: "MERU", category: "transport" },
  { pattern: "SUGAM YATRA", category: "transport" },
  { pattern: "EASEMYTRIP", category: "transport" },
  { pattern: "YATRA", category: "transport" },
  { pattern: "MAKEMYTRIP", category: "transport" },
  { pattern: "GOIBIBO", category: "transport" },
  { pattern: "INDIGO", category: "transport" },
  { pattern: "AIR INDIA", category: "transport" },
  { pattern: "SPICEJET", category: "transport" },
  { pattern: "VISTARA", category: "transport" },
  { pattern: "AKASA", category: "transport" },
  { pattern: "BHIMA RATNA", category: "health" },
  { pattern: "THYROCARE", category: "health" },
  { pattern: "DR LAL PATH", category: "health" },
  { pattern: "METRO DIAGNOSTICS", category: "health" },
  { pattern: "REDCLIFF", category: "health" },
  { pattern: "PHARMASY", category: "health" },
  { pattern: "APOLLO PHARM", category: "health" },
  { pattern: "MEDPLUS", category: "health" },
  { pattern: "NETMEDS", category: "health" },
  { pattern: "PHARMEASY", category: "health" },
  { pattern: "1MG", category: "health" },
  { pattern: "PRACTO", category: "health" },
  { pattern: "CULT FIT", category: "health" },
  { pattern: "CULTFIT", category: "health" },
  { pattern: "CHROMOSOME", category: "health" },
  { pattern: "TALWALKARS", category: "health" },
  { pattern: "CLOVE DENTAL", category: "health" },
  { pattern: "DENTAL", category: "health" },
  { pattern: "FORTIS", category: "health" },
  { pattern: "MAX HOSPITAL", category: "health" },
  { pattern: "MEDANTA", category: "health" },
  { pattern: "Manipal", category: "health" },
  { pattern: "AIIMS", category: "health" },
  { pattern: "KIMS", category: "health" },
  // --- housing / rent / maintenance ---
  { pattern: "NOBROKER", category: "housing" },
  { pattern: "HOUSING.COM", category: "housing" },
  { pattern: "99ACRES", category: "housing" },
  { pattern: "MAGICBRICKS", category: "housing" },
  { pattern: "PG ACCOMMODATION", category: "housing" },
  { pattern: "FLOOR RENT", category: "housing" },
  { pattern: "APARTMENT", category: "housing" },
  { pattern: "MAINTENANCE", category: "housing" },
  { pattern: "WATER TANK", category: "housing" },
  { pattern: "LIFT MAINT", category: "housing" },
  // --- EMI / loans / insurance ---
  { pattern: "BAJAJ FINANCE", category: "emi" },
  { pattern: "BAJAJ FINSERV", category: "emi" },
  { pattern: "TATA CAPITAL", category: "emi" },
  { pattern: "KOTAK LOAN", category: "emi" },
  { pattern: "ICICI LOAN", category: "emi" },
  { pattern: "AXIS LOAN", category: "emi" },
  { pattern: "SBI LOAN", category: "emi" },
  { pattern: "CREDIT E", category: "emi" },
  { pattern: "LIC HOUSING", category: "emi" },
  { pattern: "PERSONAL LOAN", category: "emi" },
  { pattern: "AUTO LOAN", category: "emi" },
  { pattern: "EDU LOAN", category: "emi" },
  { pattern: "STUDENT LOAN", category: "emi" },
  { pattern: "HOME LOAN", category: "emi" },
  { pattern: "VEHICLE LOAN", category: "emi" },
  { pattern: " LAP", category: "emi" },
  { pattern: "HDFC BANK LI", category: "emi" },
  { pattern: "SBI LI", category: "emi" },
  { pattern: "ICICI PRUDENT", category: "insurance" },
  { pattern: "LIFE INSURANCE", category: "insurance" },
  { pattern: "HEALTH INSURANCE", category: "insurance" },
  { pattern: "STAR HEALTH", category: "insurance" },
  { pattern: "BAJAJ ALLIANZ", category: "insurance" },
  { pattern: "TATA AIG", category: "insurance" },
  { pattern: "SBI LIFE", category: "insurance" },
  { pattern: "MAX LIFE", category: "insurance" },
  { pattern: "HDFC LIFE", category: "insurance" },
  { pattern: "ACKO", category: "insurance" },
  { pattern: "ACKO GENERAL", category: "insurance" },
  { pattern: "DHANVARSHA", category: "insurance" },
  { pattern: "CAR INSURANCE", category: "insurance" },
  { pattern: "TERm PLAN", category: "insurance" },
  // --- education ---
  { pattern: "UNACADEMY", category: "education" },
  { pattern: "BYJUS", category: "education" },
  { pattern: "VEDANTU", category: "education" },
  { pattern: "CODECHEF", category: "education" },
  { pattern: "COLLEGE FEE", category: "education" },
  { pattern: "SCHOOL FEE", category: "education" },
  { pattern: "COACHING", category: "education" },
  { pattern: "KINDERO", category: "education" },
  { pattern: "Testbook", category: "education" },
  { pattern: "UNIPAC", category: "education" },
  { pattern: "EXAM FEE", category: "education" },
  // --- salary / income keywords ---
  { pattern: "SALARY CREDIT", category: "income" },
  { pattern: "SAL CREDIT", category: "income" },
  { pattern: "PAYROLL", category: "income" },
  { pattern: "STIPEND", category: "income" },
  { pattern: "FREELANCE PAYMENT", category: "income" },
  { pattern: "CONSULTING FEE", category: "income" },
  { pattern: "PROF INCOME", category: "income" },
  { pattern: "BONUS", category: "income" },
  { pattern: "ARREARS", category: "income" },
  { pattern: "LEAVE ENCASH", category: "income" },
  { pattern: "DIVIDEND", category: "income" },
  { pattern: "INTEREST CREDIT", category: "income" },
  { pattern: "FD INTEREST", category: "income" },
  { pattern: "RD INTEREST", category: "income" },
  { pattern: "CASHBACK", category: "income" },
  { pattern: "REFERRAL REWARD", category: "income" },
  // --- bank charges / cash ---
  { pattern: "ACCOUNT MAINTE", category: "charges" },
  { pattern: " AMC", category: "charges" },
  { pattern: "DEMAT CHARGE", category: "charges" },
  { pattern: "UPI CHARGE", category: "charges" },
  { pattern: "IMPS CHARGE", category: "charges" },
  { pattern: "NEFT CHARGE", category: "charges" },
  { pattern: "ATM WDL", category: "cash" },
  { pattern: "CASH WDL", category: "cash" },
  { pattern: "CASH DEPOSIT", category: "cash" },
  { pattern: "CDM", category: "cash" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  income: "Income",
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  dining: "Dining",
  transport: "Transport",
  shopping: "Shopping",
  entertainment: "Entertainment",
  health: "Health",
  insurance: "Insurance",
  emi: "EMI / Loan",
  education: "Education",
  transfer: "Transfer",
  refunds: "Refunds",
  charges: "Bank charges",
  cash: "Cash",
  uncategorized: "Uncategorized",
  investments: "Investments / SIP",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// ---------------------------------------------------------------------------
// Layer 2: deterministic rules (always free, always explainable)
// ---------------------------------------------------------------------------

type Rule = { id: string; test: RegExp; category: string };

const RULES: Rule[] = [
  { id: "salary-credit", test: /\b(SALARY|SAL CREDIT|NEFT CR SAL|SAL\/|PAYROLL|STIPEND)\b/, category: "income" },
  { id: "sip-purchase", test: /\bSIP\b|\bSIP\/|\bSIP \b/, category: "investments" },
  { id: "bonus-arrear", test: /\b(BONUS|ARREAR|LEAVE ENCASH)\b/, category: "income" },
  { id: "refund-reversal", test: /\b(REFUND|RVRSL|REVERSAL|REVERS)\b/, category: "refunds" },
  { id: "bank-charges", test: /\b(BANK CHARGE|CHARGES|GST|ANNUAL FEE|SMS CHG|IFSC)\b/, category: "charges" },
  { id: "interest", test: /\b(INTEREST|CREDIT INTEREST|INT\.)\b/, category: "income" },
  { id: "atm-cash", test: /\b(ATM|WDL|CASH WDL|SELF TFR.*ATM)\b/, category: "cash" },
  { id: "emi-debit", test: /\bEMI\b|\bEMI\/|\bLOAN REPAY\b/, category: "emi" },
  { id: "upi-p2a", test: /\bUPI\/P2A\b|\bP2A\b/, category: "uncategorized" },
  { id: "upi-p2m", test: /\bUPI\/P2M\b|\bP2M\b/, category: "uncategorized" },
  { id: "imps-neft-transfer", test: /\b(IMPS|NEFT|RTGS)\b/, category: "transfer" },
];

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export type UserAlias = { pattern: string; category: string };

/**
 * Categorize one row. `userAliases` comes from category_aliases where
 * source='user' — the correction loop: a user fix wins over everything,
 * forever.
 */
export function categorize(
  txn: Pick<LedgerTxn, "clean_narration" | "amount_paise">,
  userAliases: UserAlias[] = [],
): CategorizeResult {
  const narr = txn.clean_narration.toUpperCase();

  // Safety rails: transfers and internal moves are typed by the hygiene layer.
  if (txn.amount_paise === 0) {
    return { category: "uncategorized", source: "rules", matched_on: "zero-amount", confidence: 1 };
  }

  // ---- Layer 1a: user-learned aliases (highest authority) -----------------
  for (const a of userAliases) {
    if (narr.includes(a.pattern.toUpperCase())) {
      return { category: a.category, source: "user", matched_on: a.pattern, confidence: 1 };
    }
  }

  // ---- Layer 1b: built-in dictionary --------------------------------------
  for (const a of BUILTIN_ALIASES) {
    if (narr.includes(a.pattern.toUpperCase())) {
      return { category: a.category, source: "dict", matched_on: a.pattern, confidence: 0.95 };
    }
  }

  // ---- Layer 2: deterministic rules ---------------------------------------
  for (const r of RULES) {
    if (r.test.test(narr)) {
      return { category: r.category, source: "rules", matched_on: r.id, confidence: 0.9 };
    }
  }

  // ---- Layer 3: LLM handled by caller (needs async) ------------------------
  return { category: "uncategorized", source: "rules", matched_on: "no-match", confidence: 0 };
}

/**
 * Redact a narration down to what the LLM is allowed to see (Build Bible §7):
 * merchant-ish tokens only — no account numbers, no names, no full refs.
 * Amount is bucketed to a band, never exact.
 */
export function redactForLlm(narration: string, amountPaise: number): {
  merchant: string;
  amount_band: string;
} {
  let s = narration.toUpperCase();
  // drop long digit runs (account/ref/phone numbers)
  s = s.replace(/\d{4,}/g, " ");
  // drop IFSC-ish and email-ish tokens
  s = s.replace(/[A-Z]{4}0[A-Z0-9]{6}/g, " ");
  s = s.replace(/\S+@\S+/g, " ");
  s = s.replace(/[^A-Z0-9 /\-_*.&]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // keep the first few meaningful tokens — merchant usually leads
  const tokens = s.split(" ").filter((t) => t.length > 1).slice(0, 6);

  const rupees = Math.abs(amountPaise) / 100;
  const band =
    rupees < 100 ? "0-100" :
    rupees < 500 ? "100-500" :
    rupees < 2000 ? "500-2k" :
    rupees < 10000 ? "2k-10k" :
    rupees < 50000 ? "10k-50k" :
    "50k+";

  return { merchant: tokens.join(" ") || "UNKNOWN", amount_band: band };
}

/** Apply categorization to rows that are still uncategorized/none. */
export function categorizeLedger(
  txns: LedgerTxn[],
  userAliases: UserAlias[] = [],
): Map<string, CategorizeResult> {
  const results = new Map<string, CategorizeResult>();
  for (const t of txns) {
    if (t.type !== "normal") {
      results.set(t.txn_hash, {
        category: t.type === "netted" ? "refunds" : "transfer",
        source: "rules",
        matched_on: `hygiene:${t.type}`,
        confidence: 1,
      });
      continue;
    }
    if (t.category) continue; // user already set it
    results.set(t.txn_hash, categorize(t, userAliases));
  }
  return results;
}
