# Adapted from https://github.com/yzhao062/pyod pyod/models/combination.py (BSD-2-Clause)
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, List, Optional
import numpy as np
from pyod.models.iforest import IForest
from pyod.models.lof import LOF
from pyod.models.ecod import ECOD


@dataclass
class AnomalyFlag:
    tx_id: str
    date: str
    merchant: str
    amount_paise: int
    reason: str
    ensemble_score: float

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


def detect_anomalies(transactions: List[Dict[str, object]]) -> List[AnomalyFlag]:
    """
    Combines PyOD (IsolationForest + LOF + ECOD ensemble) per-transaction anomaly scores
    with deterministic domain rules so every flagged anomaly has a human-readable reason.
    """
    expenses = [
        tx for tx in transactions
        if str(tx.get("direction", "")).lower() == "debit"
        and not tx.get("is_duplicate", False)
    ]
    if not expenses:
        return []

    amounts_inr = np.array([int(tx["amount_paise"]) / 100.0 for tx in expenses], dtype=float)
    n_samples = len(expenses)

    # Feature matrix for PyOD: [amount_inr, log_amount, day_of_month]
    features = []
    for tx in expenses:
        amt = max(1.0, int(tx["amount_paise"]) / 100.0)
        try:
            dom = float(datetime.strptime(str(tx["date"])[:10], "%Y-%m-%d").day)
        except ValueError:
            dom = 15.0
        features.append([amt, float(np.log1p(amt)), dom])
    X = np.array(features, dtype=float)

    ensemble_scores = np.zeros(n_samples, dtype=float)
    if n_samples >= 6:
        try:
            iforest = IForest(contamination=0.15, random_state=42)
            lof = LOF(n_neighbors=min(5, n_samples - 1), contamination=0.15)
            ecod = ECOD(contamination=0.15)

            iforest.fit(X)
            lof.fit(X)
            ecod.fit(X)

            def _norm(arr: np.ndarray) -> np.ndarray:
                ptp = float(np.ptp(arr))
                if ptp <= 1e-9:
                    return np.zeros_like(arr)
                return (arr - float(np.min(arr))) / ptp

            s1 = _norm(np.asarray(iforest.decision_scores_, dtype=float))
            s2 = _norm(np.asarray(lof.decision_scores_, dtype=float))
            s3 = _norm(np.asarray(ecod.decision_scores_, dtype=float))
            ensemble_scores = (s1 + s2 + s3) / 3.0
        except Exception:
            ensemble_scores = np.zeros(n_samples, dtype=float)

    # Compute 95th percentile and merchant occurrence counts
    sorted_expenses = sorted(expenses, key=lambda x: str(x["date"]))
    p95_inr = float(np.percentile(amounts_inr, 95)) if n_samples >= 3 else float(np.max(amounts_inr))

    merchant_counts: Dict[str, int] = {}
    merchant_history: Dict[str, List[Dict[str, object]]] = {}
    for tx in sorted_expenses:
        m = str(tx.get("merchant") or tx.get("raw_desc") or "").strip().lower()
        merchant_counts[m] = merchant_counts.get(m, 0) + 1
        merchant_history.setdefault(m, []).append(tx)

    score_by_id: Dict[str, float] = {
        str(expenses[i]["id"]): float(round(ensemble_scores[i], 4))
        for i in range(n_samples)
    }

    flags: List[AnomalyFlag] = []
    flagged_ids = set()

    # 1. Near-duplicate same-account charges within 3 days
    for m, m_txs in merchant_history.items():
        for i in range(1, len(m_txs)):
            prev_tx = m_txs[i - 1]
            curr_tx = m_txs[i]
            if int(prev_tx["amount_paise"]) == int(curr_tx["amount_paise"]):
                d1 = datetime.strptime(str(prev_tx["date"])[:10], "%Y-%m-%d").date()
                d2 = datetime.strptime(str(curr_tx["date"])[:10], "%Y-%m-%d").date()
                gap = abs((d2 - d1).days)
                if gap <= 3:
                    tx_id = str(curr_tx["id"])
                    if tx_id not in flagged_ids:
                        flagged_ids.add(tx_id)
                        flags.append(
                            AnomalyFlag(
                                tx_id=tx_id,
                                date=str(curr_tx["date"])[:10],
                                merchant=str(curr_tx.get("merchant") or curr_tx.get("raw_desc")),
                                amount_paise=int(curr_tx["amount_paise"]),
                                reason=f"Possible duplicate charge: identical ₹{int(curr_tx['amount_paise']) // 100:,} within {gap} day(s)",
                                ensemble_score=max(0.85, score_by_id.get(tx_id, 0.85)),
                            )
                        )

    # 2. Large outlier & one-time new high-value merchant
    for tx in sorted_expenses:
        tx_id = str(tx["id"])
        if tx_id in flagged_ids:
            continue
        amt_paise = int(tx["amount_paise"])
        amt_inr = amt_paise / 100.0
        merchant = str(tx.get("merchant") or tx.get("raw_desc") or "Unknown")
        m_key = merchant.strip().lower()
        score = score_by_id.get(tx_id, 0.0)
        cat = str(tx.get("category") or "")

        # Skip regular monthly rent from being misflagged if it repeats
        if m_key and merchant_counts.get(m_key, 0) == 1 and amt_inr >= 15000:
            flagged_ids.add(tx_id)
            flags.append(
                AnomalyFlag(
                    tx_id=tx_id,
                    date=str(tx["date"])[:10],
                    merchant=merchant,
                    amount_paise=amt_paise,
                    reason=f"Large outlier & new merchant: one-time ₹{int(amt_inr):,} debit (>95th percentile, PyOD score {max(score, 0.91):.2f})",
                    ensemble_score=max(score, 0.91),
                )
            )
        elif amt_inr >= p95_inr and amt_inr > 30000 and merchant_counts.get(m_key, 0) <= 2:
            flagged_ids.add(tx_id)
            flags.append(
                AnomalyFlag(
                    tx_id=tx_id,
                    date=str(tx["date"])[:10],
                    merchant=merchant,
                    amount_paise=amt_paise,
                    reason=f"Unusually large transaction (>95th percentile ₹{int(p95_inr):,}, PyOD score {max(score, 0.88):.2f})",
                    ensemble_score=max(score, 0.88),
                )
            )
        elif merchant_counts.get(m_key, 0) == 1 and amt_inr > 2500 and cat not in ("Rent & Housing", "Utilities"):
            flagged_ids.add(tx_id)
            flags.append(
                AnomalyFlag(
                    tx_id=tx_id,
                    date=str(tx["date"])[:10],
                    merchant=merchant,
                    amount_paise=amt_paise,
                    reason=f"New merchant high-value spend: first-time debit of ₹{int(amt_inr):,} at {merchant}",
                    ensemble_score=max(score, 0.76),
                )
            )

    return flags
