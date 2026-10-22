"""
Tests for Custom ML Resume Bullet Classifier Pipeline, Dataset, and Service.
Covers:
1. Dataset loading and validation
2. Invalid labels and blank text rejection
3. Duplicate detection
4. Reproducible train/test splitting
5. Training and saving pipeline
6. Loading saved artifact
7. Predictions across supported labels
8. Missing and incompatible artifact handling
9. Serialization and evaluation report consistency
10. Confusion matrix class order
"""

import os
import tempfile
import pytest
import pandas as pd
import numpy as np
import joblib
from sklearn.pipeline import Pipeline

from backend.scripts.train_classifier import (
    load_and_validate_dataset,
    build_pipeline,
    train_and_evaluate,
    save_artifacts,
    VALID_LABELS,
    LABEL_ORDER,
    RANDOM_SEED,
)
from backend.app.services.classifier_service import ClassifierService
from backend.app.models import BulletClassificationInput


@pytest.fixture
def sample_csv(tmp_path):
    """Creates a small valid CSV dataset fixture."""
    data = [
        ("bullet_text", "label", "example_source", "annotation_notes"),
        ("Worked on backend.", "weak", "synthetic", "vague"),
        ("Helped team with stuff.", "weak", "synthetic", "vague"),
        ("Assisted with testing.", "weak", "synthetic", "vague"),
        ("Responsible for files.", "weak", "synthetic", "vague"),
        ("Answered calls.", "weak", "synthetic", "vague"),
        ("Fixed minor bug.", "weak", "synthetic", "vague"),
        ("Developed REST APIs using FastAPI and Python.", "adequate", "synthetic", "good stack"),
        ("Built React components with Tailwind CSS.", "adequate", "synthetic", "good UI"),
        ("Configured CI/CD pipelines in GitHub Actions.", "adequate", "synthetic", "good devops"),
        ("Implemented user authentication with JWT.", "adequate", "synthetic", "good security"),
        ("Wrote unit tests using pytest.", "adequate", "synthetic", "good tests"),
        ("Managed PostgreSQL database schemas and migrations.", "adequate", "synthetic", "good db"),
        ("Engineered event-driven pipeline processing 1M records with 99.9% uptime.", "strong", "synthetic", "high scale"),
        ("Architected SaaS backend cutting p95 response from 400ms to 80ms.", "strong", "synthetic", "great perf"),
        ("Spearheaded microservices migration improving releases from weekly to daily.", "strong", "synthetic", "leadership"),
        ("Automated infrastructure via Terraform cutting setup from 3 days to 20 mins.", "strong", "synthetic", "high impact"),
        ("Trained fraud model achieving 0.94 ROC-AUC and 35% false positive reduction.", "strong", "synthetic", "data science"),
        ("Refactored billing engine processing $2M with zero discrepancies.", "strong", "synthetic", "zero error"),
    ]
    csv_file = tmp_path / "test_dataset.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        for row in data:
            f.write(",".join(f'"{c}"' for c in row) + "\n")
    return str(csv_file)


# 1. Dataset loading and validation
def test_1_dataset_loading_and_validation(sample_csv):
    df = load_and_validate_dataset(sample_csv)
    assert len(df) == 18
    assert set(df.columns).issuperset({"bullet_text", "label"})
    assert set(df["label"].unique()) == {"weak", "adequate", "strong"}


# 2. Invalid labels and blank text rejection
def test_2_invalid_labels_and_blank_text(tmp_path):
    csv_file = tmp_path / "invalid_data.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write('bullet_text,label,example_source,annotation_notes\n')
        f.write('"Valid bullet one","weak","src","note"\n')
        f.write('"Valid bullet two","adequate","src","note"\n')
        f.write('"Valid bullet three","strong","src","note"\n')
        f.write('"Bad label row","excellent","src","should be dropped"\n')
        f.write('"","weak","src","blank text should be dropped"\n')
        f.write('"   ","strong","src","whitespace text should be dropped"\n')
        # Add enough valid samples to pass length check
        for i in range(15):
            f.write(f'"Valid sample {i}","adequate","src","note"\n')

    df = load_and_validate_dataset(str(csv_file))
    assert "excellent" not in df["label"].values
    assert not (df["bullet_text"].str.strip() == "").any()
    assert len(df) == 18


# 3. Duplicate detection
def test_3_duplicate_detection(tmp_path):
    csv_file = tmp_path / "dup_data.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write('bullet_text,label,example_source,annotation_notes\n')
        for i in range(16):
            f.write(f'"Unique bullet {i}","adequate","src","note"\n')
        # Add duplicate
        f.write('"Unique bullet 0","adequate","src","duplicate note"\n')

    df = load_and_validate_dataset(str(csv_file))
    assert len(df) == 16
    assert df.duplicated(subset=["bullet_text"]).sum() == 0


