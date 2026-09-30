from __future__ import annotations

import argparse
import json
import math
import random
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as functional
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

SEED = 42


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)


class ChunkDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, label2id, max_length: int, stride: int, max_chunks: int):
        self.rows: list[dict[str, object]] = []
        for document_id, (text, label) in enumerate(zip(texts, labels)):
            encoded = tokenizer(
                str(text),
                max_length=max_length,
                stride=stride,
                truncation=True,
                padding="max_length",
                return_overflowing_tokens=True,
            )
            for input_ids, attention_mask in zip(encoded["input_ids"][:max_chunks], encoded["attention_mask"][:max_chunks]):
                self.rows.append({
                    "input_ids": input_ids,
                    "attention_mask": attention_mask,
                    "label": label2id[label],
                    "document_id": document_id,
                })

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        return {
            "input_ids": torch.tensor(row["input_ids"], dtype=torch.long),
            "attention_mask": torch.tensor(row["attention_mask"], dtype=torch.long),
            "labels": torch.tensor(row["label"], dtype=torch.long),
            "document_ids": torch.tensor(row["document_id"], dtype=torch.long),
        }


def split_documents(frame: pd.DataFrame):
    train, remainder = train_test_split(frame, test_size=0.20, random_state=SEED, stratify=frame["category"])
    validation, test = train_test_split(remainder, test_size=0.50, random_state=SEED, stratify=remainder["category"])
    return train.reset_index(drop=True), validation.reset_index(drop=True), test.reset_index(drop=True)


def create_dataset(frame, tokenizer, label2id, args):
    return ChunkDataset(
        frame["text"].tolist(),
        frame["category"].tolist(),
        tokenizer,
        label2id,
        args.max_length,
        args.stride,
        args.max_chunks,
    )


def evaluate(model, loader, device, label_names):
    model.eval()
    probability_sums = defaultdict(lambda: torch.zeros(len(label_names), dtype=torch.float32))
    chunk_counts = defaultdict(int)
    document_labels: dict[int, int] = {}
    with torch.inference_mode():
        for batch in loader:
            input_ids = batch["input_ids"].to(device, non_blocking=True)
            attention_mask = batch["attention_mask"].to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
                logits = model(input_ids=input_ids, attention_mask=attention_mask).logits
            probabilities = torch.softmax(logits.float(), dim=-1).cpu()
            for probability, document_id, label in zip(probabilities, batch["document_ids"], batch["labels"]):
                key = int(document_id)
                probability_sums[key] += probability
                chunk_counts[key] += 1
                document_labels[key] = int(label)
    ordered = sorted(document_labels)
    actual = [document_labels[key] for key in ordered]
    predicted = [int((probability_sums[key] / chunk_counts[key]).argmax()) for key in ordered]
    return {
        "accuracy": accuracy_score(actual, predicted),
        "weighted_f1": f1_score(actual, predicted, average="weighted", zero_division=0),
        "macro_f1": f1_score(actual, predicted, average="macro", zero_division=0),
        "report": classification_report(actual, predicted, target_names=label_names, zero_division=0, output_dict=True),
    }


def save_checkpoint(model, tokenizer, output: Path, metrics: dict):
    output.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(output, safe_serialization=True)
    tokenizer.save_pretrained(output)
    (output / "training_metrics.json").write_text(
        json.dumps(metrics, indent=2, default=lambda value: value.item() if hasattr(value, "item") else str(value)),
        encoding="utf-8",
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune CVerify without document leakage")
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--base-model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--gradient-accumulation", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--max-length", type=int, default=384)
    parser.add_argument("--stride", type=int, default=128)
    parser.add_argument("--max-chunks", type=int, default=2)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--class-balance", choices=["none", "sqrt"], default="none")
    parser.add_argument("--label-smoothing", type=float, default=0.0)
    return parser.parse_args()


