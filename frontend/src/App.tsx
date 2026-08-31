import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";

type ApiState = {
  kind: "idle" | "success" | "error";
  message: string;
};

type User = {
  username: string;
  is_admin: boolean;
};

type ExamType = "JEE MAIN" | "JEE ADVANCED" | "OTHER";

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

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { detail?: string; error?: string; message?: string }
    | null;

  return body?.detail ?? body?.error ?? body?.message ?? "The request could not be completed.";
}

function isCsv(file: File) {
  const csvMimeTypes = ["text/csv", "application/csv", "application/vnd.ms-excel"];
  return file.name.toLowerCase().endsWith(".csv") && (!file.type || csvMimeTypes.includes(file.type));
}

export default function App() {
  const [screen, setScreen] = useState<"checking" | "login" | "catalog">("checking");
  const [login, setLogin] = useState(initialLogin);
  const [loginState, setLoginState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<CatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
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

      const identity = (await response.json()) as User;
      setUser(identity);
      setScreen("catalog");
      void loadCatalog();
    } catch (error) {
      setLoginState({
        kind: "error",
        message: error instanceof Error ? error.message : "Backend is unreachable. Check that FastAPI is running."
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

      setExams((await response.json()) as CatalogItem[]);
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

      if (!response.ok) {
        throw new Error(await responseMessage(response));
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

    const duration = Number(uploadForm.duration);
    const totalMarks = Number(uploadForm.total_marks);

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(totalMarks) || totalMarks <= 0) {
      setUploadState({ kind: "error", message: "Duration and total marks must be positive numbers." });
      return;
    }

    setIsUploading(true);
    setUploadState({ kind: "idle", message: "" });

    const now = new Date().toISOString();
    const metadata: CatalogItem = {
      exam_id: crypto.randomUUID(),
      name: uploadForm.name.trim(),
      exam_type: uploadForm.exam_type,
      description: uploadForm.description.trim(),
      duration,
      total_marks: totalMarks,
      state: uploadForm.state,
      created_at: now,
      updated_at: now
    };
    const formData = new FormData();

    Object.entries(metadata).forEach(([key, value]) => formData.append(key, String(value)));
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
      setReview(result);
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
      message: "Exam draft is ready. Submitting edited questions will be connected when the final endpoint is available."
    });
  }

  if (screen === "checking") {
    return <main className="app-loading">Checking your assessment session...</main>;
  }

  if (screen === "login") {
    return (
      <main className="shell">
        <section className="intro" aria-label="Test Taker">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>Test Taker</span>
          </div>
          <p className="intro-label">Assessment environment</p>
          <h1 className="intro-title">Focus on what<br />matters.</h1>
          <p className="intro-copy">A considered space for taking timed assessments with clarity and confidence.</p>
          <div className="intro-footer">
            <span>Secure session</span>
            <span>01 / 01</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="login-title">
          <div className="panel-heading">
            <p className="eyebrow">Account access</p>
            <span className="panel-index">01</span>
          </div>
          <h2 id="login-title">Welcome back.</h2>
          <p className="copy">Enter your credentials to continue to your assessments.</p>

          <form className="form" onSubmit={handleSignIn}>
            <label>
              <span>Username</span>
              <input
                autoComplete="username"
                name="username"
                placeholder="Enter your username"
                required
                value={login.username}
                onChange={(event) => setLogin({ ...login, username: event.target.value })}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
              />
            </label>
            <button disabled={isSigningIn} type="submit">{isSigningIn ? "Signing in..." : "Sign in"}</button>
          </form>

          {loginState.message ? <p className={`status ${loginState.kind}`} role="status">{loginState.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="catalog-shell">
      <header className="catalog-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Test Taker</span>
        </div>
        <div className="account-summary">
          <span>{user?.username}</span>
          {user?.is_admin ? <span className="role-badge">Administrator</span> : null}
        </div>
      </header>

      <section className="catalog-hero" aria-labelledby="catalog-title">
        <div>
          <p className="eyebrow">Assessment catalog</p>
          <h1 id="catalog-title">Find your next<br />challenge.</h1>
          <p>Choose an exam built for focused practice and measured progress.</p>
        </div>
        {user?.is_admin ? <button className="primary-action" onClick={openUpload} type="button">Upload exam</button> : null}
      </section>

      <section className="catalog-section" aria-live="polite">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Available exams</p>
            <h2>Prepared for you</h2>
          </div>
          <button className="text-button" disabled={isCatalogLoading} onClick={() => void loadCatalog()} type="button">
            {isCatalogLoading ? "Refreshing..." : "Refresh catalog"}
          </button>
        </div>

        {catalogState.message ? <p className="status error">{catalogState.message}</p> : null}
        {isCatalogLoading ? <p className="catalog-note">Loading available assessments...</p> : null}
        {!isCatalogLoading && !catalogState.message && exams.length === 0 ? (
          <p className="catalog-note">No exams are available right now. Check back soon.</p>
        ) : null}
        <div className="exam-grid">
          {exams.map((exam, index) => (
            <article className="exam-card" key={exam.exam_id}>
              <div className="exam-card-topline">
                <span className="exam-number">{String(index + 1).padStart(2, "0")}</span>
                <span className={`state-badge ${exam.state.toLowerCase()}`}>{exam.state}</span>
              </div>
              <p className="exam-type">{exam.exam_type}</p>
              <h3>{exam.name}</h3>
              <p className="exam-description">{exam.description || "A structured practice assessment."}</p>
              <dl className="exam-details">
                <div><dt>Duration</dt><dd>{exam.duration} min</dd></div>
                <div><dt>Total marks</dt><dd>{exam.total_marks}</dd></div>
              </dl>
              <button className="secondary-action" type="button">Start assessment</button>
            </article>
          ))}
        </div>
      </section>

      {isUploadOpen ? (
        <div className="modal-backdrop" onMouseDown={closeUpload}>
          <section
            aria-labelledby="upload-title"
            aria-modal="true"
            className="upload-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Admin workspace</p>
                <h2 id="upload-title">{review ? "Review imported questions" : "Upload an exam"}</h2>
              </div>
              <button aria-label="Close upload dialog" className="close-button" disabled={isUploading} onClick={closeUpload} type="button">Close</button>
            </div>

            {!review ? (
              <form className="upload-form" onSubmit={handleUpload}>
                <div className="upload-fields">
                  <label className="wide-field">
                    <span>Exam name</span>
                    <input maxLength={100} minLength={3} required value={uploadForm.name} onChange={(event) => setUploadForm({ ...uploadForm, name: event.target.value })} />
                  </label>
                  <label>
                    <span>Exam type</span>
                    <select value={uploadForm.exam_type} onChange={(event) => setUploadForm({ ...uploadForm, exam_type: event.target.value as ExamType })}>
                      <option value="JEE MAIN">JEE MAIN</option>
                      <option value="JEE ADVANCED">JEE ADVANCED</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </label>
                  <label>
                    <span>Publishing state</span>
                    <select value={uploadForm.state} onChange={(event) => setUploadForm({ ...uploadForm, state: event.target.value as UploadForm["state"] })}>
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </label>
                  <label>
                    <span>Duration (minutes)</span>
                    <input min="1" required type="number" value={uploadForm.duration} onChange={(event) => setUploadForm({ ...uploadForm, duration: event.target.value })} />
                  </label>
                  <label>
                    <span>Total marks</span>
                    <input min="1" required type="number" value={uploadForm.total_marks} onChange={(event) => setUploadForm({ ...uploadForm, total_marks: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <textarea maxLength={500} rows={3} value={uploadForm.description} onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })} />
                  </label>
                </div>

                <input accept=".csv,text/csv" className="visually-hidden" onChange={handleFileChange} ref={fileInputRef} type="file" />
                <button
                  className={`drop-zone ${isDragging ? "dragging" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  type="button"
                >
                  <span className="drop-zone-label">{selectedFile ? selectedFile.name : "Drop your CSV here"}</span>
                  <span>{selectedFile ? "Choose another file" : "or browse files"}</span>
                </button>

                {uploadState.message ? <p className={`status ${uploadState.kind}`} role="status">{uploadState.message}</p> : null}
                <div className="dialog-actions">
                  <button className="text-button" onClick={closeUpload} type="button">Cancel</button>
                  <button className="primary-action" disabled={isUploading} type="submit">{isUploading ? "Parsing CSV..." : "Upload and review"}</button>
                </div>
              </form>
            ) : (
              <div className="review-panel">
                <p className="review-summary">{review.questions.length} question{review.questions.length === 1 ? "" : "s"} imported for {review.data.name}.</p>
                <div className="question-list">
                  {review.questions.map((question, index) => (
                    <article className="question-editor" key={`${question.question_id}-${index}`}>
                      <div className="question-editor-header">
                        <strong>Question {index + 1}</strong>
                        <label>
                          <span>Number</span>
                          <input min="1" type="number" value={question.question_number} onChange={(event) => updateQuestion(index, "question_number", event.target.value)} />
                        </label>
                      </div>
                      <label>
                        <span>Subject</span>
                        <input value={question.question_subject} onChange={(event) => updateQuestion(index, "question_subject", event.target.value)} />
                      </label>
                      <label>
                        <span>Question</span>
                        <textarea rows={3} value={question.question_text} onChange={(event) => updateQuestion(index, "question_text", event.target.value)} />
                      </label>
                      <label>
                        <span>Options (JSON)</span>
                        <textarea rows={3} value={question.options} onChange={(event) => updateQuestion(index, "options", event.target.value)} />
                      </label>
                      <label>
                        <span>Correct answer</span>
                        <input value={question.correct_answer} onChange={(event) => updateQuestion(index, "correct_answer", event.target.value)} />
                      </label>
                    </article>
                  ))}
                </div>
                {uploadState.message ? <p className={`status ${uploadState.kind}`} role="status">{uploadState.message}</p> : null}
                <div className="dialog-actions">
                  <button className="text-button" onClick={() => setReview(null)} type="button">Back to upload</button>
                  <button className="primary-action" onClick={submitReview} type="button">Submit exam</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
