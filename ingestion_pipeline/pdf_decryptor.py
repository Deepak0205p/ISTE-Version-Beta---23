import io
from typing import List, Optional, Tuple
import pikepdf

class DecryptionError(Exception):
    pass

class UnsupportedPDFError(Exception):
    pass

def decrypt_statement_stream(
    encrypted_stream: io.BytesIO,
    candidate_passwords: List[str]
) -> Tuple[io.BytesIO, Optional[str]]:
    """
    Attempts to decrypt an in-memory PDF stream using dynamic candidate passwords.
    Never writes unencrypted or encrypted PDF bytes to disk.
    
    Returns:
        (decrypted_stream: io.BytesIO, successful_password: Optional[str])
    
    Raises:
        DecryptionError: if none of the candidate passwords unlock the document.
        UnsupportedPDFError: if the file cannot be opened as a valid PDF.
    """
    encrypted_stream.seek(0)
    raw_bytes = encrypted_stream.read()
    if not raw_bytes.startswith(b"%PDF-"):
        raise UnsupportedPDFError("Stream does not contain a valid PDF magic header (%PDF-)")

    # 1. Test if the PDF is already unencrypted
    try:
        pdf_check = pikepdf.open(io.BytesIO(raw_bytes))
        if not pdf_check.is_encrypted:
            decrypted_output = io.BytesIO()
            pdf_check.save(decrypted_output)
            decrypted_output.seek(0)
            pdf_check.close()
            return decrypted_output, None
        pdf_check.close()
    except pikepdf.PasswordError:
        pass  # Encrypted as expected
    except Exception as e:
        raise UnsupportedPDFError(f"Corrupt or malformed PDF structure: {str(e)}")

    # 2. Iterate through candidate password list
    for candidate in candidate_passwords:
        try:
            pdf = pikepdf.open(io.BytesIO(raw_bytes), password=candidate)
            # Decrypt in-memory by saving without encryption parameters
            decrypted_output = io.BytesIO()
            pdf.save(decrypted_output)
            decrypted_output.seek(0)
            pdf.close()
            return decrypted_output, candidate
        except pikepdf.PasswordError:
            continue
        except Exception as e:
            # Continue trying other passwords unless critical
            continue

    raise DecryptionError(
        f"Failed to decrypt PDF. None of the {len(candidate_passwords)} generated password variations succeeded."
    )
