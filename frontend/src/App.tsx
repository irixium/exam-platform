import { FormEvent, useState } from "react";

type ApiState = {
  kind: "idle" | "success" | "error";
  message: string;
};

const initialState = { username: "", password: "" };

export default function App() {
  const [form, setForm] = useState(initialState);
  const [apiState, setApiState] = useState<ApiState>({ kind: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setApiState({ kind: "idle", message: "" });

    try {
      const response = await fetch("/api/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok || data.error) {
        setApiState({ kind: "error", message: data.error ?? "Unable to sign in." });
        return;
      }

      setApiState({ kind: "success", message: data.message ?? "Signed in successfully." });
      setForm(initialState);
    } catch {
      setApiState({ kind: "error", message: "Backend is unreachable. Check that FastAPI is running." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="intro" aria-label="Test Taker">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Test Taker</span>
        </div>
        <p className="intro-label">Assessment environment</p>
        <h1 className="intro-title">Focus on what<br />matters.</h1>
        <p className="intro-copy">
          A considered space for taking timed assessments with clarity and confidence.
        </p>
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

        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              name="username"
              placeholder="Enter your username"
              required
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
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
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>

          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {apiState.message ? (
          <p className={`status ${apiState.kind}`} role="status">
            {apiState.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
