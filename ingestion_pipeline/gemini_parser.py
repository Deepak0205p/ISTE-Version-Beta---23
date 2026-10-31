import os
import io
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

class Transaction(BaseModel):
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    merchant: str = Field(..., description="Clean merchant or narration description")
    amount: float = Field(..., description="Absolute numerical transaction amount in INR")
    type: Literal["DEBIT", "CREDIT"] = Field(..., description="DEBIT for purchases/charges, CREDIT for reversals/payments")
    category: Literal[
        "Food & Dining",
        "Shopping",
        "Travel",
        "Bills & Utilities",
        "Entertainment",
        "Finance Charge",
        "Others"
    ] = Field(..., description="Expense categorization")

class StatementData(BaseModel):
    bank_name: str = Field(..., description="Name of issuing bank, e.g., HDFC Bank, SBI Card, ICICI Bank")
    card_last_4_digits: str = Field(..., description="Last 4 digits of credit card")
    statement_date: str = Field(..., description="Statement generation date (YYYY-MM-DD)")
    due_date: str = Field(..., description="Payment due date (YYYY-MM-DD)")
    total_amount_due: float = Field(..., description="Total outstanding balance due")
    minimum_amount_due: float = Field(..., description="Minimum amount required to be paid")
    credit_limit: Optional[float] = Field(None, description="Total credit limit assigned to the card")
    hidden_charges_detected: bool = Field(
        ...,
        description="True if any late payment fee, finance charge, interest, or penalty GST is levied"
    )
    hidden_charges_summary: Optional[str] = Field(
        None,
        description="Detailed description of hidden or punitive charges identified"
    )
    transactions: List[Transaction] = Field(
        default_factory=list,
        description="Complete list of all itemized transactions on the credit card statement"
    )

class GeminiStatementParser:
    """
    Multimodal document extractor utilizing Google Gemini 2.5 Flash / 1.5 Pro.
    Processes in-memory decrypted PDF bytes without writing to disk.
    Enforces deterministic Pydantic schema validation.
    """
    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY must be provided or set in environment variables.")
        self.model_name = model_name
        self.client = genai.Client(api_key=self.api_key)

    def parse_statement(self, pdf_stream: io.BytesIO, detected_bank: Optional[str] = None) -> StatementData:
        pdf_stream.seek(0)
        pdf_bytes = pdf_stream.read()

        prompt = f"""
You are an expert Indian FinTech audit engine. Analyze the attached decrypted credit card e-statement PDF.
Target Bank hint: {detected_bank or 'Auto-detect'}

Instructions:
1. Extract card metadata: Bank name, last 4 digits of the card, statement date, and due date.
2. Extract Total Amount Due, Minimum Amount Due, and Credit Limit accurately.
3. Hidden Charges Audit: Scan specifically for interest charges, late payment charges, annual fees, finance charges, penalty GST, or surcharge reversal drops. Set 'hidden_charges_detected' to True if found and detail them in 'hidden_charges_summary'.
4. Extract all line-item transactions with proper Category classification and normalized ISO date (YYYY-MM-DD).
5. Output must adhere strictly to the JSON Schema.
"""

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf",
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=StatementData,
                temperature=0.1,
            ),
        )

        # Parse and return validated Pydantic model
        if hasattr(response, "parsed") and response.parsed is not None:
            if isinstance(response.parsed, StatementData):
                return response.parsed
            return StatementData.model_validate(response.parsed)

        return StatementData.model_validate_json(response.text)
