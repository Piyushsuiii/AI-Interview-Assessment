from __future__ import annotations

import io
import os
from pathlib import Path
from threading import Lock
from typing import Any

import pymupdf
import pytesseract
import torch
from PIL import Image
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MAX_PDF_BYTES = 10 * 1024 * 1024


def extract_pdf_text(pdf_bytes: bytes, min_extracted_chars: int = 100, ocr_dpi: int = 150) -> tuple[str, bool]:
    if not pdf_bytes.startswith(b"%PDF-"):
        raise ValueError("File is not a valid PDF")
    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages: list[str] = []
    used_ocr = False
    try:
        for page in document:
            text = page.get_text("text").strip()
            if len(text) >= min_extracted_chars:
                pages.append(text)
                continue
            pixmap = page.get_pixmap(dpi=ocr_dpi, alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            try:
                text = pytesseract.image_to_string(image).strip()
                used_ocr = True
            except pytesseract.TesseractNotFoundError as error:
                if not text:
                    raise RuntimeError("Image-only PDF requires Tesseract OCR") from error
            pages.append(text)
    finally:
        document.close()
    result = "\n".join(page for page in pages if page).strip()
    if not result:
        raise ValueError("No text could be extracted from the PDF")
    return result, used_ocr


class CVerifyClassifier:
    def __init__(self, model_dir: str | Path | None = None, max_length: int = 512, stride: int = 128, max_chunks: int = 1):
        configured = model_dir or os.environ.get("CVERIFY_MODEL_DIR")
        if not configured:
            raise ValueError("CVERIFY_MODEL_DIR is not configured")
        self.model_dir = Path(configured).resolve()
        if not self.model_dir.is_dir():
            raise FileNotFoundError(f"Model directory not found: {self.model_dir}")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.max_length = max_length
        self.stride = stride
        self.max_chunks = max_chunks
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_dir, local_files_only=True)
        self.model.to(self.device)
        self.model.eval()
        self._lock = Lock()

    def classify_text(self, text: str, top_k: int = 5) -> dict[str, Any]:
        if not text.strip():
            raise ValueError("Resume text is empty")
        encoded = self.tokenizer(
            text,
            max_length=self.max_length,
            stride=self.stride,
            truncation=True,
            padding="max_length",
            return_overflowing_tokens=True,
            return_tensors="pt",
        )
        input_ids = encoded["input_ids"][: self.max_chunks].to(self.device)
        attention_mask = encoded["attention_mask"][: self.max_chunks].to(self.device)
        with self._lock, torch.inference_mode():
            with torch.autocast(device_type=self.device.type, dtype=torch.float16, enabled=self.device.type == "cuda"):
                logits = self.model(input_ids=input_ids, attention_mask=attention_mask).logits
            probabilities = torch.softmax(logits.float(), dim=-1).mean(dim=0)
        count = min(max(1, top_k), probabilities.numel())
        values, indices = torch.topk(probabilities, count)
        predictions = [
            {"label": self.model.config.id2label[int(index)], "confidence": float(value)}
            for value, index in zip(values.cpu(), indices.cpu())
        ]
        return {
            "label": predictions[0]["label"],
            "confidence": predictions[0]["confidence"],
            "predictions": predictions,
            "chunksAnalyzed": int(input_ids.shape[0]),
            "model": self.model_dir.name,
            "device": str(self.device),
        }

    def classify_pdf(self, pdf_bytes: bytes, top_k: int = 5) -> dict[str, Any]:
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise ValueError("PDF exceeds the 10 MB limit")
        text, used_ocr = extract_pdf_text(pdf_bytes)
        result = self.classify_text(text, top_k)
        result.update({"charactersExtracted": len(text), "usedOcr": used_ocr})
        return result

    def metadata(self) -> dict[str, Any]:
        return {
            "ready": True,
            "model": self.model_dir.name,
            "labels": len(self.model.config.id2label),
            "device": str(self.device),
        }
