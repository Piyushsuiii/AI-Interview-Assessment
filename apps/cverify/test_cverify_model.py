import unittest

import pymupdf

from cverify_model import extract_pdf_text


class PdfExtractionTests(unittest.TestCase):
    def test_rejects_non_pdf_content(self):
        with self.assertRaisesRegex(ValueError, "valid PDF"):
            extract_pdf_text(b"not a pdf")

    def test_extracts_text_without_ocr(self):
        document = pymupdf.open()
        page = document.new_page()
        expected = "Software engineer with Python, TypeScript, Kubernetes, cloud, and database experience. " * 3
        page.insert_textbox(page.rect, expected)
        content = document.tobytes()
        document.close()

        text, used_ocr = extract_pdf_text(content)

        self.assertIn("Software engineer", text)
        self.assertFalse(used_ocr)


if __name__ == "__main__":
    unittest.main()
