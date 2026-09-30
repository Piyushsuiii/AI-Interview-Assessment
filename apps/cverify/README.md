# CVerify Resume Classifier

CVerify classifies resume PDFs into 24 job families using a locally stored DistilBERT checkpoint. Model weights and training data stay outside Git.

## Local environment

Use Python 3.12. Install the PyTorch wheel matching the host first, then the service dependencies:

```powershell
py -3.12 -m venv D:\datasets\.venv
& "D:\datasets\.venv\Scripts\python.exe" -m pip install torch --index-url https://download.pytorch.org/whl/cu130
& "D:\datasets\.venv\Scripts\python.exe" -m pip install -r apps/cverify/requirements.txt
```

The current workstation has an NVIDIA GPU. The old `cverify_constraints.txt` ROCm packages are not compatible with this Windows host.

## Train

The trainer splits at document level before creating overlapping token chunks. This prevents chunks from one resume leaking across train and evaluation sets.

```powershell
& "D:\datasets\.venv\Scripts\python.exe" apps/cverify/train.py `
  --data "D:\datasets\cverify_work\processed_documents.csv" `
  --base-model "D:\datasets\cverify_work\models\distilbert_resume_classifier" `
  --output "D:\datasets\cverify_work\models\distilbert_resume_classifier_candidate"
```

The original checkpoint is never overwritten. The candidate directory initially receives the baseline weights and is replaced only when an epoch beats baseline validation F1. Metrics are written to `training_metrics.json` in the new model directory.

## Serve

```powershell
$env:CVERIFY_MODEL_DIR="D:\datasets\cverify_work\models\distilbert_resume_classifier_candidate"
& "D:\datasets\.venv\Scripts\python.exe" -m uvicorn app:app --app-dir apps/cverify --host 127.0.0.1 --port 8001
```

Endpoints:

- `GET /health`
- `POST /classify` with a multipart PDF field named `file`

Text PDFs are handled by PyMuPDF. Image-only pages use Tesseract when it is installed. Requests are capped at 10 MB and inference is capped at eight chunks.
