"""
Automated Indian Income Tax Computation & Regime Optimizer Engine.
Financial Year: 2025-26 (Assessment Year: 2026-27).
Implements precise statutory rules for Section 115BAC (New Regime) and Old Tax Regime,
including Section 87A rebates, marginal relief, Chapter VI-A deductions, and Sec 288A/B rounding.
"""

from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from .tax_schema import (
    RegimeComputation,
    SlabBreakdown,
    RegimeOptimizationReport,
    ChapterVIADeductions,
    SalaryBreakup,
    Form16Data,
    AISData,
    Form26ASData
)


def round_to_nearest_ten(amount: float) -> float:
    """
    Statutory rounding off under Section 288A (Total Income) and
    Section 288B (Tax Payable / Refund) to the nearest multiple of 10 rupees.
    """
    d = Decimal(str(amount))
    rounded = (d / Decimal('10')).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * Decimal('10')
    return float(rounded)


def compute_new_regime_tax(
    gross_income: Optional[float] = None,
    is_salaried: bool = True,
    sec_80ccd_2: float = 0.0,
    is_resident: bool = True,
    total_taxes_paid: float = 0.0,
    gross_salary: Optional[float] = None,
    income_from_other_sources: float = 0.0,
    tds_paid: float = 0.0
) -> RegimeComputation:
    """
    Computes tax under Section 115BAC (New Tax Regime - Default for FY 2025-26 / AY 2026-27).
    - Standard deduction: ₹75,000 for salaried employees / pensioners.
    - Slabs:
        0 to 3,00,000: Nil
        3,00,001 to 7,00,000: 5%
        7,00,001 to 10,00,000: 10%
        10,00,001 to 12,00,000: 15%
        12,00,001 to 15,00,000: 20%
        Above 15,00,000: 30%
    - Sec 87A Rebate: Full rebate up to ₹25,000 if taxable income <= ₹7,00,000.
    - Sec 87A Marginal Relief: If taxable income is between 7,00,000 and 7,27,778.
    - Cess: 4% Health & Education Cess.
    """
    if gross_income is None:
        gross_income = (gross_salary or 0.0) + income_from_other_sources
    if tds_paid > 0:
        total_taxes_paid = tds_paid
    # 1. Deductions
    std_deduction = 75000.0 if is_salaried else 0.0
    other_deductions = max(0.0, sec_80ccd_2)  # Only 80CCD(2) employer NPS is allowed in New Regime
    total_deductions = std_deduction + other_deductions

    # 2. Taxable Income
    raw_taxable = max(0.0, gross_income - total_deductions)
    taxable_income = round_to_nearest_ten(raw_taxable)

    # 3. Slab computation
    slab_breakdowns: List[SlabBreakdown] = []
    tax_before_rebate = 0.0

    # Slab 1: 0 to 3,00,000 @ 0%
    slab1_amount = min(taxable_income, 300000.0)
    slab_breakdowns.append(SlabBreakdown(
        slab_name="₹0 - ₹3,00,000",
        taxable_amount_in_slab=slab1_amount,
        rate_percent=0.0,
        tax_computed=0.0
    ))

    # Slab 2: 3,00,001 to 7,00,000 @ 5%
    if taxable_income > 300000.0:
        slab2_amount = min(taxable_income - 300000.0, 400000.0)
        slab2_tax = slab2_amount * 0.05
        tax_before_rebate += slab2_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="₹3,00,001 - ₹7,00,000",
            taxable_amount_in_slab=slab2_amount,
            rate_percent=5.0,
            tax_computed=slab2_tax
        ))

    # Slab 3: 7,00,001 to 10,00,000 @ 10%
    if taxable_income > 700000.0:
        slab3_amount = min(taxable_income - 700000.0, 300000.0)
        slab3_tax = slab3_amount * 0.10
        tax_before_rebate += slab3_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="₹7,00,001 - ₹10,00,000",
            taxable_amount_in_slab=slab3_amount,
            rate_percent=10.0,
            tax_computed=slab3_tax
        ))

    # Slab 4: 10,00,001 to 12,00,000 @ 15%
    if taxable_income > 1000000.0:
        slab4_amount = min(taxable_income - 1000000.0, 200000.0)
        slab4_tax = slab4_amount * 0.15
        tax_before_rebate += slab4_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="₹10,00,001 - ₹12,00,000",
            taxable_amount_in_slab=slab4_amount,
            rate_percent=15.0,
            tax_computed=slab4_tax
        ))

    # Slab 5: 12,00,001 to 15,00,000 @ 20%
    if taxable_income > 1200000.0:
        slab5_amount = min(taxable_income - 1200000.0, 300000.0)
        slab5_tax = slab5_amount * 0.20
        tax_before_rebate += slab5_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="₹12,00,001 - ₹15,00,000",
            taxable_amount_in_slab=slab5_amount,
            rate_percent=20.0,
            tax_computed=slab5_tax
        ))

    # Slab 6: Above 15,00,000 @ 30%
    if taxable_income > 1500000.0:
        slab6_amount = taxable_income - 1500000.0
        slab6_tax = slab6_amount * 0.30
        tax_before_rebate += slab6_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="Above ₹15,00,000",
            taxable_amount_in_slab=slab6_amount,
            rate_percent=30.0,
            tax_computed=slab6_tax
        ))

    # 4. Section 87A Rebate & Marginal Relief
    rebate_87a = 0.0
    marginal_relief = False

    if is_resident:
        if taxable_income <= 700000.0:
            # Full rebate up to ₹25,000
            rebate_87a = min(tax_before_rebate, 25000.0)
        elif 700000.0 < taxable_income <= 727778.0:
            # Marginal Relief: Tax payable cannot exceed (Taxable Income - 7,00,000)
            excess_income = taxable_income - 700000.0
            if tax_before_rebate > excess_income:
                marginal_relief = True
                rebate_87a = tax_before_rebate - excess_income

    tax_after_rebate = max(0.0, tax_before_rebate - rebate_87a)

    # 5. Health & Education Cess @ 4%
    cess = round(tax_after_rebate * 0.04, 2)
    total_tax_liability = round_to_nearest_ten(tax_after_rebate + cess)

    net_payable_or_refund = round_to_nearest_ten(total_tax_liability - total_taxes_paid)

    return RegimeComputation(
        regime="NEW",
        gross_total_income=gross_income,
        standard_deduction=std_deduction,
        other_exemptions_deductions=other_deductions,
        total_deductions=total_deductions,
        taxable_income=taxable_income,
        slab_breakdown=slab_breakdowns,
        tax_before_rebate=round(tax_before_rebate, 2),
        rebate_87a=round(rebate_87a, 2),
        tax_after_rebate=round(tax_after_rebate, 2),
        surcharge=0.0,
        health_and_education_cess=cess,
        total_tax_liability=total_tax_liability,
        total_tds_credit=total_taxes_paid,
        total_taxes_paid=total_taxes_paid,
        net_payable_or_refund=net_payable_or_refund,
        marginal_relief_applied=marginal_relief
    )


