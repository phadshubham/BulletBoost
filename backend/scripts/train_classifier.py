"""
BulletBoost - Resume Bullet Quality Classifier Training Pipeline
Trains a scikit-learn Pipeline (TF-IDF + Logistic Regression) on labeled bullet points.
Evaluates on a held-out test split and persists the trained artifact and evaluation report.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_classifier")

# Constants
VALID_LABELS = ["weak", "adequate", "strong"]
LABEL_ORDER = ["weak", "adequate", "strong"]
RANDOM_SEED = 42
TEST_SIZE = 0.20
MODEL_VERSION = "1.0.0"

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "bullet_quality_dataset.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_OUTPUT_PATH = os.path.join(MODELS_DIR, "bullet_classifier.joblib")
REPORT_OUTPUT_PATH = os.path.join(MODELS_DIR, "evaluation_report.json")


def load_and_validate_dataset(csv_path: str) -> pd.DataFrame:
    """Loads CSV dataset and validates rows against the schema and rubric."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset file not found at: {csv_path}")

    df = pd.read_csv(csv_path)
    logger.info(f"Loaded raw dataset with {len(df)} rows from {csv_path}")

    # Check required columns
    required_cols = {"bullet_text", "label"}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {missing_cols}")

    # Drop nulls and blank text
    initial_count = len(df)
    df = df.dropna(subset=["bullet_text", "label"]).copy()
    df["bullet_text"] = df["bullet_text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip().str.lower()
    df = df[df["bullet_text"].str.len() > 0]

    # Validate labels
    invalid_mask = ~df["label"].isin(VALID_LABELS)
    if invalid_mask.any():
        invalid_count = invalid_mask.sum()
        logger.warning(f"Dropping {invalid_count} rows with invalid labels: {df.loc[invalid_mask, 'label'].tolist()}")
        df = df[~invalid_mask]

    # Deduplicate by text
    dup_count = df.duplicated(subset=["bullet_text"]).sum()
    if dup_count > 0:
        logger.warning(f"Removing {dup_count} duplicate bullet texts")
        df = df.drop_duplicates(subset=["bullet_text"]).copy()

    logger.info(f"Cleaned dataset: {len(df)} rows (dropped {initial_count - len(df)} rows)")
    logger.info(f"Class distribution:\n{df['label'].value_counts().to_string()}")

    if len(df) < 15:
        raise ValueError(f"Dataset too small for training: only {len(df)} samples")

    return df


def build_pipeline() -> Pipeline:
    """Constructs the complete text preprocessing and classification pipeline."""
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                ngram_range=(1, 2),
                sublinear_tf=True,
                max_features=2500,
                min_df=1,
                token_pattern=r"(?u)\b\w+\b",
            ),
        ),
        (
            "clf",
            LogisticRegression(
                C=2.0,
                max_iter=1000,
                random_state=RANDOM_SEED,
                class_weight="balanced",
                solver="lbfgs",
            ),
        ),
    ])


def train_and_evaluate(
    df: pd.DataFrame,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_SEED,
) -> Tuple[Pipeline, Dict[str, Any]]:
    """Splits data, trains pipeline, and produces comprehensive evaluation metrics."""
    X = df["bullet_text"].values
    y = df["label"].values

    # Stratified train/test split to preserve class ratios
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    logger.info(f"Train set: {len(X_train)} samples, Test set: {len(X_test)} samples")

    # Fit pipeline purely on training data
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    # Evaluate on held-out test split
    y_pred = pipeline.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
        y_test, y_pred, average="macro", zero_division=0
    )

    # Per-class metrics
    p_class, r_class, f1_class, support_class = precision_recall_fscore_support(
        y_test, y_pred, labels=LABEL_ORDER, zero_division=0
    )

    cm = confusion_matrix(y_test, y_pred, labels=LABEL_ORDER)

    per_class_metrics = {}
    for idx, label in enumerate(LABEL_ORDER):
        per_class_metrics[label] = {
            "precision": float(round(p_class[idx], 4)),
            "recall": float(round(r_class[idx], 4)),
            "f1_score": float(round(f1_class[idx], 4)),
            "support": int(support_class[idx]),
        }

    # Class distributions
    train_dist = {str(k): int(v) for k, v in pd.Series(y_train).value_counts().items()}
    test_dist = {str(k): int(v) for k, v in pd.Series(y_test).value_counts().items()}
    total_dist = {str(k): int(v) for k, v in pd.Series(y).value_counts().items()}

    report = {
        "model_name": "bullet_quality_classifier",
        "model_version": MODEL_VERSION,
        "model_architecture": "TF-IDF (unigrams & bigrams) + LogisticRegression (L2, balanced)",
        "scikit_learn_version": sklearn.__version__,
        "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
        "random_seed": random_state,
        "dataset_metadata": {
            "total_samples": len(df),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "test_split_ratio": test_size,
            "overall_distribution": total_dist,
            "train_distribution": train_dist,
            "test_distribution": test_dist,
            "provenance": (
                "Curated domain-specific dataset with synthetic-grounded examples across engineering, "
                "data science, QA, and project management. Evaluated against a 3-tier rubric."
            ),
            "limitations": (
                "This experimental classifier estimates quality against a specific written rubric. "
                "It is not an ATS hiring score or factual verification tool. Performance may vary on "
                "out-of-domain resumes."
            ),
        },
        "metrics": {
            "accuracy": float(round(acc, 4)),
            "macro_precision": float(round(precision_macro, 4)),
            "macro_recall": float(round(recall_macro, 4)),
            "macro_f1": float(round(f1_macro, 4)),
            "class_labels": LABEL_ORDER,
            "per_class": per_class_metrics,
            "confusion_matrix": cm.tolist(),
        },
    }

    logger.info("Evaluation Summary on Held-Out Test Set:")
    logger.info(f"  Accuracy:        {acc:.4f}")
    logger.info(f"  Macro Precision: {precision_macro:.4f}")
    logger.info(f"  Macro Recall:    {recall_macro:.4f}")
    logger.info(f"  Macro F1:        {f1_macro:.4f}")
    logger.info(f"Confusion Matrix (Order: {LABEL_ORDER}):\n{cm}")

    return pipeline, report


def save_artifacts(pipeline: Pipeline, report: Dict[str, Any], model_path: str, report_path: str) -> None:
    """Saves model and report artifacts to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)

    joblib.dump(pipeline, model_path)
    logger.info(f"Saved trained model artifact to: {model_path}")

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    logger.info(f"Saved evaluation report to: {report_path}")


def main():
    logger.info("Starting BulletBoost classifier training pipeline...")
    df = load_and_validate_dataset(DATA_PATH)
    pipeline, report = train_and_evaluate(df)
    save_artifacts(pipeline, report, MODEL_OUTPUT_PATH, REPORT_OUTPUT_PATH)
    logger.info("Training pipeline completed successfully.")


if __name__ == "__main__":
    main()
