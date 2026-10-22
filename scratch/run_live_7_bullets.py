import urllib.request
import json
import time
import sys

print("Starting test script...", flush=True)

bullets = [
    {"id": "b1", "text": "Developed an AI-powered sales forecasting dashboard combining Prophet and Auto-ARIMA for multi-model forecasting.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b2", "text": "Built model evaluation using MAE, RMSE and MAPE and generated KPI insights including growth trends.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b3", "text": "Integrated LLaMA3 through Ollama and LangChain to generate contextual business insights from forecast data.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b4", "text": "Implemented Grad-CAM explainability to generate heatmaps showing image regions influencing model decisions.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b5", "text": "Built real-time prediction APIs using FastAPI with a React frontend for image upload, classification and visualization.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b6", "text": "Achieved 97.59% validation accuracy across 22,000 validation samples.", "section_title": "Projects", "section_type": "projects"},
    {"id": "b7", "text": "Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance.", "section_title": "Projects", "section_type": "projects"},
]

req_data = {
    "bullets": bullets,
    "target_role": "Machine Learning Engineer",
    "writing_style": "technical",
    "supporting_facts": ""
}

print(f"Connecting to http://127.0.0.1:8000/api/enhance-bullets with {len(bullets)} bullets...", flush=True)
t0 = time.time()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/enhance-bullets",
    data=json.dumps(req_data).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=240) as response:
        elapsed = time.time() - t0
        raw = response.read().decode("utf-8")
        data = json.loads(raw)
        print(f"SUCCESS in {elapsed:.1f}s!\n", flush=True)
        for b in data["bullets"]:
            print(f"[{b['id']}] status={b['status']} decision_reason={b.get('decision_reason')}", flush=True)
            print(f"  ORIG: {b['original']}", flush=True)
            print(f"  IMPR: {b.get('improved')}", flush=True)
            print(f"  EXPL: {b.get('explanation')}\n", flush=True)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", flush=True)
