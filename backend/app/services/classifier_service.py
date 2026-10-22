"""
BulletBoost - Resume Bullet Quality Classifier Service
Loads the persisted scikit-learn Pipeline (TF-IDF + Logistic Regression),
caches it in memory, validates inputs, and provides batch predictions
and evaluation metrics reporting.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import joblib
import numpy as np
import sklearn

from ..config import settings
from ..models import (
    BulletClassificationInput,
    BulletClassificationResult,
    ClassifierStatusResponse,
    EvaluationMetricsResponse,
    DatasetMetadata,
    MetricsDetails,
    PerClassMetric,
)

logger = logging.getLogger("classifier_service")


class ClassifierService:
    """Service for caching and executing inference with the custom resume bullet classifier."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        report_path: Optional[str] = None,
        dataset_path: Optional[str] = None,
    ):
        self.model_path = model_path or settings.CLASSIFIER_PATH
        self.report_path = report_path or settings.EVALUATION_REPORT_PATH
        self.dataset_path = dataset_path or settings.DATASET_PATH

        self._pipeline = None
        self._model_version: Optional[str] = None
        self._loaded: bool = False
        self._load_error: Optional[str] = None
        self._last_trained: Optional[str] = None
        self._sklearn_version: Optional[str] = None

    def load_model(self, force_reload: bool = False) -> bool:
        """Loads and caches the scikit-learn Pipeline from disk."""
        if self._loaded and not force_reload:
            return True

        if not os.path.exists(self.model_path):
            self._loaded = False
            self._pipeline = None
            self._load_error = f"Model artifact not found at: {self.model_path}"
            logger.warning(self._load_error)
            return False

        try:
            pipeline = joblib.load(self.model_path)
            # Verify loaded object has required predict and predict_proba methods
            if not hasattr(pipeline, "predict") or not hasattr(pipeline, "predict_proba"):
                raise TypeError(f"Loaded object from {self.model_path} is not a valid scikit-learn classifier pipeline.")

            self._pipeline = pipeline
            self._loaded = True
            self._load_error = None

            # Attempt to read metadata from the evaluation report if present
            if os.path.exists(self.report_path):
                try:
                    with open(self.report_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        self._model_version = meta.get("model_version", "1.0.0")
                        self._last_trained = meta.get("evaluation_timestamp")
                        self._sklearn_version = meta.get("scikit_learn_version", sklearn.__version__)
                except Exception as meta_err:
                    logger.warning(f"Could not parse evaluation report metadata: {meta_err}")
                    self._model_version = "1.0.0"
                    self._sklearn_version = sklearn.__version__
            else:
                self._model_version = "1.0.0"
                self._sklearn_version = sklearn.__version__

            logger.info(f"Loaded ML classifier v{self._model_version} from {self.model_path}")
            return True
        except Exception as e:
            self._loaded = False
            self._pipeline = None
            self._load_error = f"Failed to load classifier model: {str(e)}"
            logger.error(self._load_error)
            return False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_version(self) -> Optional[str]:
        return self._model_version

    def classify_bullets(
        self, bullets: List[BulletClassificationInput]
    ) -> List[BulletClassificationResult]:
        """
        Classify an array of bullet inputs.
        Preserves exact input order and ID mapping.
        Validates individual bullet text and handles model unavailability cleanly.
        """
        if not self._loaded:
            # Try lazy load
            self.load_model()

        # If model still not available, fail with model_unavailable status
        if not self._loaded or self._pipeline is None:
            return [
                BulletClassificationResult(
                    id=bullet.id,
                    text=bullet.text,
                    quality=None,
                    confidence=None,
                    model_version=None,
                    status="model_unavailable",
                    error=self._load_error or "ML model artifact is not loaded on server.",
                )
                for bullet in bullets
            ]

        results: List[BulletClassificationResult] = []
        valid_indices: List[int] = []
        valid_texts: List[str] = []

        # Validate inputs
        for idx, bullet in enumerate(bullets):
            text_cleaned = bullet.text.strip() if bullet.text else ""
            if not text_cleaned:
                results.append(
                    BulletClassificationResult(
                        id=bullet.id,
                        text=bullet.text,
                        quality=None,
                        confidence=None,
                        model_version=self._model_version,
                        status="invalid_input",
                        error="Bullet text cannot be empty or blank.",
                    )
                )
            else:
                # Placeholder for successful batch prediction
                results.append(None)  # type: ignore
                valid_indices.append(idx)
                valid_texts.append(text_cleaned)

        # Run batch prediction on all valid texts
        if valid_texts:
            try:
                preds = self._pipeline.predict(valid_texts)
                probas = self._pipeline.predict_proba(valid_texts)

                for pos, (orig_idx, pred, proba_row) in enumerate(zip(valid_indices, preds, probas)):
                    bullet = bullets[orig_idx]
                    quality_str = str(pred).lower()
                    confidence_score = float(round(float(np.max(proba_row)), 4))

                    results[orig_idx] = BulletClassificationResult(
                        id=bullet.id,
                        text=bullet.text,
                        quality=quality_str,  # type: ignore
                        confidence=confidence_score,
                        model_version=self._model_version,
                        status="success",
                        error=None,
                    )
            except Exception as inf_err:
                logger.error(f"Inference error during batch classification: {inf_err}")
                for orig_idx in valid_indices:
                    bullet = bullets[orig_idx]
                    results[orig_idx] = BulletClassificationResult(
                        id=bullet.id,
                        text=bullet.text,
                        quality=None,
                        confidence=None,
                        model_version=self._model_version,
                        status="error",
                        error=f"Model evaluation failed: {str(inf_err)}",
                    )

        return results

    def get_status(self) -> ClassifierStatusResponse:
        """Returns the operational status of the model artifact and training dataset."""
        # Check current files on disk
        model_exists = os.path.exists(self.model_path)
        dataset_exists = os.path.exists(self.dataset_path)
        report_exists = os.path.exists(self.report_path)

        # If not loaded but model exists, attempt load
        if not self._loaded and model_exists:
            self.load_model()

        last_trained = self._last_trained
        if not last_trained and report_exists:
            try:
                with open(self.report_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    last_trained = data.get("evaluation_timestamp")
            except Exception:
                pass

        return ClassifierStatusResponse(
            model_loaded=self._loaded,
            model_version=self._model_version if self._loaded else None,
            scikit_learn_version=self._sklearn_version or sklearn.__version__,
            model_path=self.model_path,
            dataset_available=dataset_exists,
            dataset_path=self.dataset_path,
            evaluation_report_available=report_exists,
            last_trained=last_trained,
        )

    def get_evaluation_metrics(self) -> EvaluationMetricsResponse:
        """
        Reads and returns the persisted evaluation report.
        Never returns fabricated numbers when report is missing.
        """
        if not os.path.exists(self.report_path):
            return EvaluationMetricsResponse(
                available=False,
                status_message="Evaluation metrics not found. Train the model using backend/scripts/train_classifier.py.",
            )

        try:
            with open(self.report_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            raw_meta = data.get("dataset_metadata", {})
            meta = DatasetMetadata(
                total_samples=raw_meta.get("total_samples", 0),
                train_samples=raw_meta.get("train_samples", 0),
                test_samples=raw_meta.get("test_samples", 0),
                test_split_ratio=raw_meta.get("test_split_ratio", 0.2),
                overall_distribution=raw_meta.get("overall_distribution", {}),
                train_distribution=raw_meta.get("train_distribution", {}),
                test_distribution=raw_meta.get("test_distribution", {}),
                provenance=raw_meta.get("provenance", "Curated dataset"),
                limitations=raw_meta.get("limitations", "Experimental classifier"),
            )

            raw_metrics = data.get("metrics", {})
            per_class_dict = {}
            for label, pcm in raw_metrics.get("per_class", {}).items():
                per_class_dict[label] = PerClassMetric(
                    precision=pcm.get("precision", 0.0),
                    recall=pcm.get("recall", 0.0),
                    f1_score=pcm.get("f1_score", 0.0),
                    support=pcm.get("support", 0),
                )

            metrics_details = MetricsDetails(
                accuracy=raw_metrics.get("accuracy", 0.0),
                macro_precision=raw_metrics.get("macro_precision", 0.0),
                macro_recall=raw_metrics.get("macro_recall", 0.0),
                macro_f1=raw_metrics.get("macro_f1", 0.0),
                class_labels=raw_metrics.get("class_labels", ["weak", "adequate", "strong"]),
                per_class=per_class_dict,
                confusion_matrix=raw_metrics.get("confusion_matrix", []),
            )

            return EvaluationMetricsResponse(
                available=True,
                model_name=data.get("model_name", "bullet_quality_classifier"),
                model_version=data.get("model_version", "1.0.0"),
                model_architecture=data.get("model_architecture", "TF-IDF + Logistic Regression"),
                scikit_learn_version=data.get("scikit_learn_version", sklearn.__version__),
                evaluation_timestamp=data.get("evaluation_timestamp"),
                random_seed=data.get("random_seed", 42),
                dataset_metadata=meta,
                metrics=metrics_details,
                status_message="Real evaluation metrics loaded from persisted test split report.",
            )
        except Exception as err:
            logger.error(f"Error reading evaluation report: {err}")
            return EvaluationMetricsResponse(
                available=False,
                status_message=f"Failed to parse evaluation report: {str(err)}",
            )


# Singleton instance cached in memory
classifier_service = ClassifierService()
