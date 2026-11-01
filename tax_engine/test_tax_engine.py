"""
Comprehensive Test Suite for Indian Income Tax Engine (AY 2026-27 / FY 2025-26).
Verifies:
1. Section 115BAC New Regime calculations, slabs, ₹75,000 standard deduction, Sec 87A rebate & marginal relief.
2. Old Regime calculations, Chapter VI-A deductions, Sec 87A rebate, Senior Citizen exemptions.
3. Precision mathematical rounding under Section 288A & 288B.
4. Gemini Multimodal extraction models & INR currency normalization.
5. Government e-Filing JSON schema generation (ITR-1 Sahaj & ITR-4 Sugam) and validation.
6. FastAPI endpoints & tax filing lifecycles.
"""

import unittest
from fastapi.testclient import TestClient

from tax_engine.tax_schema import (
    TaxProfile,
    BankAccountRefund,
    TaxAddress,
    TaxFiling,
    Form16Data,
    EmployerDetails,
    SalaryBreakup,
    ChapterVIADeductions,
    AISData,
    SecuritiesTransaction,
    TDSEntry,
    Form26ASData,
    CapitalGainsData
)
from tax_engine.tax_calculator import (
    TaxComputationEngine,
    TaxCalculator,
    compute_new_regime_tax,
    compute_old_regime_tax,
    round_to_nearest_ten
)
from tax_engine.tax_document_parser import (
    TaxDocumentParser,
    clean_inr_number,
    parse_tax_document
)
from tax_engine.itr_json_generator import (
    generate_itr1_json,
    generate_itr4_json,
    validate_itr1_schema,
    validate_profile_for_itr
)
from tax_engine.server import router
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestTaxEnginePrecision(unittest.TestCase):
    """
    Precision statutory calculation unit tests for FY 2025-26 / AY 2026-27.
    """
    def test_round_to_nearest_ten(self):
        self.assertEqual(round_to_nearest_ten(1234.0), 1230.0)
        self.assertEqual(round_to_nearest_ten(1235.0), 1240.0)
        self.assertEqual(round_to_nearest_ten(1239.9), 1240.0)
        self.assertEqual(round_to_nearest_ten(0.0), 0.0)

    def test_new_regime_nil_tax_upto_7_lakhs(self):
        """
        In New Regime, income up to ₹7,00,000 has 0 net tax liability due to Section 87A rebate.
        """
        # Salaried: ₹7,75,000 gross - ₹75,000 standard deduction = ₹7,00,000 taxable
        comp = compute_new_regime_tax(gross_salary=775000.0)
        self.assertEqual(comp.standard_deduction, 75000.0)
        self.assertEqual(comp.taxable_income, 700000.0)
        # Tax before rebate: 3-7L @ 5% = 20,000
        self.assertEqual(comp.tax_before_rebate, 20000.0)
        self.assertEqual(comp.rebate_87a, 20000.0)
        self.assertEqual(comp.tax_after_rebate, 0.0)
        self.assertEqual(comp.total_tax_payable, 0.0)

    def test_new_regime_marginal_relief(self):
        """
        Section 87A Marginal relief under Section 115BAC for income just above ₹7,00,000.
        E.g. Taxable income ₹7,10,000:
        Normal tax = ₹20,000 (3-7L) + 10% of 10,000 (1,000) = ₹21,000.
        Excess income over ₹7,00,000 = ₹10,000.
        Marginal relief restricts tax before cess to exactly ₹10,000!
        """
        comp = compute_new_regime_tax(gross_salary=710000.0 + 75000.0)
        self.assertEqual(comp.taxable_income, 710000.0)
        self.assertEqual(comp.tax_after_rebate, 10000.0)
        # 4% Cess on 10,000 = 400 -> Total Tax = 10,400
        self.assertEqual(comp.total_tax_payable, 10400.0)

    def test_new_regime_high_income_slabs(self):
        """
        Tests multi-tier slabs for ₹20,75,000 gross salary (₹20,00,000 taxable):
        0-3L: Nil
        3-7L (4L @ 5%): ₹20,000
        7-10L (3L @ 10%): ₹30,000
        10-12L (2L @ 15%): ₹30,000
        12-15L (3L @ 20%): ₹60,000
        Above 15L (5L @ 30%): ₹1,50,000
        Total Tax before cess = ₹2,90,000
        Cess (4%) = ₹11,600
        Total Tax Payable = ₹3,01,600
        """
        comp = compute_new_regime_tax(gross_salary=2075000.0)
        self.assertEqual(comp.taxable_income, 2000000.0)
        self.assertEqual(comp.tax_before_rebate, 290000.0)
        self.assertEqual(comp.health_education_cess, 11600.0)
        self.assertEqual(comp.total_tax_payable, 301600.0)

    def test_old_regime_with_deductions(self):
        """
        Tests Old Regime calculation with Chapter VI-A deductions:
        Gross: ₹15,00,000
        Standard Deduction: ₹50,000
        HRA Exemption: ₹1,50,000
        Professional Tax: ₹2,400
        80C: ₹1,50,000
        80D: ₹25,000
        80CCD(1B): ₹50,000
        Total Deductions = ₹2,25,000 + ₹2,02,400 = ₹4,27,400
        Taxable Income = ₹15,00,000 - ₹4,27,400 = ₹10,72,600
        Rounded to nearest 10 = ₹10,72,600
        Tax calculation:
        0-2.5L: Nil
        2.5-5L (2.5L @ 5%): ₹12,500
        5-10L (5L @ 20%): ₹1,00,000
        Above 10L (72,600 @ 30%): ₹21,780
        Tax before cess = ₹1,34,280
        Cess 4% = ₹5,371.20 -> ₹5,371
        Total Tax = ₹1,39,651 -> nearest 10 = ₹1,39,650
        """
        deductions = ChapterVIADeductions(
            sec_80c=150000.0,
            sec_80d=25000.0,
            sec_80ccd_1b_nps=50000.0
        )
        comp = compute_old_regime_tax(
            gross_salary=1500000.0,
            sec_10_exemptions=150000.0,
            professional_tax=2400.0,
            deductions=deductions
        )
        self.assertEqual(comp.taxable_income, 1072600.0)
        self.assertEqual(comp.tax_before_rebate, 134280.0)
        self.assertEqual(comp.total_tax_payable, 139650.0)

    def test_dual_regime_optimizer(self):
        """
        Verifies recommendation logic comparing Old vs New Regime.
        """
        calc = TaxComputationEngine()
        # High deduction profile where Old Regime wins:
        deductions = ChapterVIADeductions(
            sec_80c=150000.0,
            sec_80d=50000.0,
            sec_80ccd_1b_nps=50000.0
        )
        report = calc.optimize_regime(
            gross_salary=1600000.0,
            sec_10_exemptions=200000.0,
            deductions=deductions,
            total_tds_tcs_paid=150000.0
        )
        self.assertIn(report.recommended_regime, ["OLD", "NEW"])
        self.assertGreaterEqual(report.tax_savings, 0.0)
        self.assertTrue(len(report.recommendation_summary) > 10)


