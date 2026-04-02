const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  source: string;
  source_id: string;
  author_ids: string[] | null;
  keywords: string[] | null;
  published_at: string | null;
  summary: string | null;
}

export interface PaperSearchResult {
  papers: Paper[];
  total: number;
  page: number;
  per_page: number;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.error ?? "UNKNOWN",
      body?.message ?? res.statusText,
    );
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Papers API ──────────────────────────────────────

export async function searchPapers(
  keyword: string,
  page = 1,
  perPage = 20,
  token?: string,
): Promise<PaperSearchResult> {
  const params = new URLSearchParams({
    keyword,
    page: String(page),
    per_page: String(perPage),
  });

  return apiFetch<PaperSearchResult>(`/api/papers/search?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function getPaper(
  id: string,
  token?: string,
): Promise<Paper> {
  return apiFetch<Paper>(`/api/papers/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function collectPapers(
  keyword: string,
  token: string,
): Promise<{ task_id: string }> {
  return apiFetch<{ task_id: string }>("/api/papers/collect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keyword }),
  });
}
