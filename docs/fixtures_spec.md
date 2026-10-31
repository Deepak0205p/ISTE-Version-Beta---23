# Fixture Specification — Trap Cases

_PS4 Build Bible §6/§14 · Lane D · written before the CSVs (H0-2)_

Every fixture here exists to prove one frozen rule. When a fixture is built, the
matching test and the matching demo beat are listed — if the fixture has no test,
it is not done.

Fixtures live in `fixtures/` and are never edited after the engine freeze (H20),
except for the live "add a month" demo file.

---

## 1. Overlapping CSV exports

| | |
|---|---|
| **Proves** | Dedup P-class discipline — flag + ask, never auto-delete |
| **Files** | `hdfc_aug_oct_full.csv`, `hdfc_sep_oct_partial.csv` (same account, ~40% row overlap) |
| **Expected** | M-class pairs (identical txn_hash) auto-merge with a log; P-class pairs (same amount, ≤3 days apart, near-identical narration) are flagged and **both rows kept**; forecast unchanged until the user decides |
| **Test** | `test_dup_p_never_autodeleted` — both rows kept, flag raised, count = 1 |
| **Demo beat** | Beat 4 — hostile-judge re-upload |
| **Ban checked** | ❌ auto-merge of *possible* duplicates |

## 2. Salary moved between own accounts

| | |
|---|---|
| **Proves** | Transfer-pair exclusion — income not double-counted |
| **Files** | `hdfc_salary_in.csv` (₹72,000 credit, Oct 1) + `sbi_transfer_out.csv` (₹72,000 debit, Oct 2) |
| **Expected** | Outflow in A + inflow in B, `|diff| ≤ ₹1`, adjacent dates → both rows `type = transfer`, excluded from income/spend/forecast; receipt shows `excluded.internal_transfers = 1` |
| **Test** | `test_transfer_pair_excluded` — income and spend unchanged; type=transfer |
| **Demo beat** | Beat 3 — Meera receipt walkthrough |
| **Ban checked** | ❌ naive double-counted income |

## 3. Failed UPI transaction + its reversal

| | |
|---|---|
| **Proves** | Failed UPI netting — ₹20 chai, not ₹40 |
| **Files** | `chai_failed_reversal.csv` — `UPI/CHAI POINT FAILED` (−20, Oct 6 10:02) + `RVRSL/CHAI POINT` (+20, Oct 6 10:04) |
| **Expected** | Narration matches FAILED/DECLINED/TEMPORARILY REVERSED with a reversal ≤7 days → pair nets to zero, both rows **stay visible** flagged `netted`, contribute nothing to spend |
| **Test** | `test_failed_upi_netted` — net zero; excluded from spend |
| **Demo beat** | Beat 4 (one ledger line) |
| **Ban checked** | ❌ counting a failed payment as spend |

## 4. Duplicate ₹20 chai transaction

| | |
|---|---|
| **Proves** | P-class "flag and ask", user decides, choice remembered |
| **Files** | `chai_twice.csv` — two identical `UPI/CHAI POINT 20` rows, same amount, 1–2 days apart, near-identical narration, **different** refs (two apps) |
| **Expected** | Flag `possible_duplicate` raised on both; **no deletion**; POST decision (keep both / duplicate) remembered as a category_alias/user choice; ledger shows exactly one flagged pair |
| **Test** | `test_dup_p_never_autodeleted` |
| **Demo beat** | Beat 4 |
| **Ban checked** | ❌ silent deletion of real spend |

## 5. Password-protected PDF

| | |
|---|---|
| **Proves** | Graceful failure — clear message, CSV path offered |
| **Files** | `locked_statement.pdf` (open password set; password documented in the fixture README row: `demo123`) |
| **Expected** | Upload returns a structured error: `PASSWORD_PROTECTED` + "unlock it or upload CSV"; **never** a stack trace, never a partial parse. If a password field is provided, parse normally |
| **Test** | `test_pdf_password_detected` |
| **Demo beat** | Beat 4 fallback if a judge hands us a PDF |
| **Ban checked** | ❌ silent wrong parse |

## 6. Image-based scanned PDF

| | |
|---|---|
| **Proves** | Fail loudly and honestly — no text layer = no OCR guesswork |
| **Files** | `scanned_statement.pdf` (pure image pages, zero text layer) |
| **Expected** | Detected as `NO_TEXT_LAYER` → message "scanned PDFs need OCR — we chose to fail loudly and honestly; upload CSV". No crash, no fabricated rows |
| **Test** | `test_pdf_scanned_no_text_layer` |
| **Demo beat** | Beat 4 / Q6 defence |
| **Ban checked** | ❌ hallucinated table extraction |

## 7. Single ₹45,000 anomaly credit

| | |
|---|---|
| **Proves** | MAD (modified z-score) anomaly flag; median survives the outlier |
| **Files** | `meera_lumpy_8mo.csv` containing one `V*PAYBCK*SPARKL` credit of **+₹45,000** among normal ₹40k–₹150k freelance inflows |
| **Expected** | `|Mi| > 3.5` (Iglewicz & Hoaglin, 0.6745·(x−median)/MAD) → row flagged `mad_anomaly`, still visible in ledger, **excluded from median income**; guards: MAD=0 → flag nothing (`uniform history`), n<10 → at most 1 flag labeled `possible` |
| **Test** | `test_mad_zero_guard` + median-income-excludes-flag test |
| **Demo beat** | Beat 3 — point at the flag, show the median move |
| **Ban checked** | ❌ mean ± SD rule (masking, Leys 2013) |

---

## Fixture hygiene rules

- **Frozen at H20** — after engine freeze, only the live "add a month" file changes.
- **Real-ish narrations** — fixtures use real bank naming patterns (UPI/P2A/…, IMPS/…,
  RVRSL/…), because a judge who reads the CSV must believe it.
- **One trap per file** where possible, so a failing test points at one rule.
- **3,000-row stress export** (`stress_3000.csv`, generated) also required — must parse in
  **under 2 seconds** (§6 memory cap).
- Each fixture ships with an expected-result line in this file; the test asserts exactly
  that, and nothing looser.
