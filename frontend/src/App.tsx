import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ApiState = {
  kind: "idle" | "success" | "error";
  message: string;
};

type Theme = "light" | "dark";

type User = {
  username: string;
  is_admin: boolean;
};

type ExamType = "JEE MAIN" | "JEE ADVANCED" | "OTHER";
type ExamFilter = "ALL" | ExamType;

type CatalogItem = {
  exam_id: string;
  name: string;
  exam_type: ExamType;
  description: string;
  duration: number;
  total_marks: number;
  total_questions: number;
  state: "DRAFT" | "PUBLISHED";
  created_at: string;
  updated_at: string;
};

type QuestionType = "MCQ" | "Descriptive";

type AnswerRow = {
  question_number: number;
  correct_answer: string;
  correct_score: number;
  incorrect_score: number;
  question_type: QuestionType;
  option_count: number;
};

type ExamQuestion = {
  exam_id: string;
  question_number: number;
  correct_score: number;
  incorrect_score: number;
  question_type: QuestionType;
  option_count: number;
};

type UploadForm = {
  name: string;
  exam_type: ExamType;
  description: string;
  duration: string;
  total_marks: string;
  total_questions: string;
};

type UploadResponse = {
  message: string;
  exam_id: string;
  answers: AnswerRow[];
};

type ReviewDraft = {
  name: string;
  answers: AnswerRow[];
};

const initialLogin = { username: "", password: "" };
const initialUploadForm: UploadForm = {
  name: "",
  exam_type: "JEE MAIN",
  description: "",
  duration: "180",
  total_marks: "300",
  total_questions: ""
};

const EXAM_TYPES: ExamType[] = ["JEE MAIN", "JEE ADVANCED", "OTHER"];

function normalizeExam(raw: unknown, index: number): CatalogItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  const examType = EXAM_TYPES.includes(r.exam_type as ExamType) ? (r.exam_type as ExamType) : "OTHER";
  const state = r.state === "DRAFT" || r.state === "PUBLISHED" ? r.state : "PUBLISHED";
  return {
    exam_id: String(r.exam_id ?? r.id ?? `exam-${index}`),
    name: String(r.name ?? "Untitled examination"),
    exam_type: examType,
    description: String(r.description ?? ""),
    duration: Number(r.duration) || 0,
    total_marks: Number(r.total_marks ?? r.marks) || 0,
    total_questions: Number(r.total_questions) || 0,
    state,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? "")
  };
}

function normalizeQuestion(raw: unknown): ExamQuestion | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const question_number = Number(r.question_number);
  const option_count = Number(r.option_count);
  if (!Number.isFinite(question_number) || question_number <= 0) return null;
  if (!Number.isFinite(option_count) || option_count <= 0) return null;
  const question_type: QuestionType = r.question_type === "Descriptive" ? "Descriptive" : "MCQ";
  return {
    exam_id: String(r.exam_id ?? ""),
    question_number,
    correct_score: Number(r.correct_score) || 0,
    incorrect_score: Number(r.incorrect_score) || 0,
    question_type,
    option_count
  };
}

