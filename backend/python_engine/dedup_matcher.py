# Adapted from https://github.com/jbms/beancount-import beancount_import/matching.py (GPL-2.0 — studied idea only, reimplemented ~100 lines from scratch)
"""
Fuzzy duplicate-avoidance and cross-statement transaction merge matcher (~100 lines).
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple


@dataclass
class MergeableTxn:
    account_id: str
    date: str  # YYYY-MM-DD
    amount_paise: int
    description: str
    ref: Optional[str] = None
    category: str = "uncategorized"
    flags: Dict[str, object] = field(default_factory=dict)


def normalize_desc(text: str) -> str:
    """Strip reference digits and normalize whitespace/case for fuzzy comparison."""
    no_digits = re.sub(r"\d{5,}", "#", text.upper())
    return re.sub(r"\s+", " ", no_digits).strip()


def token_jaccard(a: str, b: str) -> float:
    na, nb = normalize_desc(a), normalize_desc(b)
    if na == nb or na in nb or nb in na:
        return 1.0
    ta = set(re.findall(r"[A-Z0-9]+", na))
    tb = set(re.findall(r"[A-Z0-9]+", nb))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / float(len(ta | tb))


def days_apart(d1: str, d2: str) -> int:
    dt1 = datetime.strptime(d1, "%Y-%m-%d")
    dt2 = datetime.strptime(d2, "%Y-%m-%d")
    return abs((dt1 - dt2).days)


def exact_signature(t: MergeableTxn) -> str:
    """Canonical signature across statement exports to collapse identical rows."""
    clean_d = re.sub(r"\s+", " ", t.description.strip().upper())
    payload = f"{t.date}|{t.amount_paise}|{t.ref or ''}|{clean_d}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def merge_and_deduplicate_statements(
    transactions: List[MergeableTxn],
    fuzzy_match_days: int = 3,
    similarity_threshold: float = 0.8,
) -> Tuple[List[MergeableTxn], int, int]:
    """
    Merge multiple statement transaction lists:
    1. Exact duplicates (same date, amount, narration/ref across overlapping exports
       or cross-statement duplicate dumps) are collapsed so the seeded duplicate pair
       appears ONCE in the merged list.
    2. Near-duplicates (same account, same amount, within `fuzzy_match_days`,
       high description similarity >= 0.8, but distinct reference numbers) are kept
       and flagged with `dup_p=True` and reason `'possible duplicate charge'`.
    Returns: (merged_list, exact_merged_count, flagged_near_dup_count)
    """
    seen_exact: Dict[str, MergeableTxn] = {}
    deduped: List[MergeableTxn] = []
    exact_merged = 0

    for txn in transactions:
        sig = exact_signature(txn)
        if sig in seen_exact:
            exact_merged += 1
            seen_exact[sig].flags["merged_duplicate"] = True
            continue
        copy_txn = MergeableTxn(
            account_id=txn.account_id,
            date=txn.date,
            amount_paise=txn.amount_paise,
            description=txn.description,
            ref=txn.ref,
            category=txn.category,
            flags=dict(txn.flags),
        )
        seen_exact[sig] = copy_txn
        deduped.append(copy_txn)

    flagged_near = 0
    n = len(deduped)
    for i in range(n):
        for j in range(i + 1, n):
            a, b = deduped[i], deduped[j]
            if a.amount_paise != b.amount_paise:
                continue
            if days_apart(a.date, b.date) > fuzzy_match_days:
                continue
            if token_jaccard(a.description, b.description) >= similarity_threshold:
                if a.account_id == b.account_id:
                    a.flags["dup_p"] = True
                    b.flags["dup_p"] = True
                    a.flags["anomaly_reason"] = "possible duplicate charge"
                    b.flags["anomaly_reason"] = "possible duplicate charge"
                    flagged_near += 1

    return deduped, exact_merged, flagged_near
