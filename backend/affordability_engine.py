# Deterministic step-by-step affordability engine (Zero LLM calls in the math path)
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from statistics import median
from typing import Dict, List, Optional


@dataclass
class AffordabilityResult:
    target_amount_paise: int
    current_balance_paise: int
    expected_income_paise: int
    income_range_min_paise: int
    income_range_max_paise: int
    income_is_variable: bool
    committed_payments_paise: int
    average_variable_spend_paise: int
    safety_buffer_paise: int
    safety_buffer_rule: str
    free_cash_before_purchase_paise: int
    net_after_purchase_paise: int
    verdict: str
    refusal_reason: Optional[str]
    distinct_months: int
    span_days: int
    committed_breakdown: List[Dict[str, object]]
    variable_breakdown: Dict[str, int]
    trace_lines: Dict[str, str]

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


def evaluate_affordability(
    transactions: List[Dict[str, object]],
    recurring_items: List[Dict[str, object]],
    closing_balance_paise: int,
    target_amount_paise: int,
) -> AffordabilityResult:
    """
    Deterministic step-by-step affordability formula:
      current_balance
      + expected_income (median of last 3 months; show range if variable)
      - committed_payments (from recurring detection + rent/housing)
      - average_variable_spend (category averages across observed months)
      - safety_buffer (rule: max(monthly_committed * 1.5, ₹10,000))
      -> net_after_purchase & verdict
    Refuses with a clear 'data too short' explanation if statements < 3 months or no income found.
    """
    clean_txs = [tx for tx in transactions if not tx.get("is_duplicate", False)]
    if not clean_txs:
        return AffordabilityResult(
            target_amount_paise=target_amount_paise,
            current_balance_paise=closing_balance_paise,
            expected_income_paise=0,
            income_range_min_paise=0,
            income_range_max_paise=0,
            income_is_variable=False,
            committed_payments_paise=0,
            average_variable_spend_paise=0,
            safety_buffer_paise=1000000,
            safety_buffer_rule="max(monthly committed × 1.5, ₹10,000)",
            free_cash_before_purchase_paise=0,
            net_after_purchase_paise=0,
            verdict="REFUSED",
            refusal_reason="data too short: No transactions uploaded. Please upload at least 3 months of bank statements.",
            distinct_months=0,
            span_days=0,
            committed_breakdown=[],
            variable_breakdown={},
            trace_lines={},
        )

    dates = sorted(str(tx["date"])[:10] for tx in clean_txs)
    months = sorted({d[:7] for d in dates})
    d_min = datetime.strptime(dates[0], "%Y-%m-%d").date()
    d_max = datetime.strptime(dates[-1], "%Y-%m-%d").date()
    span_days = (d_max - d_min).days + 1
    num_months = len(months)

    # Check minimum 3 months coverage
    if num_months < 3 or span_days < 60:
        return AffordabilityResult(
            target_amount_paise=target_amount_paise,
            current_balance_paise=closing_balance_paise,
            expected_income_paise=0,
            income_range_min_paise=0,
            income_range_max_paise=0,
            income_is_variable=False,
            committed_payments_paise=0,
            average_variable_spend_paise=0,
            safety_buffer_paise=1000000,
            safety_buffer_rule="max(monthly committed × 1.5, ₹10,000)",
            free_cash_before_purchase_paise=0,
            net_after_purchase_paise=0,
            verdict="REFUSED",
            refusal_reason=f"data too short: Uploaded statements cover only {num_months} month(s) ({span_days} days). At least 3 months of history are required for a confident affordability verdict.",
            distinct_months=num_months,
            span_days=span_days,
            committed_breakdown=[],
            variable_breakdown={},
            trace_lines={"guard": "backend/affordability_engine.py:L74"},
        )

    # Step 2: Expected monthly income (median of last 3 months)
    last_3_months = months[-3:]
    income_by_month: Dict[str, int] = {m: 0 for m in last_3_months}
    for tx in clean_txs:
        m = str(tx["date"])[:7]
        if m in income_by_month and str(tx.get("direction", "")).lower() == "credit":
            income_by_month[m] += int(tx["amount_paise"])

    monthly_incomes = [income_by_month[m] for m in last_3_months]
    total_income_3m = sum(monthly_incomes)
    if total_income_3m <= 0:
        return AffordabilityResult(
            target_amount_paise=target_amount_paise,
            current_balance_paise=closing_balance_paise,
            expected_income_paise=0,
            income_range_min_paise=0,
            income_range_max_paise=0,
            income_is_variable=False,
            committed_payments_paise=0,
            average_variable_spend_paise=0,
            safety_buffer_paise=1000000,
            safety_buffer_rule="max(monthly committed × 1.5, ₹10,000)",
            free_cash_before_purchase_paise=0,
            net_after_purchase_paise=0,
            verdict="REFUSED",
            refusal_reason="No recurring income credits found across the last 3 months; refusing to guess affordability.",
            distinct_months=num_months,
            span_days=span_days,
            committed_breakdown=[],
            variable_breakdown={},
            trace_lines={"guard": "backend/affordability_engine.py:L104"},
        )

    expected_income_paise = int(round(median(monthly_incomes)))
    income_min = min(monthly_incomes)
    income_max = max(monthly_incomes)
    income_is_variable = (income_max - income_min) > int(expected_income_paise * 0.05)

    # Step 3: Committed payments from recurring detection
    committed_payments_paise = 0
    committed_merchants = set()
    committed_breakdown: List[Dict[str, object]] = []
    for item in recurring_items:
        amt = int(item["typical_amount_paise"])
        freq = str(item.get("frequency", "monthly"))
        if freq == "weekly":
            monthly_equiv = int(round(amt * 4.33))
        elif freq == "yearly":
            monthly_equiv = int(round(amt / 12.0))
        else:
            monthly_equiv = amt
        committed_payments_paise += monthly_equiv
        m_name = str(item["merchant"])
        committed_merchants.add(m_name.strip().lower())
        committed_breakdown.append({
            "merchant": m_name,
            "amount_paise": monthly_equiv,
            "frequency": freq,
            "next_expected_date": item.get("next_expected_date"),
        })

    # Step 4: Average variable spend (category averages over last 3 months, excluding committed merchants)
    variable_totals_by_cat: Dict[str, int] = {}
    for tx in clean_txs:
        m = str(tx["date"])[:7]
        if m not in last_3_months:
            continue
        if str(tx.get("direction", "")).lower() != "debit":
            continue
        m_name = str(tx.get("merchant") or tx.get("raw_desc") or "").strip().lower()
        if m_name in committed_merchants:
            continue
        cat = str(tx.get("category") or "General")
        variable_totals_by_cat[cat] = variable_totals_by_cat.get(cat, 0) + int(tx["amount_paise"])

    variable_breakdown: Dict[str, int] = {
        cat: int(round(total / len(last_3_months)))
        for cat, total in variable_totals_by_cat.items()
    }
    average_variable_spend_paise = sum(variable_breakdown.values())

    # Step 5: Safety buffer rule -> max(monthly committed * 1.5, ₹10,000)
    ten_k_paise = 10000 * 100
    safety_buffer_paise = max(int(round(committed_payments_paise * 1.5)), ten_k_paise)
    safety_buffer_rule = "max(monthly committed × 1.5, ₹10,000)"

    # Step 6: Net calculation & verdict
    free_cash_before_purchase_paise = (
        closing_balance_paise
        + expected_income_paise
        - committed_payments_paise
        - average_variable_spend_paise
        - safety_buffer_paise
    )
    net_after_purchase_paise = free_cash_before_purchase_paise - target_amount_paise

    if net_after_purchase_paise >= 0:
        verdict = "YES"
    elif (free_cash_before_purchase_paise + safety_buffer_paise - target_amount_paise) >= 0:
        verdict = "TIGHT"
    else:
        verdict = "NO"

    return AffordabilityResult(
        target_amount_paise=target_amount_paise,
        current_balance_paise=closing_balance_paise,
        expected_income_paise=expected_income_paise,
        income_range_min_paise=income_min,
        income_range_max_paise=income_max,
        income_is_variable=income_is_variable,
        committed_payments_paise=committed_payments_paise,
        average_variable_spend_paise=average_variable_spend_paise,
        safety_buffer_paise=safety_buffer_paise,
        safety_buffer_rule=safety_buffer_rule,
        free_cash_before_purchase_paise=free_cash_before_purchase_paise,
        net_after_purchase_paise=net_after_purchase_paise,
        verdict=verdict,
        refusal_reason=None,
        distinct_months=num_months,
        span_days=span_days,
        committed_breakdown=committed_breakdown,
        variable_breakdown=variable_breakdown,
        trace_lines={
            "current_balance": "backend/affordability_engine.py:L187",
            "expected_income": "backend/affordability_engine.py:L125",
            "committed_payments": "backend/affordability_engine.py:L145",
            "average_variable_spend": "backend/affordability_engine.py:L170",
            "safety_buffer": "backend/affordability_engine.py:L174",
            "verdict": "backend/affordability_engine.py:L188",
        },
    )
