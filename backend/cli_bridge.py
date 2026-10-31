from __future__ import annotations

import json
import os
import sys
from typing import Dict, List

from backend.pdf_pipeline import extract_pdf_bytes
from backend.csv_adapters import normalize_csv_With_config
from backend.dedup_matcher import MergeableTxn
from backend.recurring_engine import merchant_stem
from backend.app import build_pipeline_snapshot

STATE_FILE = os.path.join(os.getcwd(), ".data", "ps4_state.json")


def load_state() -> Dict[str, object]:
    if not os.path.exists(STATE_FILE):
        return {
            "raw_txns": [],
            "merchant_overrides": {},
            "closing_balance_paise": 18500000,
            "target_amount_paise": 8000000,
        }
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "raw_txns": [],
            "merchant_overrides": {},
            "closing_balance_paise": 18500000,
            "target_amount_paise": 8000000,
        }


def save_state(state: Dict[str, object]) -> None:
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def state_to_txns(raw_list: List[Dict[str, object]]) -> List[MergeableTxn]:
    return [
        MergeableTxn(
            account_id=str(r.get("account_id", "ACCT-1")),
            date=str(r.get("date", "")),
            amount_paise=int(r.get("amount_paise", 0)),
            description=str(r.get("description", "")),
            ref=r.get("ref") if r.get("ref") else None,
        )
        for r in raw_list
    ]


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    action = payload.get("action", "get")
    state = load_state()

    if action == "wipe":
        state = {
            "raw_txns": [],
            "merchant_overrides": {},
            "closing_balance_paise": 18500000,
            "target_amount_paise": 8000000,
        }
        save_state(state)
        snap = build_pipeline_snapshot([], {}, 18500000, 8000000)
        print(json.dumps({"ok": True, "snapshot": snap}))
        return

    if action == "upload":
        # If replace=True is passed, reset before ingesting
        if payload.get("replace", False):
            state["raw_txns"] = []
            state["merchant_overrides"] = {}
        files = payload.get("files", [])
        raw_list: List[Dict[str, object]] = list(state.get("raw_txns", []))  # type: ignore
        closing_bal = int(state.get("closing_balance_paise", 18500000))

        for idx, f_item in enumerate(files):
            fname = str(f_item.get("name", "")).lower()
            acct = str(f_item.get("account_id") or f"ACCT-{idx + 1}")
            content_hex = str(f_item.get("hex", ""))
            raw_bytes = bytes.fromhex(content_hex)

            if fname.endswith(".pdf"):
                pdf_out = extract_pdf_bytes(raw_bytes, account_id=acct)
                if pdf_out.ok:
                    for r in pdf_out.rows:
                        raw_list.append(
                            {
                                "account_id": r.account_id,
                                "date": r.date,
                                "amount_paise": r.amount_paise,
                                "description": r.description,
                                "ref": None,
                            }
                        )
                        if r.balance_paise is not None:
                            closing_bal = r.balance_paise
            else:
                csv_text = raw_bytes.decode("utf-8", errors="ignore")
                rows = normalize_csv_With_config(csv_text, account_id=acct)
                for r in rows:
                    raw_list.append(
                        {
                            "account_id": r.account_id,
                            "date": r.date,
                            "amount_paise": r.amount_paise,
                            "description": r.description,
                            "ref": r.ref,
                        }
                    )
                    if r.balance_paise is not None:
                        closing_bal = r.balance_paise

        state["raw_txns"] = raw_list
        state["closing_balance_paise"] = closing_bal
        save_state(state)

    elif action == "correction":
        merchant = str(payload.get("merchant", ""))
        new_cat = str(payload.get("new_category", "General"))
        stem = merchant_stem(merchant)
        overrides: Dict[str, str] = dict(state.get("merchant_overrides", {}))  # type: ignore
        overrides[stem] = new_cat
        state["merchant_overrides"] = overrides
        save_state(state)

        txns = state_to_txns(state.get("raw_txns", []))  # type: ignore
        snap = build_pipeline_snapshot(
            txns,
            overrides,
            int(state.get("closing_balance_paise", 18500000)),
            int(state.get("target_amount_paise", 8000000)),
        )
        changed_count = sum(1 for tx in snap["transactions"] if tx["merchant"] == stem)
        print(
            json.dumps(
                {
                    "ok": True,
                    "merchant": stem,
                    "new_category": new_cat,
                    "changed_count": changed_count,
                    "note": f"changed {changed_count} similar transactions",
                    "snapshot": snap,
                }
            )
        )
        return

    elif action == "question":
        amount_inr = float(payload.get("amount_inr", 80000))
        target_paise = int(round(amount_inr * 100))
        state["target_amount_paise"] = target_paise
        save_state(state)

    txns = state_to_txns(state.get("raw_txns", []))  # type: ignore
    overrides = dict(state.get("merchant_overrides", {}))  # type: ignore
    snap = build_pipeline_snapshot(
        txns,
        overrides,
        int(state.get("closing_balance_paise", 18500000)),
        int(state.get("target_amount_paise", 8000000)),
    )
    print(json.dumps({"ok": True, "snapshot": snap}))


if __name__ == "__main__":
    main()
