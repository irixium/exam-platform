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
  state: "DRAFT" | "PUBLISHED";
  created_at: string;
  updated_at: string;
};

type Question = {
  question_id: string;
  exam_id: string;
  question_number: number;
  question_subject: string;
  question_text: string;
  options: string;
  correct_answer: string;
};

type UploadForm = {
  name: string;
  exam_type: ExamType;
  description: string;
  duration: string;
  total_marks: string;
  state: "DRAFT" | "PUBLISHED";
};

type UploadResponse = {
  data: CatalogItem;
  questions: Question[];
};

const initialLogin = { username: "", password: "" };
const initialUploadForm: UploadForm = {
  name: "",
  exam_type: "JEE MAIN",
  description: "",
  duration: "180",
  total_marks: "300",
  state: "DRAFT"
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
    state,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? "")
  };
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
  const csvMimeTypes = ["text/csv", "application/csv", "application/vnd.ms-excel"];
  return file.name.toLowerCase().endsWith(".csv") && (!file.type || csvMimeTypes.includes(file.type));
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
  const [screen, setScreen] = useState<"checking" | "login" | "catalog">("checking");
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [review, setReview] = useState<UploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      setUser(null);
      setExams([]);
      setQuery("");
      setTypeFilter("ALL");
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
    setSelectedFile(null);
    setUploadState({ kind: "idle", message: "" });
    setReview(null);
    setIsUploadOpen(true);
  }

  function closeUpload() {
    if (!isUploading) {
      setIsUploadOpen(false);
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isCsv(file)) {
      setSelectedFile(null);
      setUploadState({ kind: "error", message: "Select a CSV file to continue." });
      return;
    }

    setSelectedFile(file);
    setUploadState({ kind: "idle", message: "" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadState({ kind: "error", message: "Choose a CSV file before uploading." });
      return;
    }

    if (uploadForm.name.trim().length < 3) {
      setUploadState({ kind: "error", message: "Give the examination a name of at least 3 characters." });
      return;
    }

    const duration = Number(uploadForm.duration);
    const totalMarks = Number(uploadForm.total_marks);

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(totalMarks) || totalMarks <= 0) {
      setUploadState({ kind: "error", message: "Duration and total marks must be positive numbers." });
      return;
    }

    setIsUploading(true);
    setUploadState({ kind: "idle", message: "" });

    const now = new Date().toISOString();
    const formData = new FormData();
    formData.append("exam_id", crypto.randomUUID());
    formData.append("name", uploadForm.name.trim());
    formData.append("exam_type", uploadForm.exam_type);
    formData.append("description", uploadForm.description.trim());
    formData.append("duration", String(duration));
    formData.append("total_marks", String(totalMarks));
    formData.append("state", uploadForm.state);
    formData.append("created_at", now);
    formData.append("updated_at", now);
    formData.append("csv_file", selectedFile);

    try {
      const response = await fetch("/api/upload-csv", {
        method: "POST",
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const result = (await response.json()) as UploadResponse;
      const questions = Array.isArray(result.questions) ? result.questions : [];
      setReview({ data: normalizeExam(result.data, 0), questions });
      setUploadState({ kind: "success", message: "CSV parsed. Review the imported questions before submitting." });
    } catch (error) {
      setUploadState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to upload this CSV."
      });
    } finally {
      setIsUploading(false);
    }
  }

  function updateQuestion(index: number, field: keyof Question, value: string) {
    setReview((current) => {
      if (!current) {
        return current;
      }

      const questions = current.questions.map((question, questionIndex) => {
        if (questionIndex !== index) {
          return question;
        }

        return {
          ...question,
          [field]: field === "question_number" ? Number(value) || 0 : value
        };
      });

      return { ...current, questions };
    });
  }

  function submitReview() {
    if (!review || review.questions.length === 0) {
      setUploadState({ kind: "error", message: "At least one imported question is required." });
      return;
    }

    const hasIncompleteQuestion = review.questions.some(
      (question) =>
        !question.question_number ||
        !question.question_subject.trim() ||
        !question.question_text.trim() ||
        !question.options.trim() ||
        !question.correct_answer.trim()
    );

    if (hasIncompleteQuestion) {
      setUploadState({ kind: "error", message: "Complete every question field before submitting." });
      return;
    }

    setUploadState({
      kind: "success",
      message: "Exam draft is ready. Edited questions will submit once the final endpoint is available."
    });
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
              {filtered.map((exam, i) => (
                <article className="exam-row" key={exam.exam_id}>
                  <span className="row-num">{pad(i + 1)}</span>
                  <div>
                    {user?.is_admin ? null : <span className="row-kind">{exam.exam_type}</span>}
                    {user?.is_admin ? (
                      <span className="row-kind">
                        {exam.exam_type} · <span className={`row-state ${exam.state.toLowerCase()}`}>{exam.state}</span>
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
                  </dl>
                  <div className="row-action">
                    <button className="begin-btn" type="button">
                      Begin <span className="arrow" aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
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
                disabled={isUploading}
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
                      <span>State</span>
                      <select
                        value={uploadForm.state}
                        onChange={(event) =>
                          setUploadForm({ ...uploadForm, state: event.target.value as UploadForm["state"] })
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
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
                    accept=".csv,text/csv"
                    className="visually-hidden"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    className={`drop-zone ${isDragging ? "dragging" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    type="button"
                  >
                    <span className="drop-zone-label">{selectedFile ? selectedFile.name : "Drop the answer key here"}</span>
                    <span className="drop-zone-sub">
                      {selectedFile ? "Click to replace · CSV only" : "CSV only · or click to browse"}
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
                    <button className="btn-ink" disabled={isUploading} type="submit">
                      {isUploading ? "Parsing…" : "Parse & review →"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="review-summary">
                    {review.data.name} <span>{review.questions.length} questions</span>
                  </p>
                  <div className="question-list">
                    {review.questions.map((question, index) => (
                      <article className="question-editor" key={`${question.question_id}-${index}`}>
                        <div className="question-editor-header">
                          <strong>Q{index + 1}</strong>
                          <label>
                            <span>No.</span>
                            <input
                              min="1"
                              type="number"
                              value={question.question_number}
                              onChange={(event) => updateQuestion(index, "question_number", event.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          <span>Subject</span>
                          <input
                            value={question.question_subject}
                            onChange={(event) => updateQuestion(index, "question_subject", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Question</span>
                          <textarea
                            rows={3}
                            value={question.question_text}
                            onChange={(event) => updateQuestion(index, "question_text", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Options · JSON</span>
                          <textarea
                            rows={3}
                            value={question.options}
                            onChange={(event) => updateQuestion(index, "options", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Correct answer</span>
                          <input
                            value={question.correct_answer}
                            onChange={(event) => updateQuestion(index, "correct_answer", event.target.value)}
                          />
                        </label>
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
                    <button className="btn-accent" onClick={submitReview} type="button">
                      Seal examination
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