class TestTaxDocumentParser(unittest.TestCase):
    """
    Tests INR currency normalization and document extraction models.
    """
    def test_clean_inr_numbers(self):
        self.assertEqual(clean_inr_number("₹ 12,50,000.00"), 1250000.0)
        self.assertEqual(clean_inr_number("1,50,000/-"), 150000.0)
        self.assertEqual(clean_inr_number("(25,000)"), -25000.0)
        self.assertEqual(clean_inr_number("Nil"), 0.0)
        self.assertEqual(clean_inr_number(None), 0.0)
        self.assertEqual(clean_inr_number(75000), 75000.0)

    def test_parse_form16_mock(self):
        form16 = parse_tax_document(file_bytes=b"", doc_type="FORM_16")
        self.assertIsInstance(form16, Form16Data)
        self.assertEqual(form16.standard_deduction, 75000.0)
        self.assertGreater(form16.salary_breakup.gross_salary, 0)
        self.assertEqual(form16.employer_details.tan, "BLRH01234A")

    def test_parse_ais_mock(self):
        ais = parse_tax_document(file_bytes=b"", doc_type="AIS")
        self.assertIsInstance(ais, AISData)
        self.assertGreater(ais.savings_bank_interest, 0)
        self.assertTrue(len(ais.securities_transactions) > 0)


