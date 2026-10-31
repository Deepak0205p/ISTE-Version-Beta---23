from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
import re
from datetime import datetime

class UserProfile(BaseModel):
    full_name: str = Field(..., description="Full name of user e.g. 'Aman Yadav'")
    dob: str = Field(..., description="Date of birth in YYYY-MM-DD e.g. '2003-05-14'")
    pan_number: str = Field(..., description="Indian PAN number e.g. 'ABCDE1234F'")
    registered_mobile: str = Field(..., description="10-digit mobile number e.g. '9876543210'")
    known_cards: Dict[str, str] = Field(
        default_factory=dict,
        description="Bank to last 4 digits mapping e.g. {'HDFC': '4321', 'SBI': '8765'}"
    )

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("DOB must be in YYYY-MM-DD format")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", clean):
            raise ValueError(f"Invalid Indian PAN format: {v}")
        return clean

    @field_validator("registered_mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) == 10:
            return digits
        elif len(digits) == 12 and digits.startswith("91"):
            return digits[2:]
        raise ValueError(f"Mobile must be 10 digits: {v}")


def generate_bank_passwords(user: UserProfile, bank_name: Optional[str] = None) -> List[str]:
    """
    Derives deterministic, prioritized password permutations according to 
    Indian banking credit card e-statement encryption norms:
      - HDFC: First 4 characters of name + DDMM of birth
      - SBI: DDMM + last 4 digits of card number (or DDMMYYYY / last 4 card + DDMM)
      - ICICI: First 4 characters of name (lowercase) + DDMM
      - Axis: First 4 characters of name (uppercase) + last 4 digits of card (or DDMM + last 4)
      - Standard Fallbacks: PAN (uppercase/lowercase), DOB combinations (DDMMYYYY, DDMMYY)
    """
    dob_dt = datetime.strptime(user.dob, "%Y-%m-%d")
    dd = f"{dob_dt.day:02d}"
    mm = f"{dob_dt.month:02d}"
    yyyy = f"{dob_dt.year:04d}"
    yy = yyyy[-2:]
    ddmm = f"{dd}{mm}"
    ddmmyyyy = f"{dd}{mm}{yyyy}"
    ddmmyy = f"{dd}{mm}{yy}"

    clean_name = re.sub(r"[^a-zA-Z]", "", user.full_name)
    name_4 = clean_name[:4] if len(clean_name) >= 4 else clean_name.ljust(4, "X")

    normalized_bank = (bank_name or "").upper().strip()
    last4 = user.known_cards.get(normalized_bank, "")

    # Look for partial matches if not exact
    if not last4:
        for b, digits in user.known_cards.items():
            if b.upper() in normalized_bank or normalized_bank in b.upper():
                last4 = digits
                break

    candidates: List[str] = []

    def add(pw: Optional[str]):
        if pw and pw not in candidates:
            candidates.append(pw)

    # 1. Bank-Specific Primaries
    if "HDFC" in normalized_bank:
        add(f"{name_4.lower()}{ddmm}")
        add(f"{name_4.upper()}{ddmm}")
        add(f"{name_4.title()}{ddmm}")
        add(f"{clean_name.lower()[:4]}{ddmm}")
        add(f"{user.pan_number.lower()}")
        add(f"{user.pan_number.upper()}")
        if last4:
            add(f"{name_4.lower()}{last4}")
            add(f"{name_4.upper()}{last4}")

    elif "SBI" in normalized_bank:
        if last4:
            add(f"{ddmm}{last4}")
            add(f"{last4}{ddmm}")
        add(ddmmyyyy)
        add(ddmm)
        add(f"{user.pan_number.upper()}")
        add(f"{name_4.lower()}{ddmm}")

    elif "ICICI" in normalized_bank:
        add(f"{name_4.lower()}{ddmm}")
        add(f"{name_4.upper()}{ddmm}")
        add(ddmmyyyy)
        if last4:
            add(f"{name_4.lower()}{last4}")
        add(f"{user.pan_number.lower()}")

    elif "AXIS" in normalized_bank:
        if last4:
            add(f"{name_4.upper()}{last4}")
            add(f"{name_4.lower()}{last4}")
            add(f"{ddmm}{last4}")
        add(f"{name_4.upper()}{ddmm}")
        add(ddmmyyyy)

    # 2. Universal Indian Banking Password Fallback Matrix
    # (Covers Kotak, RBL, IndusInd, Standard Chartered, HSBC, Yes Bank, IDFC First)
    if last4:
        add(f"{name_4.lower()}{last4}")
        add(f"{name_4.upper()}{last4}")
        add(f"{ddmm}{last4}")
        add(f"{last4}{ddmm}")

    add(f"{name_4.lower()}{ddmm}")
    add(f"{name_4.upper()}{ddmm}")
    add(f"{name_4.title()}{ddmm}")
    add(ddmmyyyy)
    add(ddmmyy)
    add(ddmm)
    add(user.pan_number.upper())
    add(user.pan_number.lower())
    add(user.registered_mobile[-4:])
    add(user.registered_mobile)

    return candidates
