# Performance Benchmarks

Load testing for academi.ai backend using [Locust](https://locust.io/).

## Install

```bash
pip install locust
```

## Run

```bash
# Start the backend first (make dev or uvicorn)
cd backend
locust -f tests/benchmarks/locustfile.py --host=http://localhost:8000
```

Open http://localhost:8089 and configure:

- **Number of users**: 50 (start low, ramp up)
- **Spawn rate**: 5/sec
- **Host**: http://localhost:8000

Run for 2–3 minutes per scenario.

## Target SLOs

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| `GET /health` | < 10ms | < 50ms | < 100ms |
| `GET /api/meta/stats` | < 50ms | < 200ms | < 500ms |
| `POST /api/papers/search` (cached) | < 100ms | < 300ms | < 800ms |
| `POST /api/papers/search` (cold) | < 500ms | < 1500ms | < 2500ms |

## Reading Results

- **Failures %** — must stay at 0% under 50 concurrent users
- **p95 response time** — primary SLO indicator
- **RPS** — throughput; target >100 RPS for search endpoint

## Headless mode (for CI)

```bash
locust -f tests/benchmarks/locustfile.py \
  --host=http://localhost:8000 \
  --users 50 --spawn-rate 5 --run-time 2m \
  --headless --only-summary \
  --csv=bench_report
```

Generates `bench_report_stats.csv` with p50/p95/p99 per endpoint.

## Authenticated endpoints

Export a valid JWT before running:

```bash
export AUTH_TOKEN="eyJ..."
locust -f tests/benchmarks/locustfile.py --host=http://localhost:8000
```
