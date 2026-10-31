/**
 * Fixture generator — builds the trap fixtures from docs/fixtures_spec.md.
 *
 * Run: node scripts/make-fixtures.mjs
 *
 * Every CSV's balance column reconciles exactly (prev + signed amount =
 * closing), so the strict normalizer accepts the whole file. Re-running
 * overwrites; fixtures are frozen after H20.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "fixtures");
fs.mkdirSync(dir, { recursive: true });

const INR = (n) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// RFC 4180: any cell containing a comma (lakh formatting: "1,25,000.00")
// must be quoted so CSV column counts stay intact.
const q = (v) => {
  const s = String(v);
  return s.includes(",") ? `"${s}"` : s;
};

// ---------------------------------------------------------------------------
// Deterministic PRNG so regenerating never changes the fixtures
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

// HDFC-style: DD/MM/YYYY, Withdrawal/Deposit pair, Closing Balance
function hdfcHeader() {
  return "Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Closing Balance";
}
function hdfcRow(date, narration, ref, debit, credit, balance) {
  const d = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  return `${q(d)},${q(narration)},${q(ref)},${debit ? q(INR(debit)) : ""},${credit ? q(INR(credit)) : ""},${q(INR(balance))}`;
}

// SBI-style: "DD Mon YYYY", Description, Withdrawal/Deposit, Balance
function sbiHeader() {
  return "Txn Date,Description,Ref No./Cheque No,Withdrawal Amt.,Deposit Amt.,Balance";
}
function sbiRow(date, narration, ref, debit, credit, balance) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const d = `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return `${q(d)},${q(narration)},${q(ref)},${debit ? q(INR(debit)) : ""},${credit ? q(INR(credit)) : ""},${q(INR(balance))}`;
}

/**
 * Core generator: emits rows with a perfectly reconciling running balance.
 * rows: [{date, narration, ref, debit, credit}]
 */
function withBalance(rows, opening) {
  let bal = opening;
  return rows.map((r) => {
    bal += (r.credit ?? 0) - (r.debit ?? 0);
    return { ...r, balance: bal };
  });
}

// ---------------------------------------------------------------------------
// Persona generators
// ---------------------------------------------------------------------------

/** Rohan: 14 months, ₹72k salary stable, rent 18k, normal life. */
function rohan() {
  const rand = mulberry32(101);
  const rows = [];
  let ref = 100000;

  for (let m = 0; m < 14; m++) {
    const monthStart = new Date(Date.UTC(2025, 8 + m, 1));
    const day = (n) => new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), n));

    rows.push({ date: day(1), narration: "UPI/IMPS/SALARY OCT/ACCR", ref: `NEFT${ref++}`, credit: 72000 });
    rows.push({ date: day(2), narration: "UPI/P2A/918273451/R K PROPERTIES/RENT", ref: `UPI${ref++}`, debit: 18000 });

    for (let w = 0; w < 3; w++) {
      rows.push({ date: day(5 + w * 7), narration: "UPI/BLINKIT 8823 GGN", ref: `UPI${ref++}`, debit: Math.round(400 + rand() * 900) });
      rows.push({ date: day(6 + w * 7), narration: "UPI/ZOMATO ORDER", ref: `UPI${ref++}`, debit: Math.round(250 + rand() * 650) });
      rows.push({ date: day(7 + w * 7), narration: "ATM CASH WDL", ref: `ATM${ref++}`, debit: 2000 });
    }
    rows.push({ date: day(12), narration: "UPI/AIRTEL PREPAID RECHARGE", ref: `UPI${ref++}`, debit: 999 });
    rows.push({ date: day(15), narration: "NACH NETFLIX INDIA", ref: `NACH${ref++}`, debit: 649 });
    rows.push({ date: day(20), narration: "UPI/SWIGGY BULBRETAIL", ref: `UPI${ref++}`, debit: Math.round(300 + rand() * 700) });
    // monthly savings blip
    rows.push({ date: day(25), narration: "NEFT CREDIT INTEREST", ref: `INT${ref++}`, credit: Math.round(350 + rand() * 250) });
  }

  return rows.filter((r) => r.date <= new Date(Date.UTC(2026, 9, 29)));
}

