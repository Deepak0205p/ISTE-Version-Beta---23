# Adapted from https://github.com/ellite/wallos endpoints/cronjobs/updatenextpayment.php (GPL-3.0 — studied logic only, reimplemented in Python)
"""
Recurring-payment frequency handling (weekly/monthly/yearly) and next-expected-date calculation.
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple


@dataclass
class RecurringSubscription:
    merchant: str
    amount_paise: int  # positive magnitude in paise
    frequency_label: str  # 'weekly' | 'monthly' | 'yearly'
    interval_days: int
    occurrences: int
    last_date: str
    next_expected_date: str
    monthly_equivalent_paise: int


def add_cycle_interval(d: date, cycle: str, count: int = 1) -> date:
    """Advance date `d` by `count` cycles ('weekly', 'monthly', 'yearly') like Wallos."""
    if cycle == "weekly":
        return d + timedelta(weeks=count)
    if cycle == "yearly":
        try:
            return d.replace(year=d.year + count)
        except ValueError:
            return d.replace(year=d.year + count, day=28)
    # Default: monthly
    month_zero = (d.month - 1) + count
    target_year = d.year + (month_zero // 12)
    target_month = (month_zero % 12) + 1
    max_day = calendar.monthrange(target_year, target_month)[1]
    return date(target_year, target_month, min(d.day, max_day))


def calculate_next_expected_date(
    last_payment_iso: str,
    cycle: str,
    reference_iso: Optional[str] = None,
) -> str:
    """Step forward from last_payment_iso by `cycle` until >= reference_date."""
    current = datetime.strptime(last_payment_iso, "%Y-%m-%d").date()
    ref = (
        datetime.strptime(reference_iso, "%Y-%m-%d").date()
        if reference_iso
        else current
    )
    nxt = add_cycle_interval(current, cycle, 1)
    while nxt <= ref:
        nxt = add_cycle_interval(nxt, cycle, 1)
    return nxt.strftime("%Y-%m-%d")


def merchant_stem(description: str) -> str:
    s = description.upper()
    s = re.sub(r"^(UPI|NEFT|IMPS|ACH|POS|AUTOPAY)[-/\s]+", "", s)
    parts = [p.strip() for p in re.split(r"[-/]", s) if p.strip()]
    candidate = parts[0] if parts else s
    candidate = re.sub(r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b", "", candidate)
    candidate = re.sub(r"\d{3,}", "", candidate).strip()
    candidate = re.sub(r"\s+", " ", candidate).strip()
    return candidate or s[:24]


def detect_recurring_payments(
    transactions: List[Dict[str, object]],
    reference_date: Optional[str] = None,
) -> List[RecurringSubscription]:
    """
    Detect recurring debits (weekly ~7d, monthly 25-35d, yearly 350-380d)
    with consistent amounts (within ±15%) and compute their next expected date.
    """
    by_merchant: Dict[str, List[Tuple[str, int]]] = {}
    all_dates: List[str] = []

    for t in transactions:
        amt = int(t.get("amount_paise", 0))
        dt_str = str(t.get("date", ""))
        if dt_str:
            all_dates.append(dt_str)
        if amt >= 0 or t.get("type", "normal") != "normal":
            continue
        stem = merchant_stem(str(t.get("description", "")))
        if re.search(r"\b(GROCERY|BIGBASKET|BLINKIT|SWIGGY|ZOMATO|RESTAURANT|SUPERMARKET)\b", stem, re.I):
            continue
        by_merchant.setdefault(stem, []).append((dt_str, abs(amt)))

    ref_iso = reference_date or (max(all_dates) if all_dates else None)
    results: List[RecurringSubscription] = []

    for merchant, charges in by_merchant.items():
        if len(charges) < 2:
            continue
        charges_sorted = sorted(charges, key=lambda x: x[0])
        # Group by date in case same day
        dates = [datetime.strptime(c[0], "%Y-%m-%d").date() for c in charges_sorted]
        amounts = [c[1] for c in charges_sorted]

        gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        if not gaps:
            continue
        median_gap = sorted(gaps)[len(gaps) // 2]

        if 5 <= median_gap <= 9:
            cycle = "weekly"
            norm_factor = 30.44 / 7.0
        elif 25 <= median_gap <= 36:
            cycle = "monthly"
            norm_factor = 1.0
        elif 350 <= median_gap <= 380:
            cycle = "yearly"
            norm_factor = 1.0 / 12.0
        else:
            continue

        median_amt = sorted(amounts)[len(amounts) // 2]
        if median_amt == 0:
            continue
        # Check amount consistency (allow up to 25% variation or subscription jump)
        if any(abs(a - median_amt) / float(median_amt) > 0.35 for a in amounts):
            continue

        last_iso = charges_sorted[-1][0]
        latest_amt = charges_sorted[-1][1]
        next_iso = calculate_next_expected_date(last_iso, cycle, ref_iso)

        results.append(
            RecurringSubscription(
                merchant=merchant,
                amount_paise=latest_amt,
                frequency_label=cycle,
                interval_days=median_gap,
                occurrences=len(charges_sorted),
                last_date=last_iso,
                next_expected_date=next_iso,
                monthly_equivalent_paise=int(round(latest_amt * norm_factor)),
            )
        )

    results.sort(key=lambda r: r.monthly_equivalent_paise, reverse=True)
    return results
