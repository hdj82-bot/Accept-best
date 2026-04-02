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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * POST /papers/search
 * Returns paginated papers sorted by similarity score descending.
 */
export async function searchPapers(
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 10,
  token?: string,
): Promise<PaginatedResult<Paper>> {
  const body: Record<string, unknown> = { query, page, limit };
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

// ────────────────────────────────────────────────────────────────────────────
// Bookmarks
// ────────────────────────────────────────────────────────────────────────────

export interface Bookmark {
  id: string;
  user_id: string;
  paper_id: string;
  paper: Paper;
  created_at: string;
}

/** GET /bookmarks/ */
export async function getBookmarks(token?: string): Promise<Bookmark[]> {
  const res = await fetchWithAuth("/bookmarks/", {}, token);
  return res.json();
}

/** POST /bookmarks/ */
export async function addBookmark(paperId: string, token?: string): Promise<Bookmark> {
  const res = await fetchWithAuth(
    "/bookmarks/",
    { method: "POST", body: JSON.stringify({ paper_id: paperId }) },
    token,
  );
  return res.json();
}

/** DELETE /bookmarks/:paperId */
export async function removeBookmark(paperId: string, token?: string): Promise<void> {
  await fetchWithAuth(
    `/bookmarks/${encodeURIComponent(paperId)}`,
    { method: "DELETE" },
    token,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Search history
// ────────────────────────────────────────────────────────────────────────────

export interface SearchHistoryItem {
  id: string;
  query: string;
  created_at: string;
}

/** GET /search/history */
export async function getSearchHistory(token?: string): Promise<SearchHistoryItem[]> {
  const res = await fetchWithAuth("/search/history", {}, token);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Payment (PortOne / 아임포트)
// ────────────────────────────────────────────────────────────────────────────

export interface PreparePaymentResponse {
  merchant_uid: string;
  amount: number;
}

export interface CompletePaymentResponse {
  success: boolean;
  plan: Plan;
  expires_at: string;
  message: string;
}

export interface PaymentHistoryItem {
  id: string;
  merchant_uid: string;
  imp_uid: string;
  amount: number;
  plan: Plan;
  status: "paid" | "failed" | "cancelled";
  created_at: string;
}

/** POST /payment/prepare */
export async function preparePayment(
  plan: Plan,
  months: number,
  token?: string,
): Promise<PreparePaymentResponse> {
  const res = await fetchWithAuth(
    "/payment/prepare",
    { method: "POST", body: JSON.stringify({ plan, months }) },
    token,
  );
  return res.json();
}

/** POST /payment/complete */
export async function completePayment(
  imp_uid: string,
  merchant_uid: string,
  token?: string,
): Promise<CompletePaymentResponse> {
  const res = await fetchWithAuth(
    "/payment/complete",
    { method: "POST", body: JSON.stringify({ imp_uid, merchant_uid }) },
    token,
  );
  return res.json();
}

/** GET /payment/history */
export async function getPaymentHistory(token?: string): Promise<PaymentHistoryItem[]> {
  const res = await fetchWithAuth("/payment/history", {}, token);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Collections
// ────────────────────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  color: string;          // hex color e.g. "#4F46E5"
  paper_count: number;
  created_at: string;
}

export interface CreateCollectionData {
  name: string;
  color: string;
}

/** GET /collections/ */
export async function getCollections(token?: string): Promise<Collection[]> {
  const res = await fetchWithAuth("/collections/", {}, token);
  return res.json();
}

/** POST /collections/ */
export async function createCollection(
  data: CreateCollectionData,
  token?: string,
): Promise<Collection> {
  const res = await fetchWithAuth(
    "/collections/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
  return res.json();
}

/** DELETE /collections/:id */
export async function deleteCollection(id: string, token?: string): Promise<void> {
  await fetchWithAuth(`/collections/${encodeURIComponent(id)}`, { method: "DELETE" }, token);
}

/** POST /collections/:collectionId/papers/:paperId */
export async function addPaperToCollection(
  collectionId: string,
  paperId: string,
  token?: string,
): Promise<void> {
  await fetchWithAuth(
    `/collections/${encodeURIComponent(collectionId)}/papers/${encodeURIComponent(paperId)}`,
    { method: "POST" },
    token,
  );
}

/** DELETE /collections/:collectionId/papers/:paperId */
export async function removePaperFromCollection(
  collectionId: string,
  paperId: string,
  token?: string,
): Promise<void> {
  await fetchWithAuth(
    `/collections/${encodeURIComponent(collectionId)}/papers/${encodeURIComponent(paperId)}`,
    { method: "DELETE" },
    token,
  );
}

/** GET /collections/:collectionId/papers */
export async function getCollectionPapers(
  collectionId: string,
  token?: string,
): Promise<Paper[]> {
  const res = await fetchWithAuth(
    `/collections/${encodeURIComponent(collectionId)}/papers`,
    {},
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Tags
// ────────────────────────────────────────────────────────────────────────────

export interface PaperTag {
  id: string;
  paper_id: string;
  user_id: string;
  tag: string;
  created_at: string;
}

export interface TagWithCount {
  tag: string;
  count: number;
}

/** GET /tags/ — all tags used by this user with counts */
export async function getTags(token?: string): Promise<TagWithCount[]> {
  const res = await fetchWithAuth("/tags/", {}, token);
  return res.json();
}

/** GET /tags/:tag/papers */
export async function getPapersByTag(tag: string, token?: string): Promise<Paper[]> {
  const res = await fetchWithAuth(`/tags/${encodeURIComponent(tag)}/papers`, {}, token);
  return res.json();
}

/** POST /tags/ */
export async function addTag(
  paperId: string,
  tag: string,
  token?: string,
): Promise<PaperTag> {
  const res = await fetchWithAuth(
    "/tags/",
    { method: "POST", body: JSON.stringify({ paper_id: paperId, tag }) },
    token,
  );
  return res.json();
}

/** DELETE /tags/:paperId/:tag */
export async function removeTag(
  paperId: string,
  tag: string,
  token?: string,
): Promise<void> {
  await fetchWithAuth(
    `/tags/${encodeURIComponent(paperId)}/${encodeURIComponent(tag)}`,
    { method: "DELETE" },
    token,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OG meta (server-side fetch for generateMetadata)
// ────────────────────────────────────────────────────────────────────────────

export interface OgMeta {
  title: string | null;
  description: string | null;
  owner_name: string | null;
  created_at: string;
}

/**
 * GET /meta/og/:token — public, no auth.
 * Called server-side in generateMetadata; uses plain fetch.
 */
export async function getOgMeta(shareToken: string): Promise<OgMeta> {
  const url = `${BASE_URL}/meta/og/${encodeURIComponent(shareToken)}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 3600 },   // cache for 1 hour (Next.js fetch cache)
  });
  if (!res.ok) throw new Error(`OG meta fetch failed: ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Share tokens
// ────────────────────────────────────────────────────────────────────────────

export interface ShareToken {
  id: string;
  token: string;
  note_id: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SharedNote {
  note: ResearchNote;
  papers: Paper[];
  owner_name: string | null;
  share_token: ShareToken;
}

/** POST /share/ — create a share token for a note */
export async function createShareToken(
  noteId: string,
  expiresInDays?: number,
  token?: string,
): Promise<ShareToken> {
  const body: Record<string, unknown> = { note_id: noteId };
  if (expiresInDays !== undefined) body.expires_in_days = expiresInDays;
  const res = await fetchWithAuth(
    "/share/",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
  return res.json();
}

/**
 * GET /share/:token — public endpoint, no auth required.
 * Uses plain fetch to avoid requiring a session.
 */
export async function getSharedNote(shareToken: string): Promise<SharedNote> {
  const url = `${BASE_URL}/share/${encodeURIComponent(shareToken)}`;
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const body = await res.clone().json();
      code = body.error ?? code;
      message = body.message ?? message;
    } catch { /* ignore */ }
    throw new ApiError(res.status, code, message);
  }
  return res.json();
}

/** DELETE /share/:token — revoke a share token */
export async function revokeShareToken(shareToken: string, token?: string): Promise<void> {
  await fetchWithAuth(`/share/${encodeURIComponent(shareToken)}`, { method: "DELETE" }, token);
}

/** GET /share/ — list the current user's share tokens */
export async function getMyShareTokens(token?: string): Promise<ShareToken[]> {
  const res = await fetchWithAuth("/share/", {}, token);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// User profile update
// ────────────────────────────────────────────────────────────────────────────

/** PATCH /users/me */
export async function updateMe(data: { name?: string }, token?: string): Promise<User> {
  const res = await fetchWithAuth(
    "/users/me",
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Paper health check
// ────────────────────────────────────────────────────────────────────────────

export interface CheckupResult {
  scores: {
    structure: number;
    clarity: number;
    originality: number;
    overall: number;
  };
  summary: string;
  strengths: string[];
  suggestions: string[];
}

/** POST /research/:noteId/checkup */
export async function checkupNote(noteId: string, token?: string): Promise<CheckupResult> {
  const res = await fetchWithAuth(
    `/research/${encodeURIComponent(noteId)}/checkup`,
    { method: "POST" },
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Gap analysis
// ────────────────────────────────────────────────────────────────────────────

export interface GapItem {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
}

export interface GapAnalysisResult {
  summary: string;
  gaps: GapItem[];
  opportunities: string[];
  paper_count: number;
  fixture?: boolean;
}

/** POST /research/:noteId/gap-analysis */
export async function analyzeGap(
  noteId: string,
  token?: string,
): Promise<GapAnalysisResult> {
  const res = await fetchWithAuth(
    `/research/${encodeURIComponent(noteId)}/gap-analysis`,
    { method: "POST" },
    token,
  );
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// References
// ────────────────────────────────────────────────────────────────────────────

export interface Reference {
  id: string;
  user_id: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  doi: string | null;
  cite_key: string | null;
  created_at: string;
}

export interface CreateReferenceData {
  title: string;
  authors?: string[];
  journal?: string;
  year?: number;
  doi?: string;
  cite_key?: string;
}

/** GET /refs/ */
export async function getReferences(token?: string): Promise<Reference[]> {
  const res = await fetchWithAuth("/refs/", {}, token);
  return res.json();
}

/** POST /refs/ */
export async function createReference(
  data: CreateReferenceData,
  token?: string,
): Promise<Reference> {
  const res = await fetchWithAuth(
    "/refs/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
  return res.json();
}

/** PATCH /refs/:id */
export async function updateReference(
  id: string,
  data: Partial<CreateReferenceData>,
  token?: string,
): Promise<Reference> {
  const res = await fetchWithAuth(
    `/refs/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );
  return res.json();
}

/** DELETE /refs/:id */
export async function deleteReference(id: string, token?: string): Promise<void> {
  await fetchWithAuth(`/refs/${encodeURIComponent(id)}`, { method: "DELETE" }, token);
}

/** GET /refs/export/bibtex → plain text */
export async function exportBibtex(token?: string): Promise<string> {
  const res = await fetchWithAuth("/refs/export/bibtex", {}, token);
  return res.text();
}
