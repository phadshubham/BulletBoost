"""
Live evaluation script against running backend & local Ollama (llama3.2:3b).
Evaluates 7 representative domains:
1. Machine Learning
2. Software Engineering
3. Data Analysis
4. Academic Projects
5. Internships
6. QA and Testing
7. Cloud & Backend
"""

import json
import httpx

TEST_CASES = [
    {
        "domain": "Machine Learning",
        "bullet": "Integrated a fine-tuned ResNet50 model through REST APIs to classify images as Real or AI-Generated.",
        "target_role": "Machine Learning Engineer",
        "evidence": "",
    },
    {
        "domain": "Software Engineering",
        "bullet": "Developed authentication microservice in Node.js and JWT with role-based access control.",
        "target_role": "Backend Engineer",
        "evidence": "",
    },
    {
        "domain": "Data Analysis",
        "bullet": "Analyzed customer churn trends using SQL queries and generated monthly Tableau dashboards.",
        "target_role": "Data Analyst",
        "evidence": "",
    },
    {
        "domain": "Academic Projects",
        "bullet": "Implemented Dijkstra's and A* pathfinding algorithms in C++ for graph traversal benchmark.",
        "target_role": "Software Engineer",
        "evidence": "",
    },
    {
        "domain": "Internships",
        "bullet": "Assisted senior engineers with writing unit tests in PyTest and resolving Jira bug tickets.",
        "target_role": "Junior Software Engineer",
        "evidence": "",
    },
    {
        "domain": "QA and Testing",
        "bullet": "Created end-to-end Cypress test suites covering login and checkout payment workflows.",
        "target_role": "QA Automation Engineer",
        "evidence": "",
    },
    {
        "domain": "Cloud & Backend",
        "bullet": "Configured Docker containers and deployed microservices on AWS ECS using Terraform.",
        "target_role": "DevOps Engineer",
        "evidence": "Processed 2 million records daily using Celery and Redis.",
    },
]


def run_evaluation():
    client = httpx.Client(timeout=120.0)

    results = []
    print("=" * 80)
    print("STARTING LIVE OLLAMA EVALUATION (llama3.2:3b)")
    print("=" * 80)

    for i, tc in enumerate(TEST_CASES):
        print(f"\nEvaluating Case {i+1}/7: {tc['domain']}")
        payload = {
            "bullets": [
                {
                    "id": f"eval_bullet_{i+1}",
                    "text": tc["bullet"],
                    "section_title": tc["domain"],
                    "section_type": "experience" if i not in (0, 3) else "projects",
                }
            ],
            "target_role": tc["target_role"],
            "job_description": "",
            "writing_style": "technical",
            "scope": "bullets",
            "supporting_facts": tc["evidence"],
        }

        try:
            resp = client.post("http://127.0.0.1:8000/api/enhance-bullets", json=payload)
            if resp.status_code != 200:
                print(f"FAILED: HTTP {resp.status_code} - {resp.text}")
                continue

            data = resp.json()
            enh_bullet = data["bullets"][0]

            # Classify
            class_resp = client.post(
                "http://127.0.0.1:8000/api/classifier/classify",
                json={"bullets": [{"id": enh_bullet["id"], "text": enh_bullet["improved"]}]},
            )
            class_data = class_resp.json() if class_resp.status_code == 200 else {}
            pred = class_data.get("predictions", [{}])[0]

            case_result = {
                "domain": tc["domain"],
                "source": tc["bullet"],
                "evidence": tc["evidence"],
                "improved": enh_bullet["improved"],
                "explanation": enh_bullet["explanation"],
                "warnings": [w["message"] for w in enh_bullet.get("warnings", [])],
                "ml_quality": pred.get("quality"),
                "ml_confidence": pred.get("confidence"),
            }
            results.append(case_result)

            print(f"Source: {tc['bullet']}")
            print(f"Improved: {enh_bullet['improved']}")
            print(f"Warnings: {case_result['warnings']}")
            print(f"ML Quality: {case_result['ml_quality']} ({case_result['ml_confidence']})")
            print(f"Explanation: {enh_bullet['explanation']}")

        except Exception as e:
            print(f"Error executing test case: {e}")

    with open("live_eval_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 80)
    print("EVALUATION COMPLETE - Results saved to live_eval_results.json")
    print("=" * 80)


if __name__ == "__main__":
    run_evaluation()