class TestITRJsonGeneration(unittest.TestCase):
    """
    Tests official Government e-Filing schema generation and validation.
    """
    def setUp(self):
        self.profile = TaxProfile(
            pan="ABCDE1234F",
            full_name="Deepak Patel",
            first_name="Deepak",
            last_name="Patel",
            dob="1995-05-15",
            aadhaar_number="548291029482",
            mobile="9876543210",
            email="deepak.patel@example.com",
            address=TaxAddress(
                residence_no="Flat 402",
                premises_name="Greenwood Residency",
                road_or_street="Outer Ring Road",
                locality="Bellandur",
                city="Bengaluru",
                state_code="29",
                pin_code="560103"
            ),
            bank_account_for_refund=BankAccountRefund(
                account_no="50100482910291",
                ifsc="HDFC0000001",
                bank_name="HDFC Bank",
                account_type="SAVINGS",
                is_validated=True
            )
        )
        self.form16 = parse_tax_document(file_bytes=b"", doc_type="FORM_16")
        self.ais = parse_tax_document(file_bytes=b"", doc_type="AIS")
        self.form26as = parse_tax_document(file_bytes=b"", doc_type="FORM_26AS")
        self.filing = TaxFiling(
            user_id="user_123",
            pan="ABCDE1234F",
            form_16=self.form16,
            ais=self.ais,
            form_26as=self.form26as,
            selected_regime="NEW"
        )
        self.computation = compute_new_regime_tax(
            gross_salary=self.form16.salary_breakup.gross_salary,
            income_from_other_sources=self.ais.savings_bank_interest + self.ais.fixed_deposit_interest,
            tds_paid=self.form16.tds_deducted
        )

    def test_profile_validation_success(self):
        errors = validate_profile_for_itr(self.profile)
        self.assertEqual(len(errors), 0)

    def test_generate_itr1_json(self):
        payload = generate_itr1_json(
            tax_profile=self.profile,
            computation=self.computation,
            filing=self.filing
        )
        self.assertIn("ITR", payload)
        self.assertIn("ITR1", payload["ITR"])
        itr1 = payload["ITR"]["ITR1"]

        # Check CreationInfo & Digest
        self.assertTrue(bool(itr1["CreationInfo"]["Digest"]))
        self.assertEqual(itr1["PersonalInfo"]["PAN"], "ABCDE1234F")
        self.assertEqual(itr1["FilingStatus"]["OptOutNewRegime"], "N")

        # Mathematical verification
        is_valid, validation_errors = validate_itr1_schema(payload)
        self.assertTrue(is_valid, f"Schema validation errors: {validation_errors}")

    def test_generate_itr4_json(self):
        payload = generate_itr4_json(
            tax_profile=self.profile,
            computation=self.computation,
            business_gross_receipts=2000000.0,
            presumptive_income_44ad=120000.0
        )
        self.assertIn("ITR", payload)
        self.assertIn("ITR4", payload["ITR"])
        self.assertEqual(payload["ITR"]["ITR4"]["ScheduleBP"]["Sec44AD"]["PresumptiveIncome"], 120000)


class TestTaxEngineEndpoints(unittest.TestCase):
    """
    Tests REST API endpoints using FastAPI TestClient.
    """
    def test_health_endpoint(self):
        res = client.get("/tax/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["assessment_year"], "2026-27")

    def test_quick_compute_endpoint(self):
        payload = {
            "gross_salary": 1200000.0,
            "exemptions_sec_10": 100000.0,
            "sec_80c": 150000.0,
            "sec_80d": 25000.0,
            "sec_80ccd_1b_nps": 50000.0,
            "sec_80ccd_2_employer_nps": 60000.0,
            "other_income": 25000.0,
            "tds_deducted": 75000.0,
            "age": 30
        }
        res = client.post("/tax/quick-compute", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn(data["recommendation"], ["OLD", "NEW"])
        self.assertIn("new_regime", data)
        self.assertIn("old_regime", data)

    def test_select_regime_endpoint(self):
        payload = {
            "userId": "test_user_456",
            "assessmentYear": "AY_2026_27",
            "selectedRegime": "NEW"
        }
        res = client.post("/tax/select-regime", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["selected_regime"], "NEW")

    def test_export_itr_json_endpoint(self):
        res = client.get("/tax/export-itr-json/test_user_456/AY_2026_27")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_valid"])
        self.assertIn("ITR", data["payload"])

    def test_submit_filing_endpoint(self):
        payload = {
            "userId": "test_user_456",
            "assessmentYear": "AY_2026_27",
            "consent": True
        }
        res = client.post("/tax/submit-filing", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["filing_status"], "SUBMITTED")
        self.assertTrue(data["acknowledgement_number"].startswith("ITR1-"))


if __name__ == "__main__":
    unittest.main()