def compute_old_regime_tax(
    gross_income: Optional[float] = None,
    is_salaried: bool = True,
    sec_10_exemptions: float = 0.0,  # HRA, LTA, etc.
    professional_tax: float = 0.0,
    deductions: Optional[ChapterVIADeductions] = None,
    age: int = 35,
    is_resident: bool = True,
    total_taxes_paid: float = 0.0,
    gross_salary: Optional[float] = None,
    income_from_other_sources: float = 0.0,
    tds_paid: float = 0.0
) -> RegimeComputation:
    """
    Computes tax under Old Tax Regime.
    - Standard deduction: ₹50,000 for salaried employees.
    - Section 10 exemptions: HRA, LTA, Gratuity.
    - Professional tax: Sec 16(iii).
    - Chapter VI-A Deductions:
        - 80C + 80CCC + 80CCD(1): Capped at ₹1,50,000.
        - 80CCD(1B) NPS: Additional ₹50,000.
        - 80CCD(2) Employer NPS: Allowed.
        - 80D Mediclaim: Health insurance for self and parents.
        - 80TTA / 80TTB: Savings / deposit interest.
        - 80E, 80G, etc.
    - Slabs:
        0 to 2,50,000: Nil (3L for Senior 60-79, 5L for Super Senior 80+)
        2,50,001 to 5,00,000: 5%
        5,00,001 to 10,00,000: 20%
        Above 10,00,000: 30%
    - Sec 87A Rebate: Full rebate up to ₹12,500 if taxable income <= ₹5,00,000.
    - Cess: 4% Health & Education Cess.
    """
    if gross_income is None:
        gross_income = (gross_salary or 0.0) + income_from_other_sources
    if tds_paid > 0:
        total_taxes_paid = tds_paid
    # 1. Salary Specific Deductions
    std_deduction = 50000.0 if is_salaried else 0.0
    sec_16_deductions = std_deduction + professional_tax

    # 2. Chapter VI-A Deductions
    d = deductions or ChapterVIADeductions()
    c_capped = d.total_80c_eligible  # Max 1.5L
    nps_1b = min(50000.0, d.sec_80ccd_1b_nps)
    employer_nps = d.sec_80ccd_2_employer_nps
    mediclaim_80d = d.sec_80d
    education_80e = d.sec_80e
    donations_80g = d.sec_80g
    savings_interest_80tta = min(10000.0, d.sec_80tta_ttb) if age < 60 else min(50000.0, d.sec_80tta_ttb)
    other_chap_via = d.others

    total_chap_via = (
        c_capped
        + nps_1b
        + employer_nps
        + mediclaim_80d
        + education_80e
        + donations_80g
        + savings_interest_80tta
        + other_chap_via
    )

    total_deductions = sec_16_deductions + sec_10_exemptions + total_chap_via
    raw_taxable = max(0.0, gross_income - total_deductions)
    taxable_income = round_to_nearest_ten(raw_taxable)

    # 3. Slab Exemption threshold based on age
    if age >= 80 and is_resident:
        slab1_limit = 500000.0
    elif age >= 60 and is_resident:
        slab1_limit = 300000.0
    else:
        slab1_limit = 250000.0

    slab_breakdowns: List[SlabBreakdown] = []
    tax_before_rebate = 0.0

    # Slab 1: Up to basic exemption limit @ 0%
    slab1_amount = min(taxable_income, slab1_limit)
    slab_breakdowns.append(SlabBreakdown(
        slab_name=f"₹0 - ₹{int(slab1_limit):,}",
        taxable_amount_in_slab=slab1_amount,
        rate_percent=0.0,
        tax_computed=0.0
    ))

    # Slab 2: Limit to ₹5,00,000 @ 5%
    if taxable_income > slab1_limit:
        slab2_amount = min(taxable_income - slab1_limit, 500000.0 - slab1_limit)
        slab2_tax = slab2_amount * 0.05
        tax_before_rebate += slab2_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name=f"₹{int(slab1_limit)+1:,} - ₹5,00,000",
            taxable_amount_in_slab=slab2_amount,
            rate_percent=5.0,
            tax_computed=slab2_tax
        ))

    # Slab 3: ₹5,00,001 to ₹10,00,000 @ 20%
    if taxable_income > 500000.0:
        slab3_amount = min(taxable_income - 500000.0, 500000.0)
        slab3_tax = slab3_amount * 0.20
        tax_before_rebate += slab3_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="₹5,00,001 - ₹10,00,000",
            taxable_amount_in_slab=slab3_amount,
            rate_percent=20.0,
            tax_computed=slab3_tax
        ))

    # Slab 4: Above ₹10,00,000 @ 30%
    if taxable_income > 1000000.0:
        slab4_amount = taxable_income - 1000000.0
        slab4_tax = slab4_amount * 0.30
        tax_before_rebate += slab4_tax
        slab_breakdowns.append(SlabBreakdown(
            slab_name="Above ₹10,00,000",
            taxable_amount_in_slab=slab4_amount,
            rate_percent=30.0,
            tax_computed=slab4_tax
        ))

    # 4. Section 87A Rebate for Old Regime
    rebate_87a = 0.0
    if is_resident and taxable_income <= 500000.0:
        rebate_87a = min(tax_before_rebate, 12500.0)

    tax_after_rebate = max(0.0, tax_before_rebate - rebate_87a)

    # 5. Health & Education Cess @ 4%
    cess = round(tax_after_rebate * 0.04, 2)
    total_tax_liability = round_to_nearest_ten(tax_after_rebate + cess)

    net_payable_or_refund = round_to_nearest_ten(total_tax_liability - total_taxes_paid)

    return RegimeComputation(
        regime="OLD",
        gross_total_income=gross_income,
        standard_deduction=std_deduction,
        other_exemptions_deductions=sec_10_exemptions + professional_tax + total_chap_via,
        total_deductions=total_deductions,
        taxable_income=taxable_income,
        slab_breakdown=slab_breakdowns,
        tax_before_rebate=round(tax_before_rebate, 2),
        rebate_87a=round(rebate_87a, 2),
        tax_after_rebate=round(tax_after_rebate, 2),
        surcharge=0.0,
        health_and_education_cess=cess,
        total_tax_liability=total_tax_liability,
        total_tds_credit=total_taxes_paid,
        total_taxes_paid=total_taxes_paid,
        net_payable_or_refund=net_payable_or_refund,
        marginal_relief_applied=False
    )


