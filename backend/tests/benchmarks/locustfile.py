"""
Locust performance benchmark for academi.ai backend.

Usage:
    # Install locust first: pip install locust
    cd backend
    locust -f tests/benchmarks/locustfile.py --host=http://localhost:8000

Then open http://localhost:8089, set users=50, spawn-rate=5, and run for 2-3 minutes.

Target SLOs (p95):
    - /health              < 50ms
    - /api/meta/stats      < 200ms
    - /api/papers/search   < 800ms (cached) / < 2000ms (cold)

Set AUTH_TOKEN env var to test authenticated endpoints.
"""

from __future__ import annotations

import os
import random

from locust import HttpUser, between, task


QUERIES = [
    "transformer architecture",
    "graph neural networks",
    "reinforcement learning robotics",
    "diffusion models image generation",
    "large language models reasoning",
    "retrieval augmented generation",
    "contrastive learning representation",
    "federated learning privacy",
    "multimodal vision language",
    "mixture of experts scaling",
]


class AcademiUser(HttpUser):
    """Simulated reader performing search + browse flows."""

    wait_time = between(1, 3)

    def on_start(self):
        self.token = os.getenv("AUTH_TOKEN", "")
        self.headers = (
            {"Authorization": f"Bearer {self.token}"} if self.token else {}
        )

    @task(10)
    def health_check(self):
        self.client.get("/health", name="GET /health")

    @task(5)
    def meta_stats(self):
        self.client.get("/api/meta/stats", name="GET /api/meta/stats")

    @task(20)
    def search_papers(self):
        query = random.choice(QUERIES)
        payload = {"query": query, "limit": 10}
        self.client.post(
            "/api/papers/search",
            json=payload,
            headers=self.headers,
            name="POST /api/papers/search",
        )

    @task(3)
    def search_with_filters(self):
        query = random.choice(QUERIES)
        payload = {
            "query": query,
            "limit": 10,
            "year_from": 2022,
            "year_to": 2024,
            "source": random.choice(["arxiv", "semantic_scholar"]),
        }
        self.client.post(
            "/api/papers/search",
            json=payload,
            headers=self.headers,
            name="POST /api/papers/search (filtered)",
        )
