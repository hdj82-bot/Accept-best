import { getSession } from "next-auth/react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ────────────────────────────────────────────────────────────────────────────
// Domain types (mirrors FastAPI Pydantic schemas)
// ────────────────────────────────────────────────────────────────────────────

export type Plan = "free" | "basic" | "pro" | "admin";

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  plan_expires_at: string | null;
  created_at: string;
}

export interface MonthlyUsage {
  year_month: string;           // "YYYY-MM"
  research_count: number;
  survey_count: number;
  summary_count: number;
}

export interface PlanLimits {
  research: number;
  survey: number;
  summary: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:  { research: 3,  survey: 3,  summary: 10 },
  basic: { research: 20, survey: 20, summary: 100 },
  pro:   { research: -1, survey: -1, summary: -1 },  // -1 = unlimited
  admin: { research: -1, survey: -1, summary: -1 },
};

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  source: string;               // "arxiv" | "semantic_scholar"
  source_id: string;
  year: number | null;
  similarity_score: number | null;
}

export interface ResearchNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface StartResearchResponse {
  task_id: string;
  message: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Core fetch helper
// ────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Authenticated fetch wrapper.
 * Reads the HS256 JWT from the next-auth session and attaches it as
 * `Authorization: Bearer <token>` so FastAPI can verify it with python-jose.
 *
 * @param url     Relative path (e.g. "/users/me") or full URL
 * @param options Standard RequestInit options
 * @param token   Optional token override (for server-side callers that already have it)
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> {
  let accessToken = token;

  if (!accessToken) {
    const session = await getSession();
    accessToken = session?.accessToken;
  }

  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(fullUrl, { ...options, headers });

  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const body = await res.clone().json();
      code = body.error ?? code;
      message = body.message ?? message;
    } catch { /* ignore parse errors */ }
    throw new ApiError(res.status, code, message);
  }

  return res;
}

// ────────────────────────────────────────────────────────────────────────────
// Typed endpoint functions
// ────────────────────────────────────────────────────────────────────────────

/** GET /users/me */
export async function getMe(token?: string): Promise<User> {
  const res = await fetchWithAuth("/users/me", {}, token);
  return res.json();
}

/** GET /users/me/usage */
export async function getUsage(token?: string): Promise<MonthlyUsage> {
  const res = await fetchWithAuth("/users/me/usage", {}, token);
  return res.json();
}

export interface SearchFilters {
  year_from?: number;
  year_to?: number;
  source?: "all" | "arxiv" | "semantic_scholar";
}

/**
 * POST /papers/search
 * Returns papers sorted by similarity score descending.
 */