class TaxComputationEngine:
    """
    Automated dual-regime tax optimizer.
    Accepts synthesized document data or raw income parameters,
    computes exact Old vs. New regime taxes, and provides actionable recommendations.
    """
    def __init__(self, age: int = 35, is_resident: bool = True):
        self.age = age
        self.is_resident = is_resident

    @classmethod
    def optimize_regime(
        cls,
        gross_salary: float,
        other_sources_income: float = 0.0,
        house_property_loss_or_income: float = 0.0,
        sec_10_exemptions: float = 0.0,
        professional_tax: float = 0.0,
        deductions: Optional[ChapterVIADeductions] = None,
        age: int = 35,
        is_resident: bool = True,
        total_tds_tcs_paid: float = 0.0,
        sec_80c: float = 0.0,
        sec_80d: float = 0.0,
        sec_80ccd_1b: float = 0.0,
        sec_80ccd_2: float = 0.0,
        income_from_other_sources: Optional[float] = None,
        tds_paid: Optional[float] = None,
        exemptions_sec_10: Optional[float] = None
    ) -> RegimeOptimizationReport:
        if income_from_other_sources is not None:
            other_sources_income = income_from_other_sources
        if tds_paid is not None:
            total_tds_tcs_paid = tds_paid
        if exemptions_sec_10 is not None:
            sec_10_exemptions = exemptions_sec_10

        if deductions is None and (sec_80c or sec_80d or sec_80ccd_1b or sec_80ccd_2):
            deductions = ChapterVIADeductions(
                sec_80c=sec_80c,
                sec_80d=sec_80d,
                sec_80ccd_1b_nps=sec_80ccd_1b,
                sec_80ccd_2_employer_nps=sec_80ccd_2
            )

        gross_income = gross_salary + other_sources_income + house_property_loss_or_income
        effective_80ccd_2 = deductions.sec_80ccd_2_employer_nps if deductions else sec_80ccd_2

        # Compute New Regime
        new_comp = compute_new_regime_tax(
            gross_income=gross_income,
            is_salaried=gross_salary > 0,
            sec_80ccd_2=effective_80ccd_2,
            is_resident=is_resident,
            total_taxes_paid=total_tds_tcs_paid
        )

        # Compute Old Regime
        old_comp = compute_old_regime_tax(
            gross_income=gross_income,
            is_salaried=gross_salary > 0,
            sec_10_exemptions=sec_10_exemptions,
            professional_tax=professional_tax,
            deductions=deductions,
            age=age,
            is_resident=is_resident,
            total_taxes_paid=total_tds_tcs_paid
        )

        diff = old_comp.total_tax_liability - new_comp.total_tax_liability
        tips: List[str] = []

        if diff > 0:
            recommended = "NEW"
            savings = diff
            summary = (
                f"New Tax Regime (Section 115BAC) saves you ₹{savings:,.0f} in direct taxes. "
                f"You enjoy the ₹75,000 standard deduction and lower 5%-20% slab rates without locking funds in lock-in investments."
            )
        elif diff < 0:
            recommended = "OLD"
            savings = abs(diff)
            summary = (
                f"Old Tax Regime saves you ₹{savings:,.0f} because your combined deductions "
                f"(₹{old_comp.total_deductions:,.0f} including 80C, 80D, and HRA) exceed the breakeven threshold."
            )
        else:
            recommended = "NEW"
            savings = 0.0
            summary = "Both regimes result in the exact same tax liability. We recommend New Regime as it is default and zero documentation required."

        # Actionable tax optimization tips
        if recommended == "NEW":
            if sec_80ccd_2 == 0 and gross_salary > 800000:
                tips.append(
                    "Ask your employer for Section 80CCD(2) Corporate NPS restructuring. "
                    "Up to 14% of Basic + DA can be deducted completely tax-free even in New Regime!"
                )
            if new_comp.taxable_income > 700000 and new_comp.taxable_income <= 727778:
                tips.append(
                    "You are benefiting from Section 87A Marginal Relief! Your tax is capped strictly to the income exceeding ₹7 Lakhs."
                )
        else:
            if deductions and deductions.sec_80ccd_1b_nps < 50000:
                unclaimed = 50000 - deductions.sec_80ccd_1b_nps
                tips.append(f"Invest ₹{unclaimed:,.0f} more in Tier-1 NPS to claim an additional Section 80CCD(1B) deduction in Old Regime.")
            if deductions and deductions.sec_80c < 150000:
                unclaimed_80c = 150000 - deductions.sec_80c
                tips.append(f"Section 80C cap has ₹{unclaimed_80c:,.0f} headroom available (ELSS, PPF, or Term Insurance).")

        return RegimeOptimizationReport(
            recommended_regime=recommended,
            tax_savings=round(savings, 2),
            new_regime=new_comp,
            old_regime=old_comp,
            recommendation_summary=summary,
            actionable_savings_tips=tips
        )

    @classmethod
    def evaluate_from_documents(
        cls,
        form16: Optional[Form16Data] = None,
        ais: Optional[AISData] = None,
        form26as: Optional[Form26ASData] = None,
        age: int = 35,
        is_resident: bool = True
    ) -> RegimeOptimizationReport:
        """
        Synthesizes ingested documents (Form 16 + AIS + 26AS), reconciles TDS, and executes dual-regime evaluation.
        """
        gross_salary = 0.0
        sec_10_exemptions = 0.0
        prof_tax = 0.0
        deductions = ChapterVIADeductions()
        tds_form16 = 0.0

        if form16:
            gross_salary = form16.salary_breakup.gross_salary
            sec_10_exemptions = form16.salary_breakup.exemptions_sec_10 or (
                form16.salary_breakup.hra_exemption + form16.salary_breakup.lta_exemption
            )
            prof_tax = form16.salary_breakup.professional_tax
            deductions = form16.deductions_chapter_via
            tds_form16 = form16.tds_deducted

        # Aggregate other sources from AIS
        other_sources = 0.0
        tds_ais = 0.0
        if ais:
            other_sources += ais.savings_bank_interest + ais.fixed_deposit_interest + ais.dividend_income + ais.rent_received
            tds_ais = sum(t.tds_deducted for t in ais.tds_entries)

        # Aggregate TDS from 26AS
        tds_26as = 0.0
        if form26as:
            tds_26as = sum(t.tds_deducted for t in form26as.part_a_tds_salary + form26as.part_a1_tds_non_salary)

        # Reconcile TDS Credit (Take maximum verified credit)
        total_tds = max(tds_form16 + tds_ais, tds_26as, tds_form16)

        return cls.optimize_regime(
            gross_salary=gross_salary,
            other_sources_income=other_sources,
            sec_10_exemptions=sec_10_exemptions,
            professional_tax=prof_tax,
            deductions=deductions,
            age=age,
            is_resident=is_resident,
            total_tds_tcs_paid=total_tds
        )


TaxCalculator = TaxComputationEngine


def optimize_regime(filing: Any) -> RegimeOptimizationReport:
    """
    Convenience function that takes a TaxFiling instance and evaluates optimal tax regime.
    """
    return TaxComputationEngine.evaluate_from_documents(
        form16=filing.form_16,
        ais=filing.ais,
        form26as=filing.form_26as
    )

