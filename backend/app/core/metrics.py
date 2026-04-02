from prometheus_client import Counter, Gauge

research_requests_total = Counter(
    "research_requests_total",
    "Total research requests",
    ["plan"],
)

paper_search_total = Counter(
    "paper_search_total",
    "Total paper searches",
    ["source"],
)

export_jobs_total = Counter(
    "export_jobs_total",
    "Total export jobs",
    ["format", "status"],
)

active_users_gauge = Gauge(
    "active_users",
    "Number of active users",
)