export async function searchPapers(
  query: string,
  filters?: SearchFilters,
  token?: string,
): Promise<Paper[]> {
  const body: Record<string, unknown> = { query };
  if (filters?.year_from) body.year_from = filters.year_from;
  if (filters?.year_to)   body.year_to   = filters.year_to;
  if (filters?.source && filters.source !== "all") body.source = filters.source;
  const res = await fetchWithAuth(
    "/papers/search",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
  return res.json();
}

/**
 * POST /research/
 * Triggers the Celery `collect` pipeline for the given keyword.
 */
export async function startResearch(
  keyword: string,
  token?: string,
): Promise<StartResearchResponse> {
  const res = await fetchWithAuth(
    "/research/",
    { method: "POST", body: JSON.stringify({ keyword }) },
    token,
  );
  return res.json();
}

/**
 * POST /research/notes
 * Creates a new research note for the authenticated user.
 */
export async function createNote(
  content: string,
  token?: string,
): Promise<ResearchNote> {
  const res = await fetchWithAuth(
    "/research/notes",
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
  return res.json();
}

/** GET /research/notes */
export async function getNotes(token?: string): Promise<ResearchNote[]> {
  const res = await fetchWithAuth("/research/notes", {}, token);
  return res.json();
}

/** GET /research/notes/:id */
export async function getNote(id: string, token?: string): Promise<ResearchNote> {
  const res = await fetchWithAuth(`/research/notes/${id}`, {}, token);
  return res.json();
}

/** PATCH /research/notes/:id */
export async function updateNote(
  id: string,
  content: string,
  token?: string,
): Promise<ResearchNote> {
  const res = await fetchWithAuth(
    `/research/notes/${id}`,
    { method: "PATCH", body: JSON.stringify({ content }) },
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Versions  (paper_versions table)
// ────────────────────────────────────────────────────────────────────────────

export type SaveType = "auto" | "manual";

export interface PaperVersion {
  id: string;
  user_id: string;
  note_id: string | null;
  content: string;          // JSONB stored as string on the wire
  save_type: SaveType;
  created_at: string;
}

/** GET /versions/?note_id=<note_id> */
export async function listVersions(
  note_id?: string,
  token?: string,
): Promise<PaperVersion[]> {
  const qs = note_id ? `?note_id=${encodeURIComponent(note_id)}` : "";
  const res = await fetchWithAuth(`/versions/${qs}`, {}, token);
  return res.json();
}

/** POST /versions/ */
export async function saveVersion(
  content: string,
  save_type: SaveType,
  note_id?: string,
  token?: string,
): Promise<PaperVersion> {
  const res = await fetchWithAuth(
    "/versions/",
    { method: "POST", body: JSON.stringify({ content, save_type, note_id }) },
    token,
  );
  return res.json();
}

/** POST /versions/:id/restore → returns the restored content */
export async function restoreVersion(
  id: string,
  token?: string,
): Promise<PaperVersion> {
  const res = await fetchWithAuth(
    `/versions/${id}/restore`,
    { method: "POST" },
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Survey  (survey_questions table)
// ────────────────────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  id: string;
  user_id: string;
  paper_id: string;
  original_q: string;
  adapted_q: string;
  source_title: string | null;
  source_page: number | null;
  year: number | null;
}

export interface CreateSurveyData {
  paper_id: string;
  original_q: string;
  adapted_q: string;
  source_title?: string;
  source_page?: number;
  year?: number;
}

/** GET /survey/?paper_id=<paper_id> */
export async function listSurvey(
  paper_id?: string,
  token?: string,
): Promise<SurveyQuestion[]> {
  const qs = paper_id ? `?paper_id=${encodeURIComponent(paper_id)}` : "";
  const res = await fetchWithAuth(`/survey/${qs}`, {}, token);
  return res.json();
}

/** POST /survey/ — create a single question manually */
export async function createSurvey(
  data: CreateSurveyData,
  token?: string,
): Promise<SurveyQuestion> {
  const res = await fetchWithAuth(
    "/survey/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
  return res.json();
}

/**
 * POST /survey/generate/:paper_id
 * Triggers the Celery `process` pipeline to auto-generate questions.
 * Returns the generated questions (may be async; adjust if backend returns a task_id).
 */
export async function generateSurvey(
  paper_id: string,
  token?: string,
): Promise<SurveyQuestion[]> {
  const res = await fetchWithAuth(
    `/survey/generate/${encodeURIComponent(paper_id)}`,
    { method: "POST" },
    token,
  );
  return res.json();
}

/** DELETE /survey/:id */
export async function deleteSurvey(
  id: string,
  token?: string,
): Promise<void> {
  await fetchWithAuth(`/survey/${id}`, { method: "DELETE" }, token);
}

// ────────────────────────────────────────────────────────────────────────────
// Billing
// ────────────────────────────────────────────────────────────────────────────

export interface BillingPlan {
  id: Plan;
  name: string;
  price_monthly: number;    // KRW, 0 = free
  features: string[];
}

export interface CurrentBilling {
  plan: Plan;
  expires_at: string | null;
  auto_renew: boolean;
}

export interface UpgradePlanResponse {
  success: boolean;
  message: string;
  expires_at: string;
}

/** GET /billing/plans */
export async function getPlans(token?: string): Promise<BillingPlan[]> {
  const res = await fetchWithAuth("/billing/plans", {}, token);
  return res.json();
}

/** GET /billing/current */
export async function getCurrentBilling(token?: string): Promise<CurrentBilling> {
  const res = await fetchWithAuth("/billing/current", {}, token);
  return res.json();
}

/** POST /billing/upgrade */
export async function upgradePlan(
  plan: Plan,
  months: number,
  token?: string,
): Promise<UpgradePlanResponse> {
  const res = await fetchWithAuth(
    "/billing/upgrade",
    { method: "POST", body: JSON.stringify({ plan, months }) },
    token,
  );
  return res.json();
}

/** POST /billing/cancel */
export async function cancelPlan(token?: string): Promise<void> {
  await fetchWithAuth("/billing/cancel", { method: "POST" }, token);
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export type ExportFormat = "markdown" | "pdf";
export type ExportTaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";

export interface ExportTaskResponse {
  task_id: string;
}

export interface ExportStatusResponse {
  status: ExportTaskStatus;
  download_url?: string;
  error?: string;
}

/** POST /export/{format}/{noteId} → { task_id } */
export async function exportNote(
  format: ExportFormat,
  noteId: string,
  token?: string,
): Promise<ExportTaskResponse> {
  const res = await fetchWithAuth(
    `/export/${format}/${encodeURIComponent(noteId)}`,
    { method: "POST" },
    token,
  );
  return res.json();
}

/** GET /export/status/{taskId} */
export async function getExportStatus(
  taskId: string,
  token?: string,
): Promise<ExportStatusResponse> {
  const res = await fetchWithAuth(`/export/status/${encodeURIComponent(taskId)}`, {}, token);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Admin
// ────────────────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  plan_distribution: Record<string, number>;
  daily_usage: Array<{ date: string; count: number }>;
}

export interface AdminUser {
  id: string;
  email: string;
  plan: Plan;
  monthly_usage: MonthlyUsage;
  created_at: string;
}

/** GET /admin/stats */
export async function getAdminStats(token?: string): Promise<AdminStats> {
  const res = await fetchWithAuth("/admin/stats", {}, token);
  return res.json();
}

/** GET /admin/users */
export async function getAdminUsers(token?: string): Promise<AdminUser[]> {
  const res = await fetchWithAuth("/admin/users", {}, token);
  return res.json();
}

/** DELETE /admin/users/:id */
export async function deleteAdminUser(id: string, token?: string): Promise<void> {
  await fetchWithAuth(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }, token);
}
