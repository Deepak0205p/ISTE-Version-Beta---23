from __future__ import annotations

from dataclasses import asdict
import re
from typing import Dict, List, Optional
from fastapi import FastAPI, File, Form, UploadFile
from pydantic import BaseModel

from backend.pdf_pipeline import extract_pdf_bytes
from backend.csv_adapters import normalize_csv_With_config
from backend.dedup_matcher import MergeableTxn, merge_and_deduplicate_statements
from backend.recurring_engine import detect_recurring_payments, merchant_stem
from backend.anomaly_detector import detect_anomalies
from backend.forecast_engine import forecast_weekly_balance
from backend.affordability_engine import evaluate_affordability

app = FastAPI(title="PS4 Personal Finance Deterministic Engine")

CATEGORY_RULES: List[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(SALARY|PAYROLL|ACME CORP)\b", re.I), "Salary"),
    (re.compile(r"\b(RENT|LANDLORD|APARTMENT|HOUSING)\b", re.I), "Rent & Housing"),
    (re.compile(r"\b(NETFLIX|SPOTIFY|HOTSTAR|PRIME|YOUTUBE|APPLE|SUBSCRIPTION)\b", re.I), "Subscriptions"),
    (re.compile(r"\b(BIGBASKET|BLINKIT|ZEPTO|DMART|GROCERY|SUPERMARKET|INSTAMART)\b", re.I), "Groceries"),
    (re.compile(r"\b(SWIGGY|ZOMATO|STARBUCKS|RESTAURANT|CAFE|DINING)\b", re.I), "Dining & Food"),
    (re.compile(r"\b(UBER|OLA|RAPIDO|METRO|IRCTC|PETROL|SHELL|HPCL)\b", re.I), "Transport"),
    (re.compile(r"\b(BESCOM|AIRTEL|JIO|ELECTRICITY|WATER|BROADBAND|BILL)\b", re.I), "Utilities"),
]


def auto_categorize(description: str, amount_paise: int, overrides: Optional[Dict[str, str]] = None) -> str:
    stem = merchant_stem(description)
    if overrides and stem in overrides:
        return overrides[stem]
    for pattern, cat in CATEGORY_RULES:
        if pattern.search(description):
            return cat
    return "Income" if amount_paise > 0 else "Shopping & Misc"


class PipelineState:
    def __init__(self) -> None:
        self.raw_txns: List[MergeableTxn] = []
        self.merchant_overrides: Dict[str, str] = {}
        self.closing_balance_paise: int = 18500000  # default ₹1,85,000 if not in statement

    def reset(self) -> None:
        self.raw_txns = []
        self.merchant_overrides = {}
        self.closing_balance_paise = 18500000


STATE = PipelineState()


def build_pipeline_snapshot(
    txns: List[MergeableTxn],
    overrides: Dict[str, str],
    closing_balance_paise: int,
    target_amount_paise: int = 8000000,
) -> Dict[str, object]:
    merged, exact_merged, flagged_near = merge_and_deduplicate_statements(txns)

    # Convert to unified dict list for recurring, anomaly, forecast, and affordability engines
    unified_rows: List[Dict[str, object]] = []
    for idx, t in enumerate(merged):
        stem = merchant_stem(t.description)
        cat = overrides.get(stem) or auto_categorize(t.description, t.amount_paise, overrides)
        t.category = cat
        direction = "credit" if t.amount_paise > 0 else "debit"
        unified_rows.append(
            {
                "id": f"tx-{idx + 1}",
                "account_id": t.account_id,
                "date": t.date,
                "description": t.description,
                "raw_desc": t.description,
                "merchant": stem,
                "amount_paise": abs(t.amount_paise),
                "signed_amount_paise": t.amount_paise,
                "direction": direction,
                "category": cat,
                "type": "normal",
                "is_duplicate": False,
                "flags": t.flags,
            }
        )

    # Recurring detection expects signed amount_paise in input dicts
    recurring_input = [
        {
            "date": r["date"],
            "description": r["description"],
            "amount_paise": r["signed_amount_paise"],
            "type": "normal",
        }
        for r in unified_rows
    ]
    recurring_subs = detect_recurring_payments(recurring_input)
    recurring_dicts = [
        {
            "merchant": s.merchant,
            "typical_amount_paise": s.amount_paise,
            "frequency": s.frequency_label,
            "interval_days": s.interval_days,
            "occurrences": s.occurrences,
            "last_date": s.last_date,
            "next_expected_date": s.next_expected_date,
            "monthly_equivalent_paise": s.monthly_equivalent_paise,
        }
        for s in recurring_subs
    ]

    anomalies = detect_anomalies(unified_rows)
    forecast = forecast_weekly_balance(unified_rows, closing_balance_paise=closing_balance_paise)
    affordability = evaluate_affordability(
        unified_rows,
        recurring_items=recurring_dicts,
        closing_balance_paise=closing_balance_paise,
        target_amount_paise=target_amount_paise,
    )

    return {
        "transactions": unified_rows,
        "exact_duplicates_removed": exact_merged,
        "near_duplicates_flagged": flagged_near,
        "recurring": recurring_dicts,
        "anomalies": [a.to_dict() for a in anomalies],
        "forecast": [f.to_dict() for f in forecast],
        "affordability": affordability.to_dict(),
    }


