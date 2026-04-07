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

// ── Survey API ─────────────────────────────────────

export interface SurveyQuestion {
  id: string;
  paper_id: string;
  original_q: string;
  adapted_q: string;
  source_title: string | null;
  source_page: number | null;
  year: number | null;
  created_at: string | null;
}

export interface SurveyListResult {
  survey_questions: SurveyQuestion[];
  total: number;
}

export interface SurveyGenerateResult {
  task_id: string;
  message: string;
  paper_id: string;
}

export async function generateSurvey(
  paperId: string,
  token: string,
): Promise<SurveyGenerateResult> {
  return apiFetch<SurveyGenerateResult>("/api/survey/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paper_id: paperId }),
  });
}

export async function listSurveyQuestions(
  token: string,
  paperId?: string,
  limit = 20,
  offset = 0,
): Promise<SurveyListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (paperId) params.set("paper_id", paperId);

  return apiFetch<SurveyListResult>(`/api/survey?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSurveyQuestion(
  id: string,
  token: string,
): Promise<SurveyQuestion> {
  return apiFetch<SurveyQuestion>(`/api/survey/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Diagnosis API ──────────────────────────────────

export interface Diagnosis {
  id: string;
  paper_id: string;
  overall_score: number;
  section_scores: Record<string, number>;
  feedback: string;
  created_at: string | null;
}

export interface DiagnosisListResult {
  diagnoses: Diagnosis[];
  total: number;
}

export interface DiagnoseRunResult {
  task_id: string;
  message: string;
}

export async function runDiagnosis(
  paperId: string,
  token: string,
): Promise<DiagnoseRunResult> {
  return apiFetch<DiagnoseRunResult>("/api/diagnosis/run", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paper_id: paperId }),
  });
}

export async function listDiagnoses(
  token: string,
  paperId?: string,
  limit = 20,
  offset = 0,
): Promise<DiagnosisListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (paperId) params.set("paper_id", paperId);

  return apiFetch<DiagnosisListResult>(`/api/diagnosis?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDiagnosis(
  id: string,
  token: string,
): Promise<Diagnosis> {
  return apiFetch<Diagnosis>(`/api/diagnosis/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Share API ──────────────────────────────────────

export interface PaperShareCard {
  title: string;
  abstract_summary: string;
  authors: string[];
  keywords: string[];
  published_at: string | null;
  share_url: string;
}

export interface DiagnosisShareCard {
  paper_title: string;
  overall_score: number;
  section_scores: Record<string, number>;
  created_at: string | null;
  share_url: string;
}

export async function getPaperShareCard(
  paperId: string,
): Promise<PaperShareCard> {
  return apiFetch<PaperShareCard>(`/api/share/paper/${paperId}`);
}

export async function getDiagnosisShareCard(
  diagnosisId: string,
): Promise<DiagnosisShareCard> {
  return apiFetch<DiagnosisShareCard>(`/api/share/diagnosis/${diagnosisId}`);
}

// ── Versions API ──────────────────────────────────

export interface PaperVersion {
  id: string;
  user_id: string;
  content: Record<string, unknown>;
  save_type: string;
  created_at: string | null;
}

export interface PaperVersionListResult {
  versions: PaperVersion[];
  total: number;
}

export async function saveVersion(
  content: Record<string, unknown>,
  saveType: string,
  token: string,
): Promise<PaperVersion> {
  return apiFetch<PaperVersion>("/api/versions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, save_type: saveType }),
  });
}

export async function listVersions(
  token: string,
  limit = 20,
  offset = 0,
): Promise<PaperVersionListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiFetch<PaperVersionListResult>(`/api/versions?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getVersion(
  id: string,
  token: string,
): Promise<PaperVersion> {
  return apiFetch<PaperVersion>(`/api/versions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteVersion(
  id: string,
  token: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/versions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Notes API ─────────────────────────────────────

export interface ResearchNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string | null;
}

export interface NoteListResult {
  notes: ResearchNote[];
  total: number;
}

export interface NoteToDraftResult {
  task_id: string;
  message: string;
}

export async function createNote(
  content: string,
  token: string,
): Promise<ResearchNote> {
  return apiFetch<ResearchNote>("/api/notes", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
}

export async function listNotes(
  token: string,
  limit = 20,
  offset = 0,
): Promise<NoteListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiFetch<NoteListResult>(`/api/notes?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getNote(
  id: string,
  token: string,
): Promise<ResearchNote> {
  return apiFetch<ResearchNote>(`/api/notes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateNote(
  id: string,
  content: string,
  token: string,
): Promise<ResearchNote> {
  return apiFetch<ResearchNote>(`/api/notes/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
}

export async function deleteNote(
  id: string,
  token: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/notes/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function noteToDraft(
  noteId: string,
  token: string,
): Promise<NoteToDraftResult> {
  return apiFetch<NoteToDraftResult>("/api/notes/to-draft", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note_id: noteId }),
  });
}

// ── References API ────────────────────────────────

export interface Reference {
  id: string;
  user_id: string;
  paper_id: string | null;
  title: string;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  citation_text: string | null;
  memo: string | null;
  created_at: string | null;
}

export interface ReferenceListResult {
  references: Reference[];
  total: number;
}

export interface ReferenceCreateData {
  title: string;
  authors?: string | null;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  citation_text?: string | null;
  memo?: string | null;
  paper_id?: string | null;
}

export interface ReferenceUpdateData {
  title?: string | null;
  authors?: string | null;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  citation_text?: string | null;
  memo?: string | null;
}

export async function createReference(
  data: ReferenceCreateData,
  token: string,
): Promise<Reference> {
  return apiFetch<Reference>("/api/references", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function listReferences(
  token: string,
  paperId?: string,
  limit = 20,
  offset = 0,
): Promise<ReferenceListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (paperId) params.set("paper_id", paperId);

  return apiFetch<ReferenceListResult>(`/api/references?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getReference(
  id: string,
  token: string,
): Promise<Reference> {
  return apiFetch<Reference>(`/api/references/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateReference(
  id: string,
  data: ReferenceUpdateData,
  token: string,
): Promise<Reference> {
  return apiFetch<Reference>(`/api/references/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteReference(
  id: string,
  token: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/references/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function extractReferences(
  paperId: string,
  token: string,
): Promise<{ task_id: string; message: string }> {
  return apiFetch<{ task_id: string; message: string }>("/api/references/extract", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paper_id: paperId }),
  });
}

// ── Research Gaps API ─────────────────────────────

export interface ResearchGapAnalysis {
  gaps: Array<Record<string, unknown>>;
  connections: Array<Record<string, unknown>>;
  suggestions: string[];
}

export async function analyzeResearchGaps(
  paperIds: string[],
  token: string,
): Promise<{ task_id: string; message: string }> {
  return apiFetch<{ task_id: string; message: string }>("/api/research-gaps/analyze", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paper_ids: paperIds }),
  });
}

export async function getResearchGapResult(
  taskId: string,
  token: string,
): Promise<ResearchGapAnalysis | { status: string; detail?: string }> {
  return apiFetch<ResearchGapAnalysis | { status: string; detail?: string }>(
    `/api/research-gaps/result/${taskId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