function mcqOptions(count: number): string[] {
  const letters: string[] = [];
  const n = Math.min(Math.max(Math.floor(count) || 0, 0), 26);
  for (let i = 0; i < n; i++) letters.push(String.fromCharCode(65 + i));
  return letters;
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

async function readPayload(response: Response) {
  return (await response.json().catch(() => null)) as
    | { detail?: string; error?: string; message?: string }
    | null;
}

async function responseMessage(response: Response) {
  const body = await readPayload(response);
  return body?.detail ?? body?.error ?? body?.message ?? "The request could not be completed.";
}

function isCsv(file: File) {
  const csvMimeTypes = ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"];
  return (
    file.name.toLowerCase().endsWith(".csv") &&
    (!file.type || csvMimeTypes.includes(file.type) || file.type === "")
  );
}

function isPdf(file: File) {
  return (
    file.name.toLowerCase().endsWith(".pdf") &&
    (!file.type || file.type === "application/pdf" || file.type === "")
  );
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

async function parseCsvAnswers(file: File): Promise<AnswerRow[]> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error("CSV has no data rows. Expected header + at least one answer.");
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const numIdx = headers.indexOf("question_number");
  const ansIdx = headers.indexOf("correct_answer");
  const csIdx = headers.indexOf("correct_score");
  const isIdx = headers.indexOf("incorrect_score");
  const qtIdx = headers.indexOf("question_type");
  const ocIdx = headers.indexOf("option_count");
  const missing = [
    numIdx === -1 ? "question_number" : null,
    ansIdx === -1 ? "correct_answer" : null,
    csIdx === -1 ? "correct_score" : null,
    isIdx === -1 ? "incorrect_score" : null,
    qtIdx === -1 ? "question_type" : null,
    ocIdx === -1 ? "option_count" : null
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`CSV must contain columns: ${missing.join(", ")}.`);
  }
  return lines.slice(1).map((line, i) => {
    const cols = splitCsvLine(line);
    const label = `Row ${i + 2}`;
    const question_number = Number(cols[numIdx]);
    if (!Number.isFinite(question_number) || question_number <= 0) {
      throw new Error(`${label}: question_number must be a positive number.`);
    }
    const correct_answer = (cols[ansIdx] ?? "").trim();
    if (!correct_answer) {
      throw new Error(`${label}: correct_answer is required.`);
    }
    const correct_score = Number(cols[csIdx]);
    if (!Number.isFinite(correct_score)) {
      throw new Error(`${label}: correct_score must be a number.`);
    }
    const incorrect_score = Number(cols[isIdx]);
    if (!Number.isFinite(incorrect_score)) {
      throw new Error(`${label}: incorrect_score must be a number.`);
    }
    const rawType = (cols[qtIdx] ?? "").trim().toLowerCase();
    if (rawType !== "mcq" && rawType !== "descriptive") {
      throw new Error(`${label}: question_type must be MCQ or Descriptive.`);
    }
    const option_count = Number(cols[ocIdx]);
    if (!Number.isFinite(option_count) || option_count <= 0) {
      throw new Error(`${label}: option_count must be a positive number.`);
    }
    return {
      question_number,
      correct_answer,
      correct_score,
      incorrect_score,
      question_type: (rawType === "descriptive" ? "Descriptive" : "MCQ") as QuestionType,
      option_count
    };
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="theme-toggle"
      onClick={onToggle}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        {isDark ? (
          <path d="M12 4v2m0 12v2M4 12h2m12 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M7.7 16.3l-1.4 1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        ) : (
          <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />
        )}
      </svg>
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState<"checking" | "login" | "catalog" | "exam">("checking");
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  });
  const [login, setLogin] = useState(initialLogin);
  const [loginState, setLoginState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<CatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ExamFilter>("ALL");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(initialUploadForm);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [selectedCsv, setSelectedCsv] = useState<File | null>(null);
  const [dragTarget, setDragTarget] = useState<"pdf" | "csv" | null>(null);
  const [uploadState, setUploadState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [review, setReview] = useState<ReviewDraft | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [activeExam, setActiveExam] = useState<CatalogItem | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [candidateAnswers, setCandidateAnswers] = useState<Record<number, string>>({});
  const [examState, setExamState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isStarting, setIsStarting] = useState(false);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isUploadOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsUploadOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isUploadOpen]);

  useEffect(() => {
    if (screen !== "exam" || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, activeExam]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function loadSession() {
    setScreen("checking");

    try {
      const response = await fetch("/api/", { credentials: "include" });

      if (response.status === 401) {
        setUser(null);
        setScreen("login");
        return;
      }

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const identity = (await response.json()) as Partial<User> & { error?: string };
      if (identity.error || !identity.username) {
        setUser(null);
        setScreen("login");
        return;
      }
      setUser({ username: identity.username, is_admin: Boolean(identity.is_admin) });
      setScreen("catalog");
      void loadCatalog();
    } catch (error) {
      setLoginState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Backend is unreachable. Check that FastAPI is running."
      });
      setScreen("login");
    }
  }

  async function loadCatalog() {
    setIsCatalogLoading(true);
    setCatalogState({ kind: "idle", message: "" });

    try {
      const response = await fetch("/api/exam-list", { credentials: "include" });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const raw = (await response.json()) as unknown;
      const list = Array.isArray(raw) ? raw.map(normalizeExam) : [];
      setExams(list);
    } catch (error) {
      setCatalogState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to load the exam catalog."
      });
    } finally {
      setIsCatalogLoading(false);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setLoginState({ kind: "idle", message: "" });

    try {
      const response = await fetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(login)
      });

      const payload = await readPayload(response);
      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ?? payload?.detail ?? payload?.message ?? "Invalid credentials."
        );
      }

      setLogin(initialLogin);
      await loadSession();
    } catch (error) {
      setLoginState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to sign in."
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const response = await fetch("/api/signout", {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setUser(null);
      setExams([]);
      setQuery("");
      setTypeFilter("ALL");
      setSelectedExamId(null);
      setConfirmDeleteId(null);
      setPdfUrl(null);
      setActiveExam(null);
      setActiveAttemptId(null);
      setExamQuestions([]);
      setCandidateAnswers({});
      setExamState({ kind: "idle", message: "" });
      setScreen("login");
    } catch (error) {
      setCatalogState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to sign out."
      });
    } finally {
      setIsSigningOut(false);
    }
  }

  function openUpload() {
    setUploadForm(initialUploadForm);
    setSelectedPdf(null);
    setSelectedCsv(null);
    setUploadState({ kind: "idle", message: "" });
    setReview(null);
    setIsUploadOpen(true);
  }

  function closeUpload() {
    if (!isUploading && !isParsing) {
      setIsUploadOpen(false);
    }
  }

  function choosePdf(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isPdf(file)) {
      setUploadState({ kind: "error", message: "Select a PDF file for the question paper." });
      return;
    }

    setSelectedPdf(file);
    setUploadState({ kind: "idle", message: "" });
  }

  function chooseCsv(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isCsv(file)) {
      setUploadState({ kind: "error", message: "Select a CSV file for the answer key." });
      return;
    }

    setSelectedCsv(file);
    setUploadState({ kind: "idle", message: "" });
  }

  function handlePdfChange(event: ChangeEvent<HTMLInputElement>) {
    choosePdf(event.target.files?.[0]);
  }

  function handleCsvChange(event: ChangeEvent<HTMLInputElement>) {
    chooseCsv(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, target: "pdf" | "csv") {
    event.preventDefault();
    setDragTarget(null);
    const file = event.dataTransfer.files[0];
    if (target === "pdf") choosePdf(file);
    else chooseCsv(file);
  }

  function validateMetadata(): { duration: number; totalMarks: number; totalQuestions: number } | null {
    if (uploadForm.name.trim().length < 3) {
      setUploadState({ kind: "error", message: "Give the examination a name of at least 3 characters." });
      return null;
    }

    const duration = Number(uploadForm.duration);
    const totalMarks = Number(uploadForm.total_marks);
    const totalQuestions = Number(uploadForm.total_questions);

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(totalMarks) || totalMarks <= 0) {
      setUploadState({ kind: "error", message: "Duration and total marks must be positive numbers." });
      return null;
    }

    if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
      setUploadState({ kind: "error", message: "Total questions must be a positive number." });
      return null;
    }

    if (!selectedPdf) {
      setUploadState({ kind: "error", message: "Choose a PDF question paper before continuing." });
      return null;
    }

    if (!selectedCsv) {
      setUploadState({ kind: "error", message: "Choose a CSV answer key before continuing." });
      return null;
    }

    return { duration, totalMarks, totalQuestions };
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const meta = validateMetadata();
    if (!meta || !selectedCsv) {
      return;
    }

    setIsParsing(true);
    setUploadState({ kind: "idle", message: "" });

    try {
      const answers = await parseCsvAnswers(selectedCsv);
      setReview({ name: uploadForm.name.trim(), answers });
      setUploadForm((current) => ({ ...current, total_questions: String(answers.length) }));
      setUploadState({ kind: "success", message: "Answer key parsed. Review the answers before sealing." });
    } catch (error) {
      setUploadState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to parse this CSV."
      });
    } finally {
      setIsParsing(false);
    }
  }

  function updateAnswer(index: number, field: keyof AnswerRow, value: string) {
    setReview((current) => {
      if (!current) {
        return current;
      }

      const answers = current.answers.map((answer, answerIndex) => {
        if (answerIndex !== index) {
          return answer;
        }

        if (field === "question_number" || field === "option_count") {
          return { ...answer, [field]: Number(value) || 0 };
        }
        if (field === "correct_score" || field === "incorrect_score") {
          return { ...answer, [field]: value === "" || value === "-" ? 0 : Number(value) || 0 };
        }
        return { ...answer, [field]: value };
      });

      return { ...current, answers };
    });
  }

  async function submitReview() {
    if (!review || review.answers.length === 0) {
      setUploadState({ kind: "error", message: "At least one answer is required." });
      return;
    }

    const hasIncompleteAnswer = review.answers.some(
      (answer) =>
        !answer.question_number ||
        !answer.correct_answer.trim() ||
        !Number.isFinite(answer.correct_score) ||
        !Number.isFinite(answer.incorrect_score) ||
        (answer.question_type !== "MCQ" && answer.question_type !== "Descriptive") ||
        !answer.option_count ||
        answer.option_count <= 0
    );

    if (hasIncompleteAnswer) {
      setUploadState({ kind: "error", message: "Complete every answer row — scores, type and option count — before sealing." });
      return;
    }

    const meta = validateMetadata();
    if (!meta || !selectedPdf || !selectedCsv) {
      return;
    }

    if (meta.totalQuestions !== review.answers.length) {
      setUploadState({
        kind: "error",
        message: `Total questions (${meta.totalQuestions}) must match answer rows (${review.answers.length}).`
      });
      return;
    }

    setIsUploading(true);
    setUploadState({ kind: "idle", message: "" });

    const formData = new FormData();
    formData.append("exam_id", crypto.randomUUID());
    formData.append("name", uploadForm.name.trim());
    formData.append("exam_type", uploadForm.exam_type);
    formData.append("description", uploadForm.description.trim());
    formData.append("duration", String(meta.duration));
    formData.append("total_marks", String(meta.totalMarks));
    formData.append("total_questions", String(meta.totalQuestions));
    formData.append("exam_doc", selectedPdf, selectedPdf.name);
    formData.append("key_csv", selectedCsv, selectedCsv.name);

    try {
      const response = await fetch("/api/upload-exam", {
        method: "POST",
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      await response.json().catch(() => null);
      setUploadState({ kind: "success", message: "Examination sealed. It now appears in the catalogue." });
      setReview(null);
      setSelectedPdf(null);
      setSelectedCsv(null);
      setUploadForm(initialUploadForm);
      setIsUploadOpen(false);
      void loadCatalog();
    } catch (error) {
      setUploadState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to upload this examination."
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(examId: string) {
    setIsDeleting(true);
    setCatalogState({ kind: "idle", message: "" });

    try {
      const response = await fetch(`/api/delete-exam/${encodeURIComponent(examId)}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      setExams((current) => current.filter((exam) => exam.exam_id !== examId));
      setSelectedExamId(null);
      setConfirmDeleteId(null);
    } catch (error) {
      setCatalogState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to delete this paper."
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function exitExam() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setActiveExam(null);
    setActiveAttemptId(null);
    setExamQuestions([]);
    setCandidateAnswers({});
    setExamState({ kind: "idle", message: "" });
    setRemainingSeconds(0);
    setScreen("catalog");
  }

  async function handleBegin(exam: CatalogItem) {
    setIsStarting(true);
    setStartingExamId(exam.exam_id);
    setCatalogState({ kind: "idle", message: "" });

    try {
      const startResponse = await fetch(`/api/start-exam/${encodeURIComponent(exam.exam_id)}`, {
        credentials: "include"
      });

      if (!startResponse.ok) {
        throw new Error(await responseMessage(startResponse));
      }

      const startPayload = (await startResponse.json().catch(() => null)) as {
        attempt_id?: unknown;
      } | null;
      const attemptId =
        typeof startPayload?.attempt_id === "string" ? startPayload.attempt_id : "";
      if (!attemptId) {
        throw new Error("The server did not return an attempt. Please try starting again.");
      }

      const pdfResponse = await fetch(`/api/fetch_exam/${encodeURIComponent(attemptId)}`, {
        credentials: "include"
      });

      if (!pdfResponse.ok) {
        throw new Error(await responseMessage(pdfResponse));
      }

      const blob = await pdfResponse.blob();
      if (!blob.size) {
        throw new Error("The question paper came back empty. Ask your administrator to re-upload it.");
      }

      const questionsResponse = await fetch(`/api/question-list/${encodeURIComponent(attemptId)}`, {
        credentials: "include"
      });

      if (!questionsResponse.ok) {
        throw new Error(await responseMessage(questionsResponse));
      }

      const rawQuestions = (await questionsResponse.json()) as unknown;
      const questions = (Array.isArray(rawQuestions) ? rawQuestions : [])
        .map(normalizeQuestion)
        .filter((q): q is ExamQuestion => q !== null)
        .sort((a, b) => a.question_number - b.question_number);

      if (questions.length === 0) {
        throw new Error("No questions were returned for this paper. Ask your administrator to check the answer key.");
      }

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setActiveExam(exam);
      setActiveAttemptId(attemptId);
      setExamQuestions(questions);
      setCandidateAnswers({});
      setExamState({ kind: "idle", message: "" });
      setRemainingSeconds(Math.max(0, Math.floor(Number(exam.duration) || 0) * 60));
      setScreen("exam");
    } catch (error) {
      setCatalogState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to start this paper."
      });
    } finally {
      setIsStarting(false);
      setStartingExamId(null);
    }
  }

  function handleCandidateAnswer(questionNumber: number, value: string) {
    setCandidateAnswers((current) => ({ ...current, [questionNumber]: value }));
  }

  async function handleSubmitExam() {
    if (!activeExam || !activeAttemptId) return;

    const payload = examQuestions
      .filter((q) => (candidateAnswers[q.question_number] ?? "").trim().length > 0)
      .map((q) => ({
        question_number: q.question_number,
        answer: (candidateAnswers[q.question_number] ?? "").trim()
      }));

    if (payload.length === 0) {
      setExamState({ kind: "error", message: "Answer at least one question before submitting." });
      return;
    }

    setIsSubmitting(true);
    setExamState({ kind: "idle", message: "" });

    try {
      const response = await fetch(`/api/submit-exam/${encodeURIComponent(activeAttemptId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      setExamState({
        kind: "success",
        message: `Submitted ${payload.length} of ${examQuestions.length} answers. Your responses are sealed.`
      });
    } catch (error) {
      setExamState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to submit your answers."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter((exam) => {
      const matchesType = typeFilter === "ALL" || exam.exam_type === typeFilter;
      const matchesQuery =
        !q ||
        exam.name.toLowerCase().includes(q) ||
        exam.description.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [exams, query, typeFilter]);

  const stats = useMemo(
    () => ({
      total: exams.length,
      published: exams.filter((e) => e.state === "PUBLISHED").length,
      minutes: exams.reduce((sum, e) => sum + (Number(e.duration) || 0), 0)
    }),
    [exams]
  );

  if (screen === "checking") {
    return (
      <main className="app-loading" aria-label="Loading">
        <div className="loader-mark">
          <i />
          <span>Preparing catalogue</span>
        </div>
      </main>
    );
  }

  if (screen === "login") {
    return (
      <main className="login-page">
        <header className="topbar">
          <span className="wordmark">
            <i aria-hidden="true" />
            Test&nbsp;Taker
          </span>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
        </header>

        <div className="login-grid">
          <section className="login-manifesto" aria-labelledby="manifesto-title">
            <p className="eyebrow">
              <b>01</b> — Examination Hall
            </p>
            <h1 id="manifesto-title">
              Sit down.
              <br />
              Write well. <em>Prevail.</em>
            </h1>
            <p className="manifesto-sub">
              A composed space for serious assessment. Timed papers, clean typography,
              and nothing between you and the questions.
            </p>
            <dl className="manifesto-meta">
              <div>
                <dt>Format</dt>
                <dd>MCQ · Timed</dd>
              </div>
              <div>
                <dt>Authority</dt>
                <dd>Server-side clock</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>Private &amp; sealed</dd>
              </div>
            </dl>
          </section>

          <section className="login-panel" aria-labelledby="login-title">
            <div className="login-panel-inner">
              <div className="login-index">
                <strong id="login-title">Sign in</strong>
                <span>02 / Access</span>
              </div>

              <form onSubmit={handleSignIn}>
                <label className="field">
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    name="username"
                    placeholder="e.g. aarav.sharma"
                    required
                    value={login.username}
                    onChange={(event) => setLogin({ ...login, username: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    autoComplete="current-password"
                    name="password"
                    type="password"
                    placeholder="••••••••••"
                    required
                    value={login.password}
                    onChange={(event) => setLogin({ ...login, password: event.target.value })}
                  />
                </label>
                <button className="btn-ink btn-full" disabled={isSigningIn} type="submit">
                  {isSigningIn ? "Verifying…" : "Enter the hall →"}
                </button>
              </form>

              {loginState.message ? (
                <p className={`status ${loginState.kind}`} role="status">
                  {loginState.message}
                </p>
              ) : null}

              <p className="login-hint">
                No self-registration. Accounts are issued by your administrator.
                <br />
                Sessions expire on sign out.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (screen === "exam" && activeExam) {
    const answeredCount = examQuestions.filter(
      (q) => (candidateAnswers[q.question_number] ?? "").trim().length > 0
    ).length;
    const expired = remainingSeconds <= 0;

    return (
      <main className="exam-page">
        <header className="topbar">
          <span className="wordmark">
            <i aria-hidden="true" />
            Test&nbsp;Taker
          </span>
          <div className="account">
            <span className="account-name">
              <b>{user?.username}</b>
              {" · Candidate"}
            </span>
            <button className="link-btn" onClick={exitExam} type="button">
              Exit hall
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
          </div>
        </header>

        <div className="exam-inner">
          <section className="exam-head" aria-labelledby="exam-title">
            <div>
              <p className="eyebrow">
                <b>Examination</b> — {activeExam.exam_type}
              </p>
              <h1 id="exam-title">{activeExam.name}</h1>
              {activeExam.description ? <p className="hero-copy">{activeExam.description}</p> : null}
            </div>
            <dl className="hero-stats exam-counters">
              <div>
                <dt>Allowed</dt>
                <dd>{activeExam.duration}m</dd>
              </div>
              <div>
                <dt>Left</dt>
                <dd>{formatClock(remainingSeconds)}</dd>
              </div>
              <div>
                <dt>Answered</dt>
                <dd>
                  {pad(answeredCount)}/{pad(examQuestions.length)}
                </dd>
              </div>
              <div>
                <dt>Marks</dt>
                <dd>{activeExam.total_marks}</dd>
              </div>
            </dl>
          </section>

          {expired ? (
            <p className="status error" role="status">
              Time is up. Submit now — the server clock decides whether late answers are accepted.
            </p>
          ) : null}

          <div className="exam-grid">
            <article className="exam-paper" aria-label="Question paper">
              <div className="exam-paper-head">
                <span>Question paper</span>
                <span>Scrollable · PDF</span>
              </div>
              {pdfUrl ? (
                <iframe
                  className="exam-paper-frame"
                  src={pdfUrl}
                  title={`${activeExam.name} — question paper`}
                />
              ) : (
                <p className="eyebrow">Loading paper…</p>
              )}
            </article>

            <aside className="exam-side" aria-label="Answer sheet">
              <div className="exam-side-head">
                <p className="eyebrow">
                  <b>Sheet</b> — Answers
                </p>
                <span className="exam-side-count">
                  {answeredCount} of {examQuestions.length} answered
                </span>
              </div>

              <div className="answer-list">
                {examQuestions.map((question) => {
                  const value = candidateAnswers[question.question_number] ?? "";
                  return (
                    <article className="question-editor" key={question.question_number}>
                      <div className="question-editor-header">
                        <strong>Q{question.question_number}</strong>
                        <span className="row-kind" style={{ marginBottom: 0 }}>
                          {question.question_type}
                          {question.question_type === "MCQ" ? ` · ${question.option_count} opts` : ""}
                        </span>
                      </div>
                      <p className="answer-scores">
                        +{question.correct_score} · {question.incorrect_score}
                      </p>
                      {question.question_type === "MCQ" ? (
                        <div className="mcq-options" role="radiogroup" aria-label={`Answer for Q${question.question_number}`}>
                          {mcqOptions(question.option_count).map((letter) => (
                            <button
                              key={letter}
                              className={`mcq-option ${value === letter ? "selected" : ""}`}
                              onClick={() =>
                                handleCandidateAnswer(
                                  question.question_number,
                                  value === letter ? "" : letter
                                )
                              }
                              role="radio"
                              aria-checked={value === letter}
                              type="button"
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <label>
                          <span>Your answer</span>
                          <textarea
                            rows={3}
                            placeholder="Type your answer…"
                            value={value}
                            onChange={(event) =>
                              handleCandidateAnswer(question.question_number, event.target.value)
                            }
                          />
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>

              {examState.message ? (
                <p className={`status ${examState.kind}`} role="status">
                  {examState.message}
                </p>
              ) : null}

              <div className="exam-foot">
                <button className="link-btn" onClick={exitExam} type="button">
                  ← Catalogue
                </button>
                <button
                  className="btn-accent"
                  disabled={isSubmitting}
                  onClick={() => void handleSubmitExam()}
                  type="button"
                >
                  {isSubmitting ? "Submitting…" : "Submit answers"}
                </button>
              </div>
            </aside>
          </div>
        </div>

        <footer className="footer">
          <span>Test Taker — Examination Atelier</span>
          <span>Set in Fraunces &amp; Inter · MMXXVI</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="catalog-page">
      <header className="topbar">
        <span className="wordmark">
          <i aria-hidden="true" />
          Test&nbsp;Taker
        </span>
        <div className="account">
          <span className="account-name">
            <b>{user?.username}</b>
            {user?.is_admin ? " · Admin" : " · Candidate"}
          </span>
          <button
            className="link-btn"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            {isSigningOut ? "Signing out" : "Sign out"}
          </button>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
        </div>
      </header>

      <div className="catalog-inner">
        <section className="hero" aria-labelledby="catalog-title">
          <div>
            <p className="eyebrow">
              <b>Catalogue</b> — {new Date().getFullYear()} Session
            </p>
            <h1 id="catalog-title">
              Assessments, <em>composed</em> with intent.
            </h1>
            <p className="hero-copy">
              Each paper is timed by the server and sealed until you begin.
              Choose a paper below — the clock starts only when you confirm.
            </p>
          </div>
          <div className="hero-side">
            <dl className="hero-stats">
              <div>
                <dt>Papers</dt>
                <dd>{pad(stats.total)}</dd>
              </div>
              <div>
                <dt>Live</dt>
                <dd>{pad(stats.published)}</dd>
              </div>
              <div>
                <dt>Minutes</dt>
                <dd>{stats.minutes}</dd>
              </div>
            </dl>
            {user?.is_admin ? (
              <button className="btn-accent" onClick={openUpload} type="button">
                + Compose examination
              </button>
            ) : null}
          </div>
        </section>

        <section aria-live="polite">
          <div className="toolbar">
            <div className="toolbar-left">
              <label className="search-field">
                <span>Search papers</span>
                <input
                  placeholder="Type to filter…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>Series</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as ExamFilter)}
                >
                  <option value="ALL">All series</option>
                  <option value="JEE MAIN">JEE Main</option>
                  <option value="JEE ADVANCED">JEE Advanced</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>
            <button
              className="link-btn"
              disabled={isCatalogLoading}
              onClick={() => void loadCatalog()}
              type="button"
            >
              {isCatalogLoading ? "Refreshing…" : "Refresh ⟳"}
            </button>
          </div>

          {catalogState.message ? <p className="status error">{catalogState.message}</p> : null}
          {isCatalogLoading ? <p className="eyebrow">Loading papers…</p> : null}

          {!isCatalogLoading && !catalogState.message && filtered.length === 0 ? (
            <div className="empty">
              <p className="eyebrow">
                <b>∅</b> — Nothing filed
              </p>
              <h3>{exams.length === 0 ? "No papers on the desk." : "No papers match that filter."}</h3>
              <p>
                {exams.length === 0
                  ? "New examinations appear here as soon as they are published. Check back before your session."
                  : "Clear the search or choose a different series to see the full catalogue."}
              </p>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div className="exam-index">
              <div className="index-head" aria-hidden="true">
                <span>No.</span>
                <span>Paper</span>
                <span>Specification</span>
                <span>Action</span>
              </div>
              {filtered.map((exam, i) => {
                const isSelected = selectedExamId === exam.exam_id;
                const isConfirming = confirmDeleteId === exam.exam_id;
                return (
                  <article
                    className="exam-row"
                    key={exam.exam_id}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setSelectedExamId(isSelected ? null : exam.exam_id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="row-num">{pad(i + 1)}</span>
                    <div>
                      {user?.is_admin ? null : <span className="row-kind">{exam.exam_type}</span>}
                      {user?.is_admin ? (
                        <span className="row-kind">
                          {exam.exam_type} ·{" "}
                          <span className={`row-state ${exam.state.toLowerCase()}`}>{exam.state}</span>
                        </span>
                      ) : null}
                      <h3 className="row-title">{exam.name}</h3>
                      {exam.description ? <p className="row-desc">{exam.description}</p> : null}
                    </div>
                    <dl className="row-meta">
                      <div>
                        <dt>Time</dt>
                        <dd>{exam.duration} min</dd>
                      </div>
                      <div>
                        <dt>Marks</dt>
                        <dd>{exam.total_marks}</dd>
                      </div>
                      {exam.total_questions > 0 ? (
                        <div>
                          <dt>Questions</dt>
                          <dd>{exam.total_questions}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="row-action">
                      <button
                        className="begin-btn"
                        type="button"
                        disabled={isStarting && startingExamId === exam.exam_id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleBegin(exam);
                        }}
                      >
                        {isStarting && startingExamId === exam.exam_id ? (
                          <>Starting…</>
                        ) : (
                          <>
                            Begin <span className="arrow" aria-hidden="true">→</span>
                          </>
                        )}
                      </button>
                    </div>
                    {isSelected && user?.is_admin ? (
                      <div
                        style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", paddingTop: "16px" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {!isConfirming ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: "16px",
                              flexWrap: "wrap"
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "11px",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--muted)"
                              }}
                            >
                              {exam.exam_id}
                            </span>
                            <button
                              className="link-btn"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(exam.exam_id)}
                              type="button"
                            >
                              Delete paper
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "16px",
                              flexWrap: "wrap"
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "11px",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--muted)"
                              }}
                            >
                              Delete this paper permanently?
                            </span>
                            <div style={{ display: "flex", gap: "14px" }}>
                              <button
                                className="btn-line"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                                type="button"
                                style={{ minHeight: "42px", padding: "10px 16px" }}
                              >
                                Keep
                              </button>
                              <button
                                className="btn-ink"
                                disabled={isDeleting}
                                onClick={() => void handleDelete(exam.exam_id)}
                                type="button"
                                style={{ minHeight: "42px", padding: "10px 16px" }}
                              >
                                {isDeleting ? "Deleting…" : "Confirm delete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="footer">
        <span>Test Taker — Examination Atelier</span>
        <span>Set in Fraunces &amp; Inter · MMXXVI</span>
      </footer>

      {isUploadOpen ? (
        <div className="modal-backdrop" onMouseDown={closeUpload}>
          <section
            aria-labelledby="upload-title"
            aria-modal="true"
            className="upload-sheet"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="sheet-head">
              <div>
                <p className="eyebrow">
                  <b>{review ? "02" : "01"}</b> — {review ? "Review key" : "New examination"}
                </p>
                <h2 id="upload-title">{review ? "Review questions" : "Compose examination"}</h2>
                <div className="sheet-steps">
                  <span className={!review ? "active" : ""}>01 Metadata</span>
                  <span className={review ? "active" : ""}>02 Key</span>
                </div>
              </div>
              <button
                aria-label="Close upload dialog"
                className="link-btn"
                disabled={isUploading || isParsing}
                onClick={closeUpload}
                type="button"
              >
                Close ✕
              </button>
            </div>

            <div className="sheet-body">
              {!review ? (
                <form onSubmit={handleUpload}>
                  <div className="upload-fields">
                    <label className="wide-field">
                      <span>Paper title</span>
                      <input
                        maxLength={100}
                        minLength={3}
                        required
                        placeholder="e.g. JEE Main — Mock 07"
                        value={uploadForm.name}
                        onChange={(event) => setUploadForm({ ...uploadForm, name: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Series</span>
                      <select
                        value={uploadForm.exam_type}
                        onChange={(event) =>
                          setUploadForm({ ...uploadForm, exam_type: event.target.value as ExamType })
                        }
                      >
                        <option value="JEE MAIN">JEE MAIN</option>
                        <option value="JEE ADVANCED">JEE ADVANCED</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </label>
                    <label>
                      <span>Duration · minutes</span>
                      <input
                        min="1"
                        required
                        type="number"
                        value={uploadForm.duration}
                        onChange={(event) => setUploadForm({ ...uploadForm, duration: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Total marks</span>
                      <input
                        min="1"
                        required
                        type="number"
                        value={uploadForm.total_marks}
                        onChange={(event) => setUploadForm({ ...uploadForm, total_marks: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Total questions</span>
                      <input
                        min="1"
                        required
                        type="number"
                        placeholder="e.g. 30"
                        value={uploadForm.total_questions}
                        onChange={(event) => setUploadForm({ ...uploadForm, total_questions: event.target.value })}
                      />
                    </label>
                    <label className="wide-field">
                      <span>Brief</span>
                      <textarea
                        maxLength={500}
                        rows={3}
                        placeholder="One or two lines on syllabus, scope, and intent."
                        value={uploadForm.description}
                        onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })}
                      />
                    </label>
                  </div>

                  <input
                    accept=".pdf,application/pdf"
                    className="visually-hidden"
                    onChange={handlePdfChange}
                    ref={pdfInputRef}
                    type="file"
                  />
                  <input
                    accept=".csv,text/csv"
                    className="visually-hidden"
                    onChange={handleCsvChange}
                    ref={csvInputRef}
                    type="file"
                  />
                  <button
                    className={`drop-zone ${dragTarget === "pdf" ? "dragging" : ""}`}
                    onClick={() => pdfInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragTarget("pdf");
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, "pdf")}
                    type="button"
                  >
                    <span className="drop-zone-label">
                      {selectedPdf ? selectedPdf.name : "Drop the question paper here"}
                    </span>
                    <span className="drop-zone-sub">
                      {selectedPdf ? "Click to replace · PDF only" : "PDF only · or click to browse"}
                    </span>
                  </button>
                  <button
                    className={`drop-zone ${dragTarget === "csv" ? "dragging" : ""}`}
                    onClick={() => csvInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragTarget("csv");
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, "csv")}
                    type="button"
                    style={{ marginTop: "14px" }}
                  >
                    <span className="drop-zone-label">
                      {selectedCsv ? selectedCsv.name : "Drop the answer key here"}
                    </span>
                    <span className="drop-zone-sub">
                      {selectedCsv
                        ? "Click to replace · CSV only"
                        : "CSV only · number, answer, scores, type, options"}
                    </span>
                  </button>

                  {uploadState.message ? (
                    <p className={`status ${uploadState.kind}`} role="status">
                      {uploadState.message}
                    </p>
                  ) : null}
                  <div className="sheet-actions">
                    <button className="btn-line" onClick={closeUpload} type="button">
                      Cancel
                    </button>
                    <button className="btn-ink" disabled={isParsing || isUploading} type="submit">
                      {isParsing ? "Parsing…" : "Parse & review →"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="review-summary">
                    {review.name} <span>{review.answers.length} answers</span>
                  </p>
                  <div className="question-list">
                    {review.answers.map((answer, index) => (
                      <article className="question-editor" key={`${answer.question_number}-${index}`}>
                        <div className="question-editor-header">
                          <strong>Q{index + 1}</strong>
                          <label>
                            <span>No.</span>
                            <input
                              min="1"
                              type="number"
                              value={answer.question_number}
                              onChange={(event) => updateAnswer(index, "question_number", event.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          <span>Correct answer</span>
                          <input
                            value={answer.correct_answer}
                            onChange={(event) => updateAnswer(index, "correct_answer", event.target.value)}
                          />
                        </label>
                        <div className="upload-fields" style={{ gap: "16px" }}>
                          <label>
                            <span>Correct score</span>
                            <input
                              type="number"
                              value={answer.correct_score}
                              onChange={(event) => updateAnswer(index, "correct_score", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Incorrect score</span>
                            <input
                              type="number"
                              value={answer.incorrect_score}
                              onChange={(event) => updateAnswer(index, "incorrect_score", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Type</span>
                            <select
                              value={answer.question_type}
                              onChange={(event) => updateAnswer(index, "question_type", event.target.value)}
                            >
                              <option value="MCQ">MCQ</option>
                              <option value="Descriptive">Descriptive</option>
                            </select>
                          </label>
                          <label>
                            <span>Option count</span>
                            <input
                              min="1"
                              type="number"
                              value={answer.option_count}
                              onChange={(event) => updateAnswer(index, "option_count", event.target.value)}
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  {uploadState.message ? (
                    <p className={`status ${uploadState.kind}`} role="status">
                      {uploadState.message}
                    </p>
                  ) : null}
                  <div className="sheet-actions">
                    <button className="btn-line" onClick={() => setReview(null)} type="button">
                      ← Back
                    </button>
                    <button
                      className="btn-accent"
                      disabled={isUploading}
                      onClick={() => void submitReview()}
                      type="button"
                    >
                      {isUploading ? "Sealing…" : "Seal examination"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
