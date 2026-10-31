# Adapted from https://github.com/bank2ynab/bank2ynab bank2ynab/config_handler.py (MIT License)
"""
Config-driven CSV column-mapping normalizer for multiple bank formats (HDFC, SBI, ICICI).
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass(frozen=True)
class BankAdapterConfig:
    bank_id: str
    bank_name: str
    date_col: str
    narration_col: str
    debit_col: Optional[str]
    credit_col: Optional[str]
    amount_col: Optional[str]
    balance_col: str
    ref_col: Optional[str]
    date_formats: Tuple[str, ...]


from typing import Tuple

BANK_CONFIGS: Dict[str, BankAdapterConfig] = {
    "hdfc": BankAdapterConfig(
        bank_id="hdfc",
        bank_name="HDFC Bank",
        date_col="Date",
        narration_col="Narration",
        debit_col="Withdrawal Amt.",
        credit_col="Deposit Amt.",
        amount_col=None,
        balance_col="Closing Balance",
        ref_col="Chq./Ref.No.",
        date_formats=("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"),
    ),
    "sbi": BankAdapterConfig(
        bank_id="sbi",
        bank_name="State Bank of India",
        date_col="Txn Date",
        narration_col="Description",
        debit_col="Debit",
        credit_col="Credit",
        amount_col=None,
        balance_col="Balance",
        ref_col="Ref No./Cheque No.",
        date_formats=("%d %b %Y", "%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d"),
    ),
    "icici": BankAdapterConfig(
        bank_id="icici",
        bank_name="ICICI Bank",
        date_col="Transaction Date",
        narration_col="Transaction Remarks",
        debit_col="Withdrawal Amount (INR )",
        credit_col="Deposit Amount (INR )",
        amount_col=None,
        balance_col="Balance (INR )",
        ref_col="Cheque Number",
        date_formats=("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"),
    ),
}


@dataclass
class NormalizedCsvRow:
    account_id: str
    date: str
    description: str
    clean_narration: str
    amount_paise: int
    balance_paise: Optional[int]
    ref: Optional[str]


def detect_bank_config(header_row: List[str]) -> Optional[BankAdapterConfig]:
    normalized = {h.strip().lower() for h in header_row}
    for cfg in BANK_CONFIGS.values():
        if cfg.date_col.lower() in normalized and cfg.narration_col.lower() in normalized:
            return cfg
    return None


def parse_money_paise(raw: Optional[str]) -> int:
    if not raw:
        return 0
    s = raw.strip()
    if not s:
        return 0
    sign = -1 if ("dr" in s.lower() or s.startswith("-")) else 1
    cleaned = re.sub(r"[^0-9.]", "", s)
    if not cleaned:
        return 0
    return sign * int(round(float(cleaned) * 100))


def parse_config_date(raw: str, formats: Tuple[str, ...]) -> str:
    s = raw.strip()
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date '{raw}' for configured formats {formats}")


def normalize_csv_With_config(csv_text: str, account_id: str) -> List[NormalizedCsvRow]:
    reader = csv.reader(io.StringIO(csv_text.strip()))
    all_rows = [r for r in reader if any(c.strip() for c in r)]
    if not all_rows:
        return []

    header = [h.strip() for h in all_rows[0]]
    cfg = detect_bank_config(header)
    if cfg is None:
        raise ValueError(f"Unsupported CSV header format: {header}")

    col_map = {h.lower(): idx for idx, h in enumerate(header)}

    def get_cell(row: List[str], col_name: Optional[str]) -> str:
        if not col_name:
            return ""
        idx = col_map.get(col_name.lower())
        if idx is None or idx >= len(row):
            return ""
        return row[idx].strip()

    out: List[NormalizedCsvRow] = []
    for row in all_rows[1:]:
        raw_date = get_cell(row, cfg.date_col)
        if not raw_date:
            continue
        iso_date = parse_config_date(raw_date, cfg.date_formats)
        narration = get_cell(row, cfg.narration_col)
        clean_narr = re.sub(r"\s+", " ", narration).strip().upper()

        debit_paise = abs(parse_money_paise(get_cell(row, cfg.debit_col)))
        credit_paise = abs(parse_money_paise(get_cell(row, cfg.credit_col)))
        if debit_paise > 0 and credit_paise == 0:
            amount_paise = -debit_paise
        elif credit_paise > 0 and debit_paise == 0:
            amount_paise = credit_paise
        else:
            amount_paise = parse_money_paise(get_cell(row, cfg.amount_col))

        bal_str = get_cell(row, cfg.balance_col)
        bal_paise = parse_money_paise(bal_str) if bal_str else None
        ref_str = get_cell(row, cfg.ref_col) or None

        out.append(
            NormalizedCsvRow(
                account_id=account_id,
                date=iso_date,
                description=narration,
                clean_narration=clean_narr,
                amount_paise=amount_paise,
                balance_paise=bal_paise,
                ref=ref_str,
            )
        )

    return out