# 4. Reproducible train/test splitting
def test_4_reproducible_train_test_splitting(sample_csv):
    df = load_and_validate_dataset(sample_csv)
    pipe1, rep1 = train_and_evaluate(df, test_size=0.2, random_state=42)
    pipe2, rep2 = train_and_evaluate(df, test_size=0.2, random_state=42)

    assert rep1["metrics"]["accuracy"] == rep2["metrics"]["accuracy"]
    assert rep1["dataset_metadata"]["test_distribution"] == rep2["dataset_metadata"]["test_distribution"]


# 5. Training and saving pipeline
def test_5_training_and_saving_pipeline(sample_csv, tmp_path):
    df = load_and_validate_dataset(sample_csv)
    pipeline, report = train_and_evaluate(df)

    model_path = str(tmp_path / "model.joblib")
    report_path = str(tmp_path / "report.json")
    save_artifacts(pipeline, report, model_path, report_path)

    assert os.path.exists(model_path)
    assert os.path.exists(report_path)
    assert os.path.getsize(model_path) > 1000


# 6. Loading saved artifact
def test_6_loading_saved_artifact(sample_csv, tmp_path):
    df = load_and_validate_dataset(sample_csv)
    pipeline, report = train_and_evaluate(df)

    model_path = str(tmp_path / "model.joblib")
    report_path = str(tmp_path / "report.json")
    save_artifacts(pipeline, report, model_path, report_path)

    svc = ClassifierService(model_path=model_path, report_path=report_path)
    assert svc.load_model() is True
    assert svc.is_loaded is True
    assert svc.model_version == "1.0.0"


# 7. Successful predictions for all supported labels
def test_7_successful_predictions_across_labels():
    from backend.app.services.classifier_service import classifier_service

    assert classifier_service.load_model() is True

    test_bullets = [
        BulletClassificationInput(id="w1", text="Helped team with some bug fixes in python."),
        BulletClassificationInput(id="a1", text="Developed RESTful API endpoints using Python, FastAPI, and PostgreSQL."),
        BulletClassificationInput(id="s1", text="Architected distributed event-driven pipeline in Go, sustaining 10,000 req/sec with 99.99% uptime."),
    ]
    results = classifier_service.classify_bullets(test_bullets)

    assert len(results) == 3
    for res in results:
        assert res.status == "success"
        assert res.quality in ["weak", "adequate", "strong"]
        assert 0.0 <= res.confidence <= 1.0


# 8. Missing or incompatible model artifacts (No fake predictions)
def test_8_missing_or_incompatible_artifact(tmp_path):
    missing_path = str(tmp_path / "nonexistent_model.joblib")
    svc = ClassifierService(model_path=missing_path)

    assert svc.load_model() is False
    assert svc.is_loaded is False

    results = svc.classify_bullets([BulletClassificationInput(id="b1", text="Some bullet text")])
    assert len(results) == 1
    assert results[0].status == "model_unavailable"
    assert results[0].quality is None  # Never fabricate predictions!
    assert results[0].confidence is None
    assert "not found" in results[0].error.lower()


# 9. Incompatible/corrupted model artifact
def test_9_incompatible_artifact(tmp_path):
    corrupt_path = tmp_path / "corrupt.joblib"
    with open(corrupt_path, "w") as f:
        f.write("not a joblib file")

    svc = ClassifierService(model_path=str(corrupt_path))
    assert svc.load_model() is False
    assert svc.is_loaded is False


# 10. Actual evaluation result serialization
def test_10_evaluation_result_serialization():
    from backend.app.services.classifier_service import classifier_service

    metrics_res = classifier_service.get_evaluation_metrics()
    assert metrics_res.available is True
    assert metrics_res.metrics is not None
    assert 0.0 <= metrics_res.metrics.accuracy <= 1.0
    assert 0.0 <= metrics_res.metrics.macro_f1 <= 1.0
    assert metrics_res.dataset_metadata is not None
    assert metrics_res.dataset_metadata.total_samples >= 150


# 11. Correct confusion matrix class order
def test_11_confusion_matrix_class_order():
    from backend.app.services.classifier_service import classifier_service

    metrics_res = classifier_service.get_evaluation_metrics()
    assert metrics_res.metrics.class_labels == ["weak", "adequate", "strong"]
    cm = metrics_res.metrics.confusion_matrix
    assert len(cm) == 3
    assert all(len(row) == 3 for row in cm)
