from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile

from cverify_model import CVerifyClassifier, MAX_PDF_BYTES

app = FastAPI(title="CVerify Resume Classifier", version="1.0.0")


@lru_cache(maxsize=1)
def classifier() -> CVerifyClassifier:
    return CVerifyClassifier()


@app.get("/health")
def health():
    try:
        return classifier().metadata()
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/classify")
async def classify(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF resumes are supported")
    content = await file.read(MAX_PDF_BYTES + 1)
    try:
        return classifier().classify_pdf(content)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