/** Meera: 8 months freelancer, lumpy ₹40k–₹150k, plus the ₹45,000 anomaly. */
function meera() {
  const rand = mulberry32(202);
  const rows = [];
  let ref = 500000;

  for (let m = 0; m < 8; m++) {
    const monthStart = new Date(Date.UTC(2026, 2 + m, 1)); // Mar → Oct 2026
    const day = (n) => new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), n));
    const monthName = monthStart.toISOString().slice(0, 7);

    // lumpy income: 2-4 client credits
    const credits = 2 + Math.floor(rand() * 3);
    for (let c = 0; c < credits; c++) {
      const amount = 40000 + Math.round(rand() * 110000);
      rows.push({
        date: day(3 + c * 7 + Math.floor(rand() * 3)),
        narration: `IMPS/P2A/CLIENT PAYMENT ${monthName.replace("-", "")}/${c + 1}`,
        ref: `IMP${ref++}`,
        credit: amount,
      });
    }

    rows.push({ date: day(4), narration: "UPI/P2A/887766554/LANDLORD MAINT/FLOOR 3", ref: `UPI${ref++}`, debit: 18000 });
    rows.push({ date: day(8), narration: "UPI/BLINKIT 4412 DEL", ref: `UPI${ref++}`, debit: Math.round(600 + rand() * 1200) });
    rows.push({ date: day(14), narration: "UPI/SWIGGY TECH PARK", ref: `UPI${ref++}`, debit: Math.round(500 + rand() * 1500) });
    rows.push({ date: day(18), narration: "UPI/AIRTEL POSTPAID", ref: `UPI${ref++}`, debit: 1099 });
    rows.push({ date: day(22), narration: "UPI/MEDPLUS PHARMACY", ref: `UPI${ref++}`, debit: Math.round(200 + rand() * 1400) });
    rows.push({ date: day(26), narration: "UPI/UBER TRIP", ref: `UPI${ref++}`, debit: Math.round(150 + rand() * 450) });
  }

  // the single ₹45,000 anomaly credit (trap fixture #7)
  rows.push({
    date: new Date(Date.UTC(2026, 8, 9)),
    narration: "V*PAYBCK*SPARKL",
    ref: "556677881",
    credit: 45000,
  });

  return rows;
}