def main():
    args = parse_args()
    seed_everything()
    if args.output.resolve() == args.base_model.resolve():
        raise ValueError("Output must not overwrite the base model")
    frame = pd.read_csv(args.data, usecols=["filename", "category", "text"]).dropna(subset=["category", "text"])
    frame = frame.drop_duplicates(subset=["filename"], keep="first")
    counts = frame["category"].value_counts()
    frame = frame[frame["category"].isin(counts[counts >= 3].index)].reset_index(drop=True)
    label_names = sorted(frame["category"].unique().tolist())
    label2id = {label: index for index, label in enumerate(label_names)}
    id2label = {index: label for label, index in label2id.items()}
    train_frame, validation_frame, test_frame = split_documents(frame)
    print(f"Documents train={len(train_frame)} validation={len(validation_frame)} test={len(test_frame)}")

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        local_files_only=True,
        num_labels=len(label_names),
        label2id=label2id,
        id2label=id2label,
    )
    train_dataset = create_dataset(train_frame, tokenizer, label2id, args)
    validation_dataset = create_dataset(validation_frame, tokenizer, label2id, args)
    test_dataset = create_dataset(test_frame, tokenizer, label2id, args)
    print(f"Chunks train={len(train_dataset)} validation={len(validation_dataset)} test={len(test_dataset)}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cuda":
        torch.backends.cuda.matmul.allow_tf32 = True
    model.to(device)
    print(f"Device: {device} {torch.cuda.get_device_name(0) if device.type == 'cuda' else ''}")
    loader_options = {"batch_size": args.batch_size, "num_workers": args.workers, "pin_memory": device.type == "cuda"}
    train_loader = DataLoader(train_dataset, shuffle=True, **loader_options)
    validation_loader = DataLoader(validation_dataset, shuffle=False, **loader_options)
    test_loader = DataLoader(test_dataset, shuffle=False, **loader_options)

    baseline_validation = evaluate(model, validation_loader, device, label_names)
    baseline_test = evaluate(model, test_loader, device, label_names)
    print(
        f"Baseline validation weighted F1={baseline_validation['weighted_f1']:.4f}; "
        f"test weighted F1={baseline_test['weighted_f1']:.4f} macro F1={baseline_test['macro_f1']:.4f}"
    )
    class_weights = None
    if args.class_balance == "sqrt":
        frequencies = train_frame["category"].value_counts()
        weights = [math.sqrt(len(train_frame) / (len(label_names) * frequencies[label])) for label in label_names]
        class_weights = torch.tensor(weights, dtype=torch.float32, device=device)
        class_weights /= class_weights.mean()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=0.01)
    updates_per_epoch = math.ceil(len(train_loader) / args.gradient_accumulation)
    total_updates = updates_per_epoch * args.epochs
    scheduler = get_linear_schedule_with_warmup(optimizer, max(1, total_updates // 10), total_updates)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")
    history = []
    best_f1 = baseline_validation["weighted_f1"]
    save_checkpoint(
        model,
        tokenizer,
        args.output,
        {"status": "baseline", "baseline_validation": baseline_validation, "baseline_test": baseline_test, "history": history},
    )

    for epoch in range(args.epochs):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        running_loss = 0.0
        started = time.time()
        for step, batch in enumerate(train_loader, start=1):
            input_ids = batch["input_ids"].to(device, non_blocking=True)
            attention_mask = batch["attention_mask"].to(device, non_blocking=True)
            labels = batch["labels"].to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
                logits = model(input_ids=input_ids, attention_mask=attention_mask).logits
                loss = functional.cross_entropy(
                    logits.float(),
                    labels,
                    weight=class_weights,
                    label_smoothing=args.label_smoothing,
                )
                loss = loss / args.gradient_accumulation
            scaler.scale(loss).backward()
            running_loss += loss.detach().item() * args.gradient_accumulation
            if step % args.gradient_accumulation == 0 or step == len(train_loader):
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)
                scheduler.step()
            if step % 100 == 0:
                print(f"Epoch {epoch + 1}/{args.epochs} step {step}/{len(train_loader)} loss={running_loss / step:.4f}")
        validation = evaluate(model, validation_loader, device, label_names)
        epoch_metrics = {
            "epoch": epoch + 1,
            "train_loss": running_loss / max(1, len(train_loader)),
            "seconds": time.time() - started,
            "validation": validation,
        }
        history.append(epoch_metrics)
        print(f"Epoch {epoch + 1}: val weighted F1={validation['weighted_f1']:.4f} macro F1={validation['macro_f1']:.4f}")
        if validation["weighted_f1"] > best_f1:
            best_f1 = validation["weighted_f1"]
            save_checkpoint(
                model,
                tokenizer,
                args.output,
                {
                    "status": "training",
                    "baseline_validation": baseline_validation,
                    "baseline_test": baseline_test,
                    "history": history,
                },
            )

    best_model = AutoModelForSequenceClassification.from_pretrained(args.output, local_files_only=True).to(device)
    final_test = evaluate(best_model, test_loader, device, label_names)
    metrics = {
        "seed": SEED,
        "base_model": str(args.base_model.resolve()),
        "documents": {"total": len(frame), "train": len(train_frame), "validation": len(validation_frame), "test": len(test_frame)},
        "chunks": {"train": len(train_dataset), "validation": len(validation_dataset), "test": len(test_dataset)},
        "configuration": vars(args) | {"data": str(args.data), "base_model": str(args.base_model), "output": str(args.output)},
        "baseline_validation": baseline_validation,
        "baseline_test": baseline_test,
        "history": history,
        "final_test": final_test,
    }
    save_checkpoint(best_model, tokenizer, args.output, metrics)
    print(f"Final test accuracy={final_test['accuracy']:.4f} weighted F1={final_test['weighted_f1']:.4f} macro F1={final_test['macro_f1']:.4f}")


if __name__ == "__main__":
    main()
