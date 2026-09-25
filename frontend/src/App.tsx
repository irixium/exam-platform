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
};

type QuestionType = "MCQ" | "Descriptive";

type AnswerRow = {
  question_number: number;
  correct_answer: string;
  correct_score: number;
  incorrect_score: number;
  question_type: QuestionType;
  option_count: number | null;
};

type ExamQuestion = {
  question_number: number;
  correct_score: number;
  incorrect_score: number;
  question_type: QuestionType;
  option_count: number | null;
};

type UploadForm = {
  name: string;
  exam_type: ExamType;
  description: string;
  duration: string;
  total_marks: string;
  total_questions: string;
};

type ReviewDraft = {
  name: string;
  answers: AnswerRow[];
};

type EvaluationStatus = "pending" | "evaluated";

type ExamResult = {
  username: string;
  attempt_id: string;
  exam_id: string;
  name: string;
  exam_type: string;
  description: string;
  duration: number;
  total_marks: number;
  total_questions: number;
  score: number;
  submission_time: number;
  evaluation_status: EvaluationStatus;
};

type ExamQuestionResult = {
  question_number: number;
  answer: string | null;
  correct_answer: string;
  correct_score: number;
  incorrect_score: number;
  question_type: string;
  option_count: number | null;
  score: number;
  is_correct: boolean;
  is_attempted: boolean;
};

type DetailedExamResult = ExamResult & {
  question_results: ExamQuestionResult[];
};

type ResultsView = "mine" | "all";

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
  return {
    exam_id: String(r.exam_id ?? r.id ?? `exam-${index}`),
    name: String(r.name ?? "Untitled examination"),
    exam_type: examType,
    description: String(r.description ?? ""),
    duration: Number(r.duration) || 0,
    total_marks: Number(r.total_marks ?? r.marks) || 0,
    total_questions: Number(r.total_questions) || 0
  };
}

function normalizeQuestion(raw: unknown): ExamQuestion | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const question_number = Number(r.question_number);
  if (!Number.isFinite(question_number) || question_number <= 0) return null;
  const question_type: QuestionType = r.question_type === "Descriptive" ? "Descriptive" : "MCQ";
  const rawOption = r.option_count;
  const option_count =
    rawOption === null || rawOption === undefined || rawOption === ""
      ? null
      : Number(rawOption);
  if (question_type === "MCQ") {
    if (!Number.isFinite(option_count as number) || (option_count as number) < 1 || (option_count as number) > 4) return null;
  } else if (option_count !== null && (!Number.isFinite(option_count) || option_count <= 0)) {
    return null;
  }
  return {
    question_number,
    correct_score: Number(r.correct_score) || 0,
    incorrect_score: Number(r.incorrect_score) || 0,
    question_type,
    option_count
  };
}

function mcqOptions(count: number | null): string[] {
  const letters: string[] = [];
  const n = Math.min(Math.max(Math.floor(count ?? 0) || 0, 0), 26);
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

function normalizeResult(raw: unknown): ExamResult | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const attempt_id = String(r.attempt_id ?? "");
  const exam_id = String(r.exam_id ?? "");
  if (!attempt_id || !exam_id) return null;
  // Backend may (temporarily) send the misspelled `evaluation_staus` — accept it.
  const rawStatus = r.evaluation_status ?? r.evaluation_staus;
  const evaluation_status: EvaluationStatus = rawStatus === "pending" ? "pending" : "evaluated";
  return {
    username: String(r.username ?? ""),
    attempt_id,
    exam_id,
    name: String(r.name ?? "Untitled examination"),
    exam_type: String(r.exam_type ?? "OTHER"),
    description: String(r.description ?? ""),
    duration: Number(r.duration) || 0,
    total_marks: Number(r.total_marks) || 0,
    total_questions: Number(r.total_questions) || 0,
    score: Number(r.score) || 0,
    submission_time: Number(r.submission_time) || 0,
    evaluation_status
  };
}

function normalizeResultDetail(raw: unknown): DetailedExamResult | null {
  const base = normalizeResult(raw);
  if (!base) return null;
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.question_results) ? r.question_results : [];
  const question_results: ExamQuestionResult[] = list
    .map((item) => {
      const q = (item ?? {}) as Record<string, unknown>;
      const question_number = Number(q.question_number);
      if (!Number.isFinite(question_number) || question_number <= 0) return null;
      const rawAnswer = q.answer;
      return {
        question_number,
        answer: rawAnswer === null || rawAnswer === undefined ? null : String(rawAnswer),
        correct_answer: String(q.correct_answer ?? ""),
        correct_score: Number(q.correct_score) || 0,
        incorrect_score: Number(q.incorrect_score) || 0,
        question_type: String(q.question_type ?? "MCQ"),
        option_count:
          q.option_count === null || q.option_count === undefined || q.option_count === ""
            ? null
            : Number(q.option_count),
        score: Number(q.score) || 0,
        is_correct: q.is_correct === true || q.is_correct === 1,
        is_attempted: q.is_attempted === true || q.is_attempted === 1
      } as ExamQuestionResult;
    })
    .filter((q): q is ExamQuestionResult => q !== null)
    .sort((a, b) => a.question_number - b.question_number);
  return { ...base, question_results };
}

