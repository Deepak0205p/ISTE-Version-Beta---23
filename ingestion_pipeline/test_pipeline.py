import io
import pikepdf
from ingestion_pipeline.user_profile import UserProfile, generate_bank_passwords
from ingestion_pipeline.pdf_decryptor import decrypt_statement_stream

def test_pipeline_core():
    # 1. Profile and Passwords
    user = UserProfile(
        full_name="Aman Yadav",
        dob="2003-05-14",
        pan_number="ABCDE1234F",
        registered_mobile="9876543210",
        known_cards={"HDFC": "4321", "SBI": "8765"}
    )

    hdfc_candidates = generate_bank_passwords(user, "HDFC")
    print(f"HDFC Candidates ({len(hdfc_candidates)}): {hdfc_candidates[:5]}")
    assert "aman1405" in hdfc_candidates, "Failed to derive standard HDFC password"

    sbi_candidates = generate_bank_passwords(user, "SBI")
    print(f"SBI Candidates ({len(sbi_candidates)}): {sbi_candidates[:5]}")
    assert "14058765" in sbi_candidates, "Failed to derive standard SBI password"

    # 2. In-memory encrypted PDF creation
    expected_pwd = "aman1405"
    pdf = pikepdf.new()
    pdf.add_blank_page()
    enc_stream = io.BytesIO()
    pdf.save(enc_stream, encryption=pikepdf.Encryption(owner="owner", user=expected_pwd, R=4))
    enc_stream.seek(0)

    # 3. In-memory decryption verification
    decrypted_stream, used_pwd = decrypt_statement_stream(enc_stream, hdfc_candidates)
    print(f"Decryption succeeded using candidate password: '{used_pwd}'")
    assert used_pwd == expected_pwd, "Used incorrect password"
    
    header = decrypted_stream.read(5)
    assert header == b"%PDF-", "Decrypted stream magic header mismatch"
    print("SUCCESS: Core user profile and in-memory decryption layers are 100% verified!")

if __name__ == "__main__":
    test_pipeline_core()
