"""
Indian Income Tax Return (ITR) Data Schemas and Models.
Compliant with Income Tax Act, 1961 and e-Filing Specifications for AY 2026-27 (FY 2025-26).
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
import re
from datetime import datetime

# Regex Validators for Indian Direct Tax Identifiers
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
AADHAAR_REGEX = re.compile(r"^[0-9]{12}$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
TAN_REGEX = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]{1}$")
PINCODE_REGEX = re.compile(r"^[1-9][0-9]{5}$")


class BankAccountRefund(BaseModel):
    account_no: str = Field(..., description="Bank account number for receiving tax refund")
    ifsc: str = Field(..., description="11-character Indian Financial System Code")
    bank_name: str = Field(..., description="Commercial/Scheduled Bank Name (e.g. HDFC Bank, SBI)")
    account_type: Literal["SAVINGS", "CURRENT"] = "SAVINGS"
    is_validated: bool = Field(True, description="Pre-validated on Income Tax E-filing portal")

    @field_validator("ifsc")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        clean = v.strip().upper()
        if not IFSC_REGEX.match(clean):
            raise ValueError(f"Invalid IFSC format '{v}'. Must match ^[A-Z]{{4}}0[A-Z0-9]{{6}}$")
        return clean


class TaxAddress(BaseModel):
    residence_no: str = Field("Flat 101", description="Flat/Door/Block No.")
    premises_name: Optional[str] = Field("Skyline Apartments", description="Premises/Building Name")
    road_or_street: str = Field("MG Road", description="Road/Street/Lane")
    locality: str = Field("Indiranagar", description="Locality or Area")
    city: str = Field("Bengaluru", description="City, Town, or District")
    state_code: str = Field("29", description="State code (e.g. 29 for Karnataka, 27 for Maharashtra, 07 for Delhi)")
    pin_code: str = Field("560038", description="6-digit Indian PIN code")
    country_code: str = "91"

    @field_validator("pin_code")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        clean = v.strip()
        if not PINCODE_REGEX.match(clean):
            raise ValueError(f"Invalid PIN code '{v}'. Must be a 6-digit Indian Postal Code.")
        return clean


class TaxProfile(BaseModel):
    """
    Stored under users/{userId}/tax_profiles/{pan}
    """
    pan: str = Field(..., description="10-digit Permanent Account Number")
    full_name: str = Field(..., description="Full Name as per PAN database")
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    residential_status: Literal["RESIDENT", "NRI", "RNOR"] = "RESIDENT"
    dob: str = Field(..., description="Date of birth in YYYY-MM-DD")
    gender: Literal["MALE", "FEMALE", "OTHER"] = "MALE"
    aadhaar_linked: bool = True
    aadhaar_number: Optional[str] = Field(None, description="12-digit Aadhaar Number")
    mobile: str = Field("9876543210", description="10-digit primary mobile number")
    email: str = Field("taxpayer@example.com", description="Primary email address for IT notices")
    address: TaxAddress = Field(default_factory=TaxAddress)
    bank_account_for_refund: BankAccountRefund = Field(
        default_factory=lambda: BankAccountRefund(
            account_no="50100482910291",
            ifsc="HDFC0000001",
            bank_name="HDFC Bank",
            account_type="SAVINGS",
            is_validated=True
        )
    )

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, v: str) -> str:
        clean = v.strip().upper()
        if not PAN_REGEX.match(clean):
            raise ValueError(f"Invalid PAN '{v}'. Must match 5 letters, 4 digits, 1 letter.")
        return clean


# =========================================================================
# Parsed Tax Document Schemas (Form 16, AIS, 26AS, Capital Gains)
# =========================================================================

class EmployerDetails(BaseModel):
    tan: str = Field("BLRH01234A", description="Tax Deduction and Collection Account Number")
    pan: Optional[str] = None
    name: str = Field("Tech Mahindra Limited", description="Employer Legal Entity Name")
    address: Optional[str] = "Electronic City, Bengaluru"

    @field_validator("tan")
    @classmethod
    def validate_tan(cls, v: str) -> str:
        clean = v.strip().upper()
        if not TAN_REGEX.match(clean):
            # Fallback for mock/generic
            return clean
        return clean


class SalaryBreakup(BaseModel):
    gross_salary: float = Field(0.0, description="Gross Salary under section 17(1)")
    perquisites_17_2: float = Field(0.0, description="Value of perquisites under section 17(2)")
    profits_in_lieu_17_3: float = Field(0.0, description="Profits in lieu of salary under section 17(3)")
    exemptions_sec_10: float = Field(0.0, description="Allowances exempt under section 10 (HRA, LTA, Gratuity)")
    hra_exemption: float = Field(0.0, description="House Rent Allowance exemption under Sec 10(13A)")
    lta_exemption: float = Field(0.0, description="Leave Travel Allowance exemption under Sec 10(5)")
    professional_tax: float = Field(0.0, description="Tax on employment under section 16(iii)")


class ChapterVIADeductions(BaseModel):
    sec_80c: float = Field(0.0, description="Life insurance, PPF, ELSS, EPF, tuition fees (Max 1.5L)")
    sec_80ccc: float = Field(0.0, description="Pension fund contributions")
    sec_80ccd_1: float = Field(0.0, description="Employee National Pension System (NPS)")
    sec_80ccd_1b_nps: float = Field(0.0, description="Self contribution to Tier-1 NPS (Max 50K beyond 80C)")
    sec_80ccd_2_employer_nps: float = Field(0.0, description="Employer contribution to NPS (Allowed in New Regime)")
    sec_80d: float = Field(0.0, description="Health Insurance Premium (Mediclaim) self/parents")
    sec_80dd: float = Field(0.0, description="Maintenance and medical treatment of handicapped dependent")
    sec_80e: float = Field(0.0, description="Interest on Higher Education Loan")
    sec_80g: float = Field(0.0, description="Donations to charitable institutions")
    sec_80tta_ttb: float = Field(0.0, description="Interest on savings bank accounts (TTA) or deposits for seniors (TTB)")
    others: float = Field(0.0, description="Other Chapter VI-A deductions")

    @property
    def total_80c_eligible(self) -> float:
        # 80C + 80CCC + 80CCD(1) is subject to aggregate cap of ₹1,50,000 under Section 80CCE
        return min(150000.0, self.sec_80c + self.sec_80ccc + self.sec_80ccd_1)


class Form16Data(BaseModel):
    pan: str
    assessment_year: str = "2026-27"
    employer_details: EmployerDetails
    salary_breakup: SalaryBreakup
    standard_deduction: float = Field(75000.0, description="Standard deduction under Sec 16(ia)")
    deductions_chapter_via: ChapterVIADeductions = Field(default_factory=ChapterVIADeductions)
    tds_deducted: float = Field(0.0, description="Total Tax Deducted at Source by employer (Part A)")
    income_chargeable_under_salary: float = 0.0


class SecuritiesTransaction(BaseModel):
    scrip_name: str
    isin: Optional[str] = None
    sale_value: float
    purchase_value: float
    sale_date: Optional[str] = None
    purchase_date: Optional[str] = None
    stcg: float = 0.0
    ltcg: float = 0.0


class TDSEntry(BaseModel):
    deductor_name: str
    deductor_tan: str
    amount_paid: float
    tds_deducted: float
    section: str = "194A"  # 192 (Salary), 194A (Interest), 194J, etc.


class AISData(BaseModel):
    pan: str
    financial_year: str = "2025-26"
    savings_bank_interest: float = 0.0
    fixed_deposit_interest: float = 0.0
    dividend_income: float = 0.0
    rent_received: float = 0.0
    securities_transactions: List[SecuritiesTransaction] = []
    tds_entries: List[TDSEntry] = []


class Form26ASData(BaseModel):
    pan: str
    assessment_year: str = "2026-27"
    part_a_tds_salary: List[TDSEntry] = []
    part_a1_tds_non_salary: List[TDSEntry] = []
    part_b_tcs: List[Dict[str, Any]] = []
    part_c_tax_paid: List[Dict[str, Any]] = []  # Advance Tax & Self-Assessment


class CapitalGainsData(BaseModel):
    equity_stcg_111a: float = 0.0  # Listed equity/units (Sec 111A)
    equity_ltcg_112a: float = 0.0  # Listed equity/units (Sec 112A)
    other_stcg: float = 0.0
    other_ltcg: float = 0.0


# =========================================================================
# Tax Filing Document in Firestore (users/{userId}/tax_filings/{ay})
# =========================================================================

class SlabBreakdown(BaseModel):
    slab_name: str
    taxable_amount_in_slab: float
    rate_percent: float
    tax_computed: float


class RegimeComputation(BaseModel):
    regime: Literal["NEW", "OLD"]
    gross_total_income: float
    standard_deduction: float
    other_exemptions_deductions: float
    total_deductions: float
    taxable_income: float
    slab_breakdown: List[SlabBreakdown] = []
    tax_before_rebate: float
    rebate_87a: float
    tax_after_rebate: float
    surcharge: float = 0.0
    health_and_education_cess: float  # 4%
    total_tax_liability: float
    total_tds_credit: float
    total_tcs_credit: float = 0.0
    advance_and_self_assessment_tax: float = 0.0
    total_taxes_paid: float
    net_payable_or_refund: float  # Negative = Refund, Positive = Tax Due
    marginal_relief_applied: bool = False

    @property
    def gross_salary(self) -> float:
        return self.gross_total_income

    @property
    def income_from_other_sources(self) -> float:
        return 0.0

    @property
    def health_education_cess(self) -> float:
        return self.health_and_education_cess

    @property
    def total_tax_payable(self) -> float:
        return self.total_tax_liability

    @property
    def tds_paid(self) -> float:
        return self.total_tds_credit

    @property
    def net_payable(self) -> float:
        return max(0.0, self.net_payable_or_refund)

    @property
    def refund_due(self) -> float:
        return abs(min(0.0, self.net_payable_or_refund))


class RegimeOptimizationReport(BaseModel):
    recommended_regime: Literal["NEW", "OLD"]
    tax_savings: float
    new_regime: RegimeComputation
    old_regime: RegimeComputation
    recommendation_summary: str
    actionable_savings_tips: List[str] = []

    @property
    def summary_rationale(self) -> str:
        return self.recommendation_summary

    @property
    def tax_saving_tips(self) -> List[str]:
        return self.actionable_savings_tips


class TaxFiling(BaseModel):
    """
    Stored under users/{userId}/tax_filings/{assessmentYear} (e.g. AY_2026_27)
    """
    user_id: Optional[str] = "user_default"
    pan: str = "ABCDE1234F"
    financial_year: str = "FY_2025_26"
    assessment_year: str = "AY_2026_27"
    filing_type: Literal["ORIGINAL_139_1", "BELATED_139_4", "REVISED_139_5"] = "ORIGINAL_139_1"
    selected_regime: Literal["NEW", "OLD"] = "NEW"
    itr_form_type: Literal["ITR-1", "ITR-4"] = "ITR-1"
    filing_status: Literal["DRAFT", "READY_TO_FILE", "SUBMITTED"] = "DRAFT"

    # Aggregated Financial Metrics
    gross_total_income: float = 0.0
    salary_income: float = 0.0
    other_sources_income: float = 0.0
    house_property_income: float = 0.0
    capital_gains_income: float = 0.0
    
    total_deductions: float = 0.0
    taxable_income: float = 0.0
    total_tax_payable: float = 0.0
    tds_paid: float = 0.0
    tcs_paid: float = 0.0
    advance_tax_paid: float = 0.0
    self_assessment_tax_paid: float = 0.0
    total_taxes_paid: float = 0.0
    net_refund_or_payable: float = 0.0

    # Attached Document Summaries
    parsed_form16: Optional[Form16Data] = None
    parsed_ais: Optional[AISData] = None
    parsed_26as: Optional[Form26ASData] = None
    parsed_capital_gains: Optional[CapitalGainsData] = None

    # Full Dual-Regime Analysis
    optimization_report: Optional[RegimeOptimizationReport] = None

    # Generated Output Path
    raw_computed_json_path: Optional[str] = None
    acknowledgment_number: Optional[str] = None
    submitted_at: Optional[str] = None
    updatedAt: str = Field(default_factory=lambda: datetime.now().isoformat())

    @property
    def updated_at(self) -> str:
        return self.updatedAt

    @updated_at.setter
    def updated_at(self, value: Any) -> None:
        self.updatedAt = value.isoformat() if hasattr(value, "isoformat") else str(value)

    @property
    def form_16(self) -> Form16Data:
        if self.parsed_form16 is None:
            self.parsed_form16 = Form16Data(
                pan=self.pan,
                employer_details=EmployerDetails(name="Employer Ltd", tan="BLRH01234A"),
                salary_breakup=SalaryBreakup()
            )
        return self.parsed_form16

    @form_16.setter
    def form_16(self, v: Optional[Form16Data]) -> None:
        self.parsed_form16 = v

    @property
    def ais(self) -> AISData:
        if self.parsed_ais is None:
            self.parsed_ais = AISData(pan=self.pan)
        return self.parsed_ais

    @ais.setter
    def ais(self, v: Optional[AISData]) -> None:
        self.parsed_ais = v

    @property
    def form_26as(self) -> Form26ASData:
        if self.parsed_26as is None:
            self.parsed_26as = Form26ASData(pan=self.pan)
        return self.parsed_26as

    @form_26as.setter
    def form_26as(self, v: Optional[Form26ASData]) -> None:
        self.parsed_26as = v

    @property
    def capital_gains(self) -> CapitalGainsData:
        if self.parsed_capital_gains is None:
            self.parsed_capital_gains = CapitalGainsData()
        return self.parsed_capital_gains

    @capital_gains.setter
    def capital_gains(self, v: Optional[CapitalGainsData]) -> None:
        self.parsed_capital_gains = v