function formatDateTime(epochSeconds: number) {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return "—";
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  // The answer file must include the option_count column:
  // required 1-4 for MCQ rows, blank for Descriptive.
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
    const isMcq = rawType === "mcq";
    const rawOption = (cols[ocIdx] ?? "").trim();
    let option_count: number | null = null;
    if (isMcq) {
      option_count = Number(rawOption);
      if (!Number.isInteger(option_count) || option_count < 1 || option_count > 4) {
        throw new Error(`${label}: option_count must be an integer between 1 and 4 for MCQ.`);
      }
    } else if (rawOption !== "") {
      throw new Error(`${label}: option_count must be left blank for Descriptive.`);
    }
    return {
      question_number,
      correct_answer,
      correct_score,
      incorrect_score,
      question_type: (isMcq ? "MCQ" : "Descriptive") as QuestionType,
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
  const [screen, setScreen] = useState<"checking" | "login" | "catalog" | "exam" | "results" | "result-detail">("checking");
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
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
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
  const [editExam, setEditExam] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", exam_type: "JEE MAIN" as ExamType, description: "", duration: "" });
  const [editAnswers, setEditAnswers] = useState<AnswerRow[]>([]);
  const [editState, setEditState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
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
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const autoSubmitFiredRef = useRef(false);
  const candidateAnswersRef = useRef<Record<number, string>>({});
  candidateAnswersRef.current = candidateAnswers;
  const examQuestionsRef = useRef<ExamQuestion[]>([]);
  examQuestionsRef.current = examQuestions;
  const [results, setResults] = useState<ExamResult[]>([]);
  const [resultsState, setResultsState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [resultsView, setResultsView] = useState<ResultsView>("mine");
  const [lastSubmittedAttemptId, setLastSubmittedAttemptId] = useState<string | null>(null);
  const [resultDetail, setResultDetail] = useState<DetailedExamResult | null>(null);
  const [resultDetailState, setResultDetailState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isResultDetailLoading, setIsResultDetailLoading] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [resultPdfState, setResultPdfState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isResultPdfLoading, setIsResultPdfLoading] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isUploadOpen && !editExam) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isUploadOpen) setIsUploadOpen(false);
        if (editExam) setEditExam(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isUploadOpen, editExam]);

  useEffect(() => {
    if (screen !== "exam") return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, activeAttemptId]);

  useEffect(() => {
    if (screen !== "exam") return;
    if (remainingSeconds > 0) return;
    if (!activeAttemptId) return;
    if (autoSubmitFiredRef.current) return;
    if (isSubmitting) return;
    // Manual submit already succeeded for this attempt — nothing to auto-submit.
    if (examState.kind === "success" && lastSubmittedAttemptId === activeAttemptId) return;
    autoSubmitFiredRef.current = true;
    void handleSubmitExam(true);
  }, [screen, remainingSeconds, activeAttemptId, isSubmitting, examState.kind, lastSubmittedAttemptId]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    return () => {
      if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    };
  }, [resultPdfUrl]);

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
      setUser({ username: identity.username, is_admin: identity.is_admin === true });
      setScreen("catalog");
      void loadCatalog();
    } catch (error) {
      setLoginState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Cannot reach the server. Please try again."
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

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningUp(true);
    setLoginState({ kind: "idle", message: "" });

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(login)
      });

      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : (payload?.message ?? "Unable to create your account.")
        );
      }
      if (payload?.message === "User already exists") {
        throw new Error("That username is already taken. Try signing in instead.");
      }

      setLogin(initialLogin);
      setAuthMode("signin");
      setLoginState({
        kind: "success",
        message: "Account created. Please sign in with your credentials."
      });
    } catch (error) {
      setLoginState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to create your account."
      });
    } finally {
      setIsSigningUp(false);
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
      if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
      setUser(null);
      setExams([]);
      setQuery("");
      setTypeFilter("ALL");
      setSelectedExamId(null);
      setConfirmDeleteId(null);
      setEditExam(null);
      setEditAnswers([]);
      setPdfUrl(null);
      setActiveExam(null);
      setActiveAttemptId(null);
      setExamQuestions([]);
      setCandidateAnswers({});
      setExamState({ kind: "idle", message: "" });
      setResults([]);
      setResultsState({ kind: "idle", message: "" });
      setResultsView("mine");
      setLastSubmittedAttemptId(null);
      setResultDetail(null);
      setResultDetailState({ kind: "idle", message: "" });
      setResultPdfUrl(null);
      setResultPdfState({ kind: "idle", message: "" });
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
      setUploadState({ kind: "success", message: "Answer key ready. Review the answers before publishing." });
    } catch (error) {
      setUploadState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to parse this CSV."
      });
    } finally {
      setIsParsing(false);
    }
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
        (answer.question_type === "MCQ"
          ? !Number.isInteger(answer.option_count) ||
            (answer.option_count as number) < 1 ||
            (answer.option_count as number) > 4
          : answer.option_count !== null)
    );

    if (hasIncompleteAnswer) {
      setUploadState({ kind: "error", message: "Something looks incomplete — please re-upload a corrected CSV." });
      return;
    }

    const meta = validateMetadata();
    if (!meta || !selectedPdf || !selectedCsv) {
      return;
    }

    if (meta.totalQuestions !== review.answers.length) {
      setUploadState({
        kind: "error",
        message: `Total questions (${meta.totalQuestions}) must match the number of answers (${review.answers.length}).`
      });
      return;
    }

    setIsUploading(true);
    setUploadState({ kind: "idle", message: "" });

    const formData = new FormData();
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
      setUploadState({ kind: "success", message: "Examination published. It now appears in the list." });
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
    setLastSubmittedAttemptId(null);
    setAutoSubmitted(false);
    autoSubmitFiredRef.current = false;
    setScreen("catalog");
  }

  function goCatalog() {
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultsState({ kind: "idle", message: "" });
    setResultDetail(null);
    setResultDetailState({ kind: "idle", message: "" });
    setResultPdfUrl(null);
    setResultPdfState({ kind: "idle", message: "" });
    setScreen("catalog");
  }

  function goResults(view: ResultsView | null = null) {
    const nextView = view ?? resultsView;
    const effectiveView: ResultsView = user?.is_admin ? nextView : "mine";
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultsView(effectiveView);
    setResultDetail(null);
    setResultDetailState({ kind: "idle", message: "" });
    setResultPdfUrl(null);
    setResultPdfState({ kind: "idle", message: "" });
    setScreen("results");
    void loadResults(effectiveView);
  }

  async function openEdit(exam: CatalogItem) {
    setEditExam(exam);
    setEditForm({
      name: exam.name,
      exam_type: exam.exam_type,
      description: exam.description,
      duration: String(exam.duration)
    });
    setEditAnswers([]);
    setEditState({ kind: "idle", message: "" });
    setConfirmDeleteId(null);
    setIsEditLoading(true);
    try {
      const response = await fetch(`/api/answers/${encodeURIComponent(exam.exam_id)}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const raw = (await response.json()) as unknown;
      const list = (Array.isArray(raw) ? raw : [])
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          const question_number = Number(r.question_number);
          if (!Number.isFinite(question_number) || question_number <= 0) return null;
          const correct_answer = String(r.correct_answer ?? "").trim();
          if (!correct_answer) return null;
          const question_type: QuestionType = r.question_type === "Descriptive" ? "Descriptive" : "MCQ";
          const rawOption = r.option_count;
          const option_count =
            rawOption === null || rawOption === undefined || rawOption === ""
              ? null
              : Number(rawOption);
          return {
            question_number,
            correct_answer,
            correct_score: Number(r.correct_score) || 0,
            incorrect_score: Number(r.incorrect_score) || 0,
            question_type,
            option_count
          } as AnswerRow;
        })
        .filter((a): a is AnswerRow => a !== null)
        .sort((a, b) => a.question_number - b.question_number);
      setEditAnswers(list);
      if (list.length > 0) {
        setEditState({ kind: "success", message: `Loaded ${list.length} saved questions.` });
      }
    } catch (error) {
      setEditState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to load saved questions. Please try again."
      });
    } finally {
      setIsEditLoading(false);
    }
  }

  function closeEdit() {
    if (!isUpdating && !isEditLoading) setEditExam(null);
  }

  function updateEditAnswer(index: number, field: keyof AnswerRow, value: string) {
    setEditAnswers((current) =>
      current.map((answer, i) => {
        if (i !== index) return answer;
        if (field === "question_number") return { ...answer, question_number: Number(value) || 0 };
        if (field === "correct_score" || field === "incorrect_score")
          return { ...answer, [field]: value === "" || value === "-" ? 0 : Number(value) || 0 };
        if (field === "option_count") {
          if (value.trim() === "") return { ...answer, option_count: null };
          return { ...answer, option_count: Number(value) || 0 };
        }
        if (field === "question_type") {
          const next = (value === "Descriptive" ? "Descriptive" : "MCQ") as QuestionType;
          return {
            ...answer,
            question_type: next,
            // Descriptive answers carry no options.
            option_count: next === "Descriptive" ? null : (answer.option_count ?? 4)
          };
        }
        return { ...answer, [field]: value };
      })
    );
  }

  async function handleUpdate() {
    if (!editExam) return;
    if (editForm.name.trim().length < 3) {
      setEditState({ kind: "error", message: "Name must be at least 3 characters." });
      return;
    }
    const duration = Number(editForm.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      setEditState({ kind: "error", message: "Duration must be a positive number." });
      return;
    }
    for (let i = 0; i < editAnswers.length; i++) {
      const a = editAnswers[i];
      const label = `Question ${i + 1}`;
      if (!a.question_number || !a.correct_answer.trim()) {
        setEditState({ kind: "error", message: `${label}: question number and correct answer are required.` });
        return;
      }
      if (a.question_type === "MCQ") {
        if (!Number.isInteger(a.option_count) || (a.option_count as number) < 1 || (a.option_count as number) > 4) {
          setEditState({ kind: "error", message: `${label}: options must be 1–4 for MCQ.` });
          return;
        }
      } else if (a.option_count !== null) {
        setEditState({ kind: "error", message: `${label}: options must be left blank for Descriptive.` });
        return;
      }
    }
    setIsUpdating(true);
    setEditState({ kind: "idle", message: "" });
    try {
      // Always send the answers array, even when empty.
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        exam_type: editForm.exam_type,
        description: editForm.description.trim(),
        duration,
        answers: editAnswers.map((a) => ({
          exam_id: editExam.exam_id,
          question_number: a.question_number,
          correct_answer: a.correct_answer.trim(),
          correct_score: a.correct_score,
          incorrect_score: a.incorrect_score,
          question_type: a.question_type,
          option_count: a.option_count
        }))
      };
      const response = await fetch(`/api/update-exam/${encodeURIComponent(editExam.exam_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setEditState({ kind: "success", message: "Examination updated." });
      setEditExam(null);
      setEditAnswers([]);
      void loadCatalog();
    } catch (error) {
      setEditState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to update this paper."
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleBegin(exam: CatalogItem) {
    setIsStarting(true);
    setStartingExamId(exam.exam_id);
    setCatalogState({ kind: "idle", message: "" });

    try {
      const startResponse = await fetch(`/api/start-exam/${encodeURIComponent(exam.exam_id)}`, {
        method: "POST",
        credentials: "include"
      });

      if (!startResponse.ok) {
        throw new Error(await responseMessage(startResponse));
      }

      const startPayload = (await startResponse.json().catch(() => null)) as {
        attempt_id?: unknown;
        current_time?: unknown;
        expiry_time?: unknown;
      } | null;
      const attemptId =
        typeof startPayload?.attempt_id === "string" ? startPayload.attempt_id : "";
      if (!attemptId) {
        throw new Error("Could not start this paper. Please try again.");
      }
      // Remaining time comes from the server so a re-click resumes the
      // existing attempt instead of restarting the clock. Fall back to the
      // full exam duration if the timestamps are missing or invalid.
      const currentTime = Number(startPayload?.current_time);
      const expiryTime = Number(startPayload?.expiry_time);
      const resumedSeconds =
        Number.isFinite(currentTime) && Number.isFinite(expiryTime)
          ? Math.floor(expiryTime - currentTime)
          : Math.floor(Number(exam.duration) || 0) * 60;

      const pdfResponse = await fetch(`/api/fetch_exam/${encodeURIComponent(attemptId)}`, {
        credentials: "include"
      });

      if (!pdfResponse.ok) {
        throw new Error(await responseMessage(pdfResponse));
      }

      const blob = await pdfResponse.blob();
      if (!blob.size) {
        throw new Error("The question paper is empty. Please contact your administrator.");
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
        throw new Error("No questions were found for this paper. Please contact your administrator.");
      }

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setActiveExam(exam);
      setActiveAttemptId(attemptId);
      setExamQuestions(questions);
      setCandidateAnswers({});
      setExamState({ kind: "idle", message: "" });
      setRemainingSeconds(Math.max(0, resumedSeconds));
      setLastSubmittedAttemptId(null);
      setAutoSubmitted(false);
      autoSubmitFiredRef.current = false;
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

  async function handleSubmitExam(auto = false) {
    if (!activeExam || !activeAttemptId) return;
    if (isSubmitting) return;
    // Guard against a second auto-submit racing a manual submit that
    // already succeeded for this attempt.
    if (auto && lastSubmittedAttemptId === activeAttemptId) return;

    const questions = auto && examQuestions.length === 0 ? examQuestionsRef.current : examQuestions;
    const answersSnapshot = auto ? candidateAnswersRef.current : candidateAnswers;
    const payload = questions
      .filter((q) => (answersSnapshot[q.question_number] ?? "").trim().length > 0)
      .map((q) => ({
        question_number: q.question_number,
        answer: (answersSnapshot[q.question_number] ?? "").trim()
      }));

    // Empty submissions are allowed — the backend records them as pending
    // attempts (score defaults to 0 until evaluation completes).

    setIsSubmitting(true);
    if (!auto) setExamState({ kind: "idle", message: "" });
    else setExamState({ kind: "idle", message: "Time is up — submitting your answers…" });

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

      setLastSubmittedAttemptId(activeAttemptId);
      if (auto) {
        setAutoSubmitted(true);
        setExamState({
          kind: "success",
          message: `Time ran out — your answers were submitted automatically (${payload.length} of ${questions.length} answered).`
        });
      } else {
        setExamState({
          kind: "success",
          message: `Submitted ${payload.length} of ${questions.length} answers.`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit your answers.";
      // If the timer already fired and the manual submit landed first, the
      // second request 404s with "already submitted" — don't clobber success.
      if (auto && /already submitted/i.test(message) && lastSubmittedAttemptId === activeAttemptId) {
        return;
      }
      if (auto) autoSubmitFiredRef.current = false;
      setExamState({
        kind: "error",
        message: auto
          ? `Time ran out, but auto-submit failed (${message}). Please press Submit now — you have a short grace period.`
          : message
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadResults(view: ResultsView) {
    setIsResultsLoading(true);
    setResultsState({ kind: "idle", message: "" });
    try {
      const url = view === "all" ? "/api/results?view=admin" : "/api/results";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }
      const raw = (await response.json()) as unknown;
      const list = (Array.isArray(raw) ? raw : [])
        .map(normalizeResult)
        .filter((r): r is ExamResult => r !== null)
        .sort((a, b) => b.submission_time - a.submission_time);
      setResults(list);
    } catch (error) {
      setResults([]);
      setResultsState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to load results."
      });
    } finally {
      setIsResultsLoading(false);
    }
  }

  async function openResultDetail(attemptId: string) {
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultDetail(null);
    setResultDetailState({ kind: "idle", message: "" });
    setResultPdfUrl(null);
    setResultPdfState({ kind: "idle", message: "" });
    setIsResultPdfLoading(true);
    setIsResultDetailLoading(true);
    setScreen("result-detail");
    try {
      const response = await fetch(`/api/result/${encodeURIComponent(attemptId)}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }
      const raw = (await response.json()) as unknown;
      const detail = normalizeResultDetail(raw);
      if (!detail) {
        throw new Error("The result could not be understood. Please try again.");
      }
      setResultDetail(detail);
    } catch (error) {
      setResultDetailState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to load this result."
      });
    } finally {
      setIsResultDetailLoading(false);
    }
    try {
      const pdfResponse = await fetch(
        `/api/result/fetch_exam/${encodeURIComponent(attemptId)}`,
        { credentials: "include" }
      );
      if (!pdfResponse.ok) {
        throw new Error(await responseMessage(pdfResponse));
      }
      const blob = await pdfResponse.blob();
      if (!blob.size) {
        throw new Error("The question paper is empty. Please contact your administrator.");
      }
      setResultPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      setResultPdfUrl(null);
      setResultPdfState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to load the question paper."
      });
    } finally {
      setIsResultPdfLoading(false);
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
      questions: exams.reduce((sum, e) => sum + (Number(e.total_questions) || 0), 0),
      minutes: exams.reduce((sum, e) => sum + (Number(e.duration) || 0), 0)
    }),
    [exams]
  );

  const resultStats = useMemo(() => {
    const attempts = results.length;
    const papers = new Set(results.map((r) => r.exam_id)).size;
    const evaluated = results.filter((r) => r.evaluation_status !== "pending");
    const pending = attempts - evaluated.length;
    const totalScore = evaluated.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    return { attempts, papers, totalScore, evaluated: evaluated.length, pending };
  }, [results]);

  const resultDetailStats = useMemo(() => {
    if (!resultDetail) return { correct: 0, incorrect: 0, skipped: 0, answered: 0 };
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    for (const q of resultDetail.question_results) {
      if (!q.is_attempted) skipped += 1;
      else if (q.is_correct) correct += 1;
      else incorrect += 1;
    }
    return { correct, incorrect, skipped, answered: correct + incorrect };
  }, [resultDetail]);

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
              A composed space for serious assessment.
            </p>
          </section>

          <section className="login-panel" aria-labelledby="login-title">
            <div className="login-panel-inner">
              <div className="login-index">
                <strong id="login-title">{authMode === "signup" ? "Sign up" : "Sign in"}</strong>
                <span>02 / Access</span>
              </div>

              <form onSubmit={authMode === "signup" ? handleSignUp : handleSignIn}>
                <label className="field">
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    name="username"
                    placeholder="e.g. aarav_sharma"
                    required
                    minLength={authMode === "signup" ? 5 : undefined}
                    maxLength={authMode === "signup" ? 20 : undefined}
                    pattern={authMode === "signup" ? "[A-Za-z0-9_]+" : undefined}
                    title={authMode === "signup" ? "5–20 characters: letters, numbers, underscore." : undefined}
                    value={login.username}
                    onChange={(event) => setLogin({ ...login, username: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    name="password"
                    type="password"
                    placeholder="••••••••••"
                    required
                    minLength={authMode === "signup" ? 8 : undefined}
                    title={authMode === "signup" ? "At least 8 characters." : undefined}
                    value={login.password}
                    onChange={(event) => setLogin({ ...login, password: event.target.value })}
                  />
                </label>
                <button
                  className="btn-ink btn-full"
                  disabled={isSigningIn || isSigningUp}
                  type="submit"
                >
                  {authMode === "signup"
                    ? isSigningUp
                      ? "Creating…"
                      : "Create account →"
                    : isSigningIn
                      ? "Verifying…"
                      : "Enter the hall →"}
                </button>
              </form>

              {loginState.message ? (
                <p className={`status ${loginState.kind}`} role="status">
                  {loginState.message}
                </p>
              ) : null}

              <p className="login-hint">
                {authMode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setLoginState({ kind: "idle", message: "" });
                      }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setLoginState({ kind: "idle", message: "" });
                      }}
                    >
                      Create an account
                    </button>
                  </>
                )}
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
    const submitted = examState.kind === "success" && lastSubmittedAttemptId === activeAttemptId;
    const progressPct =
      examQuestions.length > 0 ? Math.round((answeredCount / examQuestions.length) * 100) : 0;
    const timerTone = expired ? "is-expired" : remainingSeconds < 300 ? "is-low" : "";

    return (
      <main className="exam-page">
        <header className="topbar">
          <span className="wordmark">
            <i aria-hidden="true" />
            Test&nbsp;Taker
          </span>
          <div className="account">
            <nav className="topnav" aria-label="Primary">
              <button className="link-btn" onClick={exitExam} type="button">
                Catalogue
              </button>
              <button className="link-btn" onClick={() => goResults()} type="button">
                Results
              </button>
            </nav>
            <span className="account-name">
              <b>{user?.username}</b>
              {user?.is_admin ? " · Admin" : " · Candidate"}
            </span>
            <button className="link-btn" onClick={exitExam} type="button">
              Exit hall
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
          </div>
        </header>

        <div className="exam-stickybar" role="status" aria-live="polite" aria-label="Exam progress">
          <div className="exam-stickybar-inner">
            <div className={`sticky-timer ${timerTone}`}>
              <span className="sticky-dot" aria-hidden="true" />
              <span className="sticky-label">{expired ? "Time up" : "Time left"}</span>
              <strong className="sticky-clock">{formatClock(remainingSeconds)}</strong>
            </div>
            <div className="sticky-progress" aria-label={`${answeredCount} of ${examQuestions.length} answered`}>
              <span className="sticky-count">
                {pad(answeredCount)}/{pad(examQuestions.length)} answered
              </span>
              <span className="sticky-track" aria-hidden="true">
                <i style={{ width: `${progressPct}%` }} />
              </span>
              <span className="sticky-pct" aria-hidden="true">
                {progressPct}%
              </span>
            </div>
            <button
              className="btn-accent sticky-submit"
              disabled={isSubmitting || submitted}
              onClick={() => void handleSubmitExam(false)}
              type="button"
            >
              {submitted ? "Submitted ✓" : isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

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
                <dt>Duration</dt>
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

          {expired && !submitted ? (
            <p className="status error" role="alert">
              {isSubmitting
                ? "Time is up — submitting your answers automatically…"
                : autoSubmitted
                  ? "Time ran out — your answers were submitted automatically."
                  : "Time is up — submitting your answers automatically…"}
            </p>
          ) : null}
          {expired && submitted && autoSubmitted ? (
            <p className="status success" role="status">
              Time ran out — your answers were submitted automatically. You can now view your result
              once evaluation completes.
            </p>
          ) : null}

          <div className="exam-grid">
            <article className="exam-paper" aria-label="Question paper">
              <div className="exam-paper-head">
                <span>Question paper</span>
                <span>Scrollable</span>
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
                          {question.question_type === "MCQ" ? ` · ${question.option_count} options` : ""}
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
                              disabled={expired || submitted}
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
                            placeholder={expired ? "Time is up — answers are locked." : "Type your answer…"}
                            value={value}
                            disabled={expired || submitted}
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
                  {examState.kind === "success" && lastSubmittedAttemptId ? (
                    <>
                      {" "}
                      <button
                        className="link-btn"
                        onClick={() => void openResultDetail(lastSubmittedAttemptId)}
                        type="button"
                      >
                        View result →
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}

              <div className="exam-foot">
                <button className="link-btn" onClick={exitExam} type="button">
                  ← Catalogue
                </button>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  {examState.kind === "success" && lastSubmittedAttemptId ? (
                    <button
                      className="btn-line"
                      onClick={() => void openResultDetail(lastSubmittedAttemptId)}
                      type="button"
                    >
                      View result
                    </button>
                  ) : null}
                  <button
                    className="btn-accent"
                    disabled={isSubmitting || submitted}
                    onClick={() => void handleSubmitExam(false)}
                    type="button"
                  >
                    {submitted ? "Submitted ✓" : isSubmitting ? "Submitting…" : "Submit answers"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="footer">
          <span>Test Taker — Examination Atelier</span>
        </footer>
      </main>
    );
  }

  if (screen === "results") {
    const isAdminView = resultsView === "all";
    return (
      <main className="catalog-page">
        <header className="topbar">
          <span className="wordmark">
            <i aria-hidden="true" />
            Test&nbsp;Taker
          </span>
          <div className="account">
            <nav className="topnav" aria-label="Primary">
              <button className="link-btn" onClick={goCatalog} type="button">
                Catalogue
              </button>
              <button
                className="link-btn active"
                onClick={() => goResults()}
                type="button"
                aria-current="page"
              >
                Results
              </button>
            </nav>
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
          <section className="hero" aria-labelledby="results-title">
            <div>
              <p className="eyebrow">
                <b>Results</b> — {isAdminView ? "All attempts" : "My attempts"}
              </p>
              <h1 id="results-title">
                Scores, <em>settled</em> and sealed.
              </h1>
              <p className="hero-copy">
                {user?.is_admin && isAdminView
                  ? "Administrator view — every submitted attempt across all candidates, evaluated or pending. Select a row for details."
                  : "Every submitted attempt of yours, evaluated or pending. Select a row for details."}
              </p>
            </div>
            <div className="hero-side">
              <dl className="hero-stats">
                <div>
                  <dt>Attempts</dt>
                  <dd>{pad(resultStats.attempts)}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{pad(resultStats.pending)}</dd>
                </div>
                <div>
                  <dt>Score · evaluated</dt>
                  <dd>{resultStats.totalScore}</dd>
                </div>
              </dl>
              {user?.is_admin ? (
                <div className="segmented" role="tablist" aria-label="Results scope">
                  <button
                    className={`segmented-btn ${!isAdminView ? "active" : ""}`}
                    onClick={() => {
                      setResultsView("mine");
                      void loadResults("mine");
                    }}
                    role="tab"
                    aria-selected={!isAdminView}
                    type="button"
                  >
                    Mine
                  </button>
                  <button
                    className={`segmented-btn ${isAdminView ? "active" : ""}`}
                    onClick={() => {
                      setResultsView("all");
                      void loadResults("all");
                    }}
                    role="tab"
                    aria-selected={isAdminView}
                    type="button"
                    title="Sends view=admin to /results"
                  >
                    All · Admin
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section aria-live="polite">
            <div className="toolbar">
              <p className="eyebrow" style={{ margin: 0 }}>
                {isResultsLoading
                  ? "Loading results…"
                  : `${results.length} attempt${results.length === 1 ? "" : "s"} · ${resultStats.evaluated} evaluated · ${resultStats.pending} pending${
                      isAdminView ? " · view=admin" : ""
                    }`}
              </p>
              <button
                className="link-btn"
                disabled={isResultsLoading}
                onClick={() => void loadResults(resultsView)}
                type="button"
              >
                {isResultsLoading ? "Refreshing…" : "Refresh ⟳"}
              </button>
            </div>

            {resultsState.message ? (
              <p className={`status ${resultsState.kind}`} role="status">
                {resultsState.message}
              </p>
            ) : null}

            {!isResultsLoading && !resultsState.message && results.length === 0 ? (
              <div className="empty">
                <p className="eyebrow">
                  <b>∅</b> — No results
                </p>
                <h3>No attempts yet.</h3>
                <p>Submit a paper and it will appear here — score included — once evaluation completes.</p>
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="exam-index">
                <div className="index-head result-head" aria-hidden="true">
                  <span>No.</span>
                  <span>Paper</span>
                  <span>Attempt</span>
                  <span>Score</span>
                </div>
                {results.map((result, i) => {
                  const isPending = result.evaluation_status === "pending";
                  return (
                  <article
                    className="exam-row result-row"
                    key={result.attempt_id}
                    onClick={() => void openResultDetail(result.attempt_id)}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="row-num">{pad(i + 1)}</span>
                    <div className="result-paper">
                      <span className="result-badges">
                        <span className="row-kind" style={{ marginBottom: 0 }}>{result.exam_type}</span>
                        <span className={`status-badge ${isPending ? "pending" : "evaluated"}`}>
                          {isPending ? "Pending" : "Evaluated"}
                        </span>
                      </span>
                      <h3 className="row-title">{result.name}</h3>
                      {result.description ? (
                        <p className="row-desc">{result.description}</p>
                      ) : null}
                      <p className="result-ids">
                        attempt {result.attempt_id.slice(0, 8)} · exam {result.exam_id.slice(0, 8)}
                      </p>
                    </div>
                    <dl className="row-meta result-meta">
                      {isAdminView || user?.is_admin ? (
                        <div>
                          <dt>Candidate</dt>
                          <dd>{result.username}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Submitted</dt>
                        <dd title={formatDateTime(result.submission_time)}>{formatDateTime(result.submission_time)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{isPending ? "Pending" : "Evaluated"}</dd>
                      </div>
                      <div>
                        <dt>Questions</dt>
                        <dd>{result.total_questions}</dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>{result.duration} min</dd>
                      </div>
                    </dl>
                    <div className="row-action result-score">
                      {isPending ? (
                        <strong className="score-pending">
                          Pending
                          <span> / {result.total_marks}</span>
                        </strong>
                      ) : (
                        <strong>
                          {result.score}
                          <span> / {result.total_marks}</span>
                        </strong>
                      )}
                      <span className="arrow" aria-hidden="true">
                        →
                      </span>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>

        <footer className="footer">
          <span>Test Taker — Examination Atelier</span>
        </footer>
      </main>
    );
  }

  if (screen === "result-detail") {
    const pct =
      resultDetail && resultDetail.total_marks > 0
        ? Math.round((resultDetail.score / resultDetail.total_marks) * 100)
        : 0;
    const isDetailPending = resultDetail?.evaluation_status === "pending";
    return (
      <main className="catalog-page">
        <header className="topbar">
          <span className="wordmark">
            <i aria-hidden="true" />
            Test&nbsp;Taker
          </span>
          <div className="account">
            <nav className="topnav" aria-label="Primary">
              <button className="link-btn" onClick={goCatalog} type="button">
                Catalogue
              </button>
              <button
                className="link-btn active"
                onClick={() => goResults()}
                type="button"
                aria-current="page"
              >
                Results
              </button>
            </nav>
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
          <div className="toolbar" style={{ paddingBottom: 0 }}>
            <button className="link-btn" onClick={() => goResults()} type="button">
              ← All results
            </button>
            <button
              className="link-btn"
              disabled={isResultDetailLoading}
              onClick={() => resultDetail && void openResultDetail(resultDetail.attempt_id)}
              type="button"
            >
              {isResultDetailLoading ? "Reloading…" : "Reload ⟳"}
            </button>
          </div>

          {isResultDetailLoading && !resultDetail ? (
            <p className="eyebrow" style={{ marginTop: "32px" }}>
              Loading result…
            </p>
          ) : null}

          {resultDetailState.message ? (
            <p className={`status ${resultDetailState.kind}`} role="status">
              {resultDetailState.message}
            </p>
          ) : null}

          {!isResultDetailLoading && !resultDetail && !resultDetailState.message ? (
            <div className="empty">
              <p className="eyebrow">
                <b>∅</b> — Nothing here
              </p>
              <h3>This result could not be found.</h3>
              <p>It may belong to another candidate, or the attempt id may be invalid.</p>
            </div>
          ) : null}

          {resultDetail ? (
            <>
              <section className="hero" aria-labelledby="result-title">
                <div>
                  <p className="eyebrow">
                    <b>Result</b> — {resultDetail.exam_type} · {formatDateTime(resultDetail.submission_time)}
                  </p>
                  <h1 id="result-title">{resultDetail.name}</h1>
                  <p style={{ marginTop: "14px" }}>
                    <span className={`status-badge ${isDetailPending ? "pending" : "evaluated"}`}>
                      {isDetailPending ? "Evaluation pending" : "Evaluated"}
                    </span>
                  </p>
                  {resultDetail.description ? (
                    <p className="hero-copy">{resultDetail.description}</p>
                  ) : null}
                  <p className="result-sub">
                    {resultDetail.username} · {resultDetail.total_questions} questions ·{" "}
                    {resultDetail.duration} min
                  </p>
                </div>
                {isDetailPending ? (
                  <dl className="hero-stats result-hero-stats">
                    <div>
                      <dt>Status</dt>
                      <dd>Pending</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd style={{ fontSize: "1rem" }}>{formatDateTime(resultDetail.submission_time)}</dd>
                    </div>
                    <div>
                      <dt>Questions</dt>
                      <dd>{pad(resultDetail.total_questions)}</dd>
                    </div>
                  </dl>
                ) : (
                <dl className="hero-stats result-hero-stats">
                  <div>
                    <dt>Score</dt>
                    <dd>
                      {resultDetail.score} / {resultDetail.total_marks}
                    </dd>
                  </div>
                  <div>
                    <dt>Percentage</dt>
                    <dd>{pct}%</dd>
                  </div>
                  <div>
                    <dt>Correct</dt>
                    <dd>
                      {pad(resultDetailStats.correct)}/{pad(resultDetail.question_results.length)}
                    </dd>
                  </div>
                </dl>
                )}
              </section>

              {isDetailPending ? (
                <div className="empty" style={{ marginTop: "28px" }}>
                  <p className="eyebrow">
                    <b>◷</b> — Evaluation pending
                  </p>
                  <h3>Evaluation is pending.</h3>
                  <p>
                    Your answers have been submitted and are waiting to be evaluated.
                    Please refresh in a while to see your score and per-question breakdown.
                  </p>
                  <div style={{ marginTop: "20px" }}>
                    <button
                      className="btn-line"
                      disabled={isResultDetailLoading}
                      onClick={() => void openResultDetail(resultDetail.attempt_id)}
                      type="button"
                    >
                      {isResultDetailLoading ? "Refreshing…" : "Refresh ⟳"}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="exam-grid result-grid">
                <article className="exam-paper" aria-label="Question paper">
                  <div className="exam-paper-head">
                    <span>Question paper</span>
                    <span>Scrollable</span>
                  </div>
                  {isResultPdfLoading ? (
                    <p className="eyebrow result-paper-loading">Loading paper…</p>
                  ) : resultPdfUrl && resultDetail ? (
                    <iframe
                      className="exam-paper-frame"
                      src={resultPdfUrl}
                      title={`${resultDetail.name} — question paper`}
                    />
                  ) : resultPdfState.message ? (
                    <p className={`status ${resultPdfState.kind}`} role="status">
                      {resultPdfState.message}
                    </p>
                  ) : (
                    <p className="eyebrow result-paper-loading">Paper unavailable.</p>
                  )}
                </article>

                <section aria-label="Per-question breakdown">
                  <div className="exam-side-head">
                    <p className="eyebrow">
                      <b>Sheet</b> — Per-question breakdown
                    </p>
                    <span className="exam-side-count">
                      {resultDetailStats.correct} correct · {resultDetailStats.incorrect} wrong ·{" "}
                      {resultDetailStats.skipped} skipped
                    </span>
                  </div>
                <div className="answer-list" style={{ marginTop: "16px" }}>
                  {resultDetail.question_results.map((q) => {
                    const verdict = !q.is_attempted
                      ? "Skipped"
                      : q.is_correct
                        ? "Correct"
                        : "Incorrect";
                    const verdictClass = !q.is_attempted
                      ? "skipped"
                      : q.is_correct
                        ? "correct"
                        : "incorrect";
                    const earnedClass = !q.is_attempted
                      ? "neutral"
                      : q.is_correct
                        ? "positive"
                        : "negative";
                    const penaltyLabel =
                      q.incorrect_score <= 0 ? `${q.incorrect_score}` : `-${q.incorrect_score}`;
                    return (
                      <article className="question-editor result-qcard" key={q.question_number}>
                        <div className="question-editor-header">
                          <strong>Q{q.question_number}</strong>
                          <span className="result-badges">
                            <span className="row-kind" style={{ marginBottom: 0 }}>
                              {q.question_type}
                              {q.question_type === "MCQ" && q.option_count !== null
                                ? ` · ${q.option_count} options`
                                : ""}
                            </span>
                            <span className={`verdict ${verdictClass}`}>{verdict}</span>
                          </span>
                        </div>
                        <div className="result-answers">
                          <div>
                            <span>Your answer</span>
                            <strong>{q.is_attempted ? (q.answer ?? "—") : "Skipped"}</strong>
                            {!q.is_attempted ? <em>not attempted</em> : null}
                          </div>
                          <div>
                            <span>Correct answer</span>
                            <strong>{q.correct_answer}</strong>
                          </div>
                          <div>
                            <span>Score</span>
                            <strong className={`earned ${earnedClass}`}>
                              {q.score > 0 ? `+${q.score}` : `${q.score}`}
                            </strong>
                          </div>
                        </div>
                        <p className="mark-scheme" aria-label="Marking scheme">
                          <span className="mark-plus">+{q.correct_score}</span>
                          <span className="mark-sep">/</span>
                          <span className="mark-minus">{penaltyLabel}</span>
                        </p>
                      </article>
                    );
                  })}
                </div>
                </section>
              </div>
              )}
            </>
          ) : null}
        </div>

        <footer className="footer">
          <span>Test Taker — Examination Atelier</span>
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
          <nav className="topnav" aria-label="Primary">
            <button className="link-btn active" onClick={goCatalog} type="button" aria-current="page">
              Catalogue
            </button>
            <button className="link-btn" onClick={() => goResults()} type="button">
              Results
            </button>
          </nav>
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
              <b>Catalogue</b>
            </p>
            <h1 id="catalog-title">
              Assessments, <em>composed</em> with intent.
            </h1>
            <p className="hero-copy">
              Choose a paper below. The timer starts when you begin.
            </p>
          </div>
          <div className="hero-side">
            <dl className="hero-stats">
              <div>
                <dt>Papers</dt>
                <dd>{pad(stats.total)}</dd>
              </div>
              <div>
                <dt>Questions</dt>
                <dd>{pad(stats.questions)}</dd>
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
                  ? "New examinations appear here as soon as they are published. Check back later."
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
                      <span className="row-kind">{exam.exam_type}</span>
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
                              justifyContent: "flex-end",
                              gap: "16px",
                              flexWrap: "wrap"
                            }}
                          >
                            <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
                              <button
                                className="link-btn"
                                disabled={isDeleting || isUpdating}
                                onClick={() => void openEdit(exam)}
                                type="button"
                                title="Update exam details and questions"
                                aria-label={`Update ${exam.name}`}
                              >
                                <span aria-hidden="true" style={{ marginRight: "6px" }}>✎</span>
                                Update paper
                              </button>
                              <button
                                className="link-btn"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(exam.exam_id)}
                                type="button"
                              >
                                Delete paper
                              </button>
                            </div>
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
                  <b>{review ? "02" : "01"}</b> — {review ? "Review answers" : "New examination"}
                </p>
                <h2 id="upload-title">{review ? "Review questions" : "Compose examination"}</h2>
                <div className="sheet-steps">
                  <span className={!review ? "active" : ""}>01 Details</span>
                  <span className={review ? "active" : ""}>02 Answers</span>
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
                        : "CSV only · 1–4 options for MCQ, blank for Descriptive"}
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
                    {review.name} <span>{review.answers.length} answers · read-only</span>
                  </p>
                  <p className="eyebrow" style={{ margin: "0 0 16px" }}>
                    Review only — to fix a mistake, go back and re-upload a corrected CSV.
                  </p>
                  <div className="question-list">
                    {review.answers.map((answer, index) => (
                      <article className="question-editor" key={`${answer.question_number}-${index}`}>
                        <div className="question-editor-header">
                          <strong>Q{answer.question_number}</strong>
                          <span className="row-kind" style={{ marginBottom: 0 }}>
                            {answer.question_type}
                            {answer.question_type === "MCQ"
                              ? ` · ${answer.option_count} options`
                              : ""}
                          </span>
                        </div>
                        <p className="row-desc">
                          Answer: <strong>{answer.correct_answer}</strong>
                        </p>
                        <p className="answer-scores">
                          +{answer.correct_score} · {answer.incorrect_score}
                        </p>
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
                      ← Re-upload CSV
                    </button>
                    <button
                      className="btn-accent"
                      disabled={isUploading}
                      onClick={() => void submitReview()}
                      type="button"
                    >
                      {isUploading ? "Publishing…" : "Publish examination"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {editExam ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <section
            aria-labelledby="edit-title"
            aria-modal="true"
            className="upload-sheet"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="sheet-head">
              <div>
                <p className="eyebrow">
                  <b>✎</b> — Update examination
                </p>
                <h2 id="edit-title">Update paper</h2>
              </div>
              <button
                aria-label="Close update dialog"
                className="link-btn"
                disabled={isUpdating || isEditLoading}
                onClick={closeEdit}
                type="button"
              >
                Close ✕
              </button>
            </div>

            <div className="sheet-body">
              <div className="upload-fields">
                <label className="wide-field">
                  <span>Paper title</span>
                  <input
                    maxLength={100}
                    value={editForm.name}
                    onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Series</span>
                  <select
                    value={editForm.exam_type}
                    onChange={(event) => setEditForm({ ...editForm, exam_type: event.target.value as ExamType })}
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
                    type="number"
                    value={editForm.duration}
                    onChange={(event) => setEditForm({ ...editForm, duration: event.target.value })}
                  />
                </label>
                <label className="wide-field">
                  <span>Brief</span>
                  <textarea
                    maxLength={500}
                    rows={3}
                    value={editForm.description}
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "16px",
                  margin: "26px 0 14px",
                  flexWrap: "wrap"
                }}
              >
                <p className="eyebrow" style={{ margin: 0 }}>
                  <b>Questions</b> — {isEditLoading ? "loading…" : `${editAnswers.length} questions`}
                </p>
              </div>
              <p className="eyebrow" style={{ margin: "0 0 16px" }}>
                Saved questions load automatically — edit the values below. For MCQ, options must be
                1–4; for Descriptive, leave options blank. Total marks and questions cannot be changed
                after creation.
              </p>

              <div className="question-list">
                {editAnswers.map((answer, index) => (
                  <article className="question-editor" key={`edit-${index}`}>
                    <div className="question-editor-header">
                      <strong>Q{answer.question_number}</strong>
                      <span className="row-kind" style={{ marginBottom: 0 }}>
                        {answer.question_type}
                      </span>
                    </div>
                    <label>
                      <span>Correct answer</span>
                      <input
                        value={answer.correct_answer}
                        onChange={(event) => updateEditAnswer(index, "correct_answer", event.target.value)}
                      />
                    </label>
                    <div className="upload-fields" style={{ gap: "16px" }}>
                      <label>
                        <span>Correct score</span>
                        <input
                          type="number"
                          value={answer.correct_score}
                          onChange={(event) => updateEditAnswer(index, "correct_score", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Incorrect score</span>
                        <input
                          type="number"
                          value={answer.incorrect_score}
                          onChange={(event) => updateEditAnswer(index, "incorrect_score", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Type</span>
                        <select
                          value={answer.question_type}
                          onChange={(event) => updateEditAnswer(index, "question_type", event.target.value)}
                        >
                          <option value="MCQ">MCQ</option>
                          <option value="Descriptive">Descriptive</option>
                        </select>
                      </label>
                      <label>
                        <span>Options{answer.question_type === "MCQ" ? " · 1–4" : " · blank for Descriptive"}</span>
                        <input
                          min="1"
                          max="4"
                          type="number"
                          placeholder={answer.question_type === "MCQ" ? "1–4" : "Blank"}
                          value={answer.option_count ?? ""}
                          disabled={answer.question_type !== "MCQ"}
                          onChange={(event) => updateEditAnswer(index, "option_count", event.target.value)}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              {editState.message ? (
                <p className={`status ${editState.kind}`} role="status">
                  {editState.message}
                </p>
              ) : null}
              <div className="sheet-actions">
                <button className="btn-line" onClick={closeEdit} type="button">
                  Cancel
                </button>
                <button
                  className="btn-accent"
                  disabled={isUpdating || isEditLoading}
                  onClick={() => void handleUpdate()}
                  type="button"
                >
                  {isUpdating ? "Saving…" : isEditLoading ? "Loading…" : "Save changes"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