class CorrectionRequest(BaseModel):
    merchant: str
    new_category: str


class QuestionRequest(BaseModel):
    amount_inr: float = 80000.0


@app.post("/api/wipe")
def wipe_state() -> Dict[str, object]:
    STATE.reset()
    return {"ok": True}


@app.post("/api/upload")
async def upload_statements(
    files: List[UploadFile] = File(...),
    account_ids: Optional[List[str]] = Form(None),
) -> Dict[str, object]:
    for idx, f in enumerate(files):
        acct = (
            account_ids[idx]
            if account_ids and idx < len(account_ids)
            else f"ACCT-{idx + 1}"
        )
        raw_bytes = await f.read()
        fname = (f.filename or "").lower()
        if fname.endswith(".pdf"):
            pdf_out = extract_pdf_bytes(raw_bytes, account_id=acct)
            if pdf_out.ok:
                for r in pdf_out.rows:
                    STATE.raw_txns.append(
                        MergeableTxn(
                            account_id=r.account_id,
                            date=r.date,
                            amount_paise=r.amount_paise,
                            description=r.description,
                        )
                    )
                    if r.balance_paise is not None:
                        STATE.closing_balance_paise = r.balance_paise
        else:
            csv_text = raw_bytes.decode("utf-8", errors="ignore")
            rows = normalize_csv_With_config(csv_text, account_id=acct)
            for r in rows:
                STATE.raw_txns.append(
                    MergeableTxn(
                        account_id=r.account_id,
                        date=r.date,
                        amount_paise=r.amount_paise,
                        description=r.description,
                        ref=r.ref,
                    )
                )
                if r.balance_paise is not None:
                    STATE.closing_balance_paise = r.balance_paise

    return build_pipeline_snapshot(
        STATE.raw_txns,
        STATE.merchant_overrides,
        STATE.closing_balance_paise,
    )


@app.post("/api/correction")
def correct_category(req: CorrectionRequest) -> Dict[str, object]:
    stem = merchant_stem(req.merchant)
    STATE.merchant_overrides[stem] = req.new_category
    snap = build_pipeline_snapshot(
        STATE.raw_txns,
        STATE.merchant_overrides,
        STATE.closing_balance_paise,
    )
    changed_count = sum(
        1 for tx in snap["transactions"] if tx["merchant"] == stem
    )
    return {
        "ok": True,
        "merchant": stem,
        "new_category": req.new_category,
        "changed_count": changed_count,
        "note": f"changed {changed_count} similar transactions",
        "snapshot": snap,
    }


@app.post("/api/question")
def ask_affordability(req: QuestionRequest) -> Dict[str, object]:
    target_paise = int(round(req.amount_inr * 100))
    snap = build_pipeline_snapshot(
        STATE.raw_txns,
        STATE.merchant_overrides,
        STATE.closing_balance_paise,
        target_amount_paise=target_paise,
    )
    return snap["affordability"]