/** Arjun: only 2.2 months of history → REFUSED persona. */
function arjun() {
  const rand = mulberry32(303);
  const rows = [];
  let ref = 900000;
  const start = new Date(Date.UTC(2026, 8, 5)); // 2026-09-05 ≈ 2.2 months to 2026-10-31

  for (let d = new Date(start); d <= new Date(Date.UTC(2026, 9, 29)); d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 1) {
      rows.push({ date: new Date(d), narration: "UPI/IMPS/SALARY CREDIT", ref: `NEFT${ref++}`, credit: 45000 });
    }
    if (dow === 2) {
      rows.push({ date: new Date(d), narration: "UPI/P2A/112233445/PG ACCOMMODATION/RENT", ref: `UPI${ref++}`, debit: 12000 });
    }
    if (rand() < 0.55) {
      rows.push({ date: new Date(d), narration: "UPI/CHAI POINT CONNAUGHT", ref: `UPI${ref++}`, debit: 20 });
    }
    if (rand() < 0.35) {
      rows.push({ date: new Date(d), narration: "UPI/BLINKIT 8823 GGN", ref: `UPI${ref++}`, debit: Math.round(150 + rand() * 500) });
    }
    if (rand() < 0.25) {
      rows.push({ date: new Date(d), narration: "UPI/IRCTC TICKET", ref: `UPI${ref++}`, debit: Math.round(300 + rand() * 900) });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Trap: failed UPI + reversal (chai ₹20), salary A→B transfer, dup chai
// ---------------------------------------------------------------------------

function chaiFailedPair() {
  const day = new Date(Date.UTC(2026, 9, 6));
  return [
    { date: day, narration: "UPI/CHAI POINT FAILED TXN", ref: "918273451", debit: 20 },
    { date: day, narration: "RVRSL/CHAI POINT FAILED TXN", ref: "918273451", credit: 20 },
    { date: addDays(day, 1), narration: "UPI/CHAI POINT 20", ref: "918283451", debit: 20 },
  ];
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function writeCsv(name, header, rows, decorate) {
  const lines = [header, ...rows.map(decorate)];
  fs.writeFileSync(path.join(dir, name), lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${name} (${rows.length} rows)`);
}

// 1. Rohan — HDFC, 14 months, opening ₹34,210
{
  const rows = withBalance(rohan(), 34210);
  writeCsv("rohan_hdfc_14mo.csv", hdfcHeader(), rows, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 2. Meera — SBI, 8 months lumpy + ₹45,000 anomaly, opening ₹28,000
{
  const rows = withBalance(meera(), 28000);
  writeCsv("meera_lumpy_8mo.csv", sbiHeader(), rows, (r) =>
    sbiRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 3. Arjun — HDFC, 2.2 months → REFUSED, opening ₹8,500
{
  const rows = withBalance(arjun(), 8500);
  writeCsv("arjun_hdfc_2mo_thin.csv", hdfcHeader(), rows, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 4. Chai failed UPI + reversal (HDFC mini export, trap #3)
{
  const rows = withBalance(chaiFailedPair(), 5000);
  writeCsv("chai_failed_reversal.csv", hdfcHeader(), rows, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 5. Salary moved between own accounts (fixture #2, per spec):
//    hdfc_salary_in.csv  = ₹172,000 credit on Oct 1
//    sbi_transfer_out.csv = ₹172,000 debit on Oct 2 → pair excluded
{
  const hdfcRows = withBalance(
    [{ date: new Date(Date.UTC(2026, 9, 1)), narration: "UPI/IMPS/SALARY OCT/ACCR", ref: "NEFT990001", credit: 172000 }],
    50000,
  );
  writeCsv("hdfc_salary_in.csv", hdfcHeader(), hdfcRows, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );

  const sbiRows = withBalance(
    [{ date: new Date(Date.UTC(2026, 9, 2)), narration: "IMPS/P2A/SALARY MOVE TO HDFC OWN", ref: "IMP990002", debit: 172000 },
     { date: new Date(Date.UTC(2026, 9, 5)), narration: "UPI/P2A/778899001/PG ACCOMMODATION/RENT", ref: "UPI990003", debit: 20000 }],
    200000,
  );
  writeCsv("sbi_transfer_out.csv", sbiHeader(), sbiRows, (r) =>
    sbiRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 6. Duplicate ₹20 chai (two apps, different refs, trap #4)
{
  const day = new Date(Date.UTC(2026, 9, 8));
  const rows = withBalance(
    [
      { date: day, narration: "UPI/CHAI POINT 20", ref: "918281111", debit: 20 },
      { date: addDays(day, 1), narration: "UPI/CHAI POINT 20", ref: "918292222", debit: 20 },
    ],
    1000,
  );
  writeCsv("chai_twice.csv", hdfcHeader(), rows, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 7. Overlapping exports (trap #1): full file + a partial re-export where
//    ~60% of rows are byte-identical (M-class → merged) and ~40% came back
//    with regenerated reference numbers (P-class → flagged, both kept).
{
  const full = rohan();
  const slice = full.slice(-40).map((r, i) => {
    if (i < 24) return r; // identical row → same txn_hash → M-class
    // bank re-export with a shifted ref → near-identical narration → P-class
    return { ...r, ref: `REG${(i + 1) * 1111}` };
  });
  writeCsv("hdfc_aug_oct_full.csv", hdfcHeader(), withBalance(full, 34210), (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
  writeCsv("hdfc_sep_oct_partial.csv", hdfcHeader(), withBalance(slice, 100000), (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

// 8. Stress export (spec §hygiene): 3,000 rows, must parse in < 2 seconds
{
  const rand = mulberry32(404);
  const narrations = [
    "UPI/BLINKIT 8823 GGN",
    "UPI/ZOMATO ORDER",
    "UPI/SWIGGY BULBRETAIL",
    "UPI/CHAI POINT CONNAUGHT",
    "UPI/AMAZON PAY INDIA",
    "ATM CASH WDL",
    "UPI/UBER TRIP",
    "NACH NETFLIX INDIA",
    "UPI/P2A/887766554/LANDLORD MAINT/FLOOR 3",
    "UPI/IRCTC TICKET",
    "IMPS/P2A/FRIEND UPI REFUND",
    "UPI/AIRTEL PREPAID RECHARGE",
    "POS CROSSWORD BOOKS",
    "UPI/ZEPTO GGN 4412",
  ];
  const rows = [];
  const start = new Date(Date.UTC(2024, 0, 1)); // ~22 months of density
  let ref = 7000000;
  let i = 0;
  outer: for (let d = new Date(start); i < 3000; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 1 && i < 3000) {
      rows.push({ date: new Date(d), narration: "UPI/IMPS/SALARY CREDIT", ref: `NEFT${ref++}`, credit: 72000 });
      i++;
    }
    const daily = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < daily && i < 3000; k++) {
      const credit = rand() < 0.12;
      rows.push({
        date: new Date(d),
        narration: credit
          ? "IMPS/P2A/FRIEND UPI REFUND"
          : narrations[Math.floor(rand() * narrations.length)],
        ref: `UPI${ref++}`,
        credit: credit ? Math.round(100 + rand() * 2000) : 0,
        debit: credit ? 0 : Math.round(20 + rand() * 2500),
      });
      i++;
    }
    if (d.getUTCFullYear() === 2030) break outer; // safety valve
  }
  const reconciled = withBalance(rows.slice(0, 3000), 150000);
  writeCsv("stress_3000.csv", hdfcHeader(), reconciled, (r) =>
    hdfcRow(r.date, r.narration, r.ref, r.debit, r.credit, r.balance),
  );
}

console.log(`\nfixtures written to ${dir}`);
