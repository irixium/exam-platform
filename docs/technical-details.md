# Backend notes

This file records how the current code handles auth, sessions, permissions, app mounting, and scoring. It is meant to sit next to `README.md`, which stays at the level of what the app does.

Live demo: http://152.70.78.167:8000/

## Password handling

Signup and signin live in `backend/services/auth.py`. The code uses `argon2-cffi` through `PasswordHasher`, as listed in `backend/requirements.txt`.

On signup, the plain password is hashed with `ph.hash` and the hash is stored in the `users` table as `password_hash`. The plain text is never stored. On signin, the row is looked up by username and checked with `ph.verify`. A missing user and a failed verify both return 401 with the same message, so the response does not say which part failed.

Input limits are set in `backend/schemas/auth.py`. Usernames allow 5 to 20 characters of letters, numbers, and underscore. Passwords allow 8 to 100 characters.

## Session cookie

`backend/main.py` adds Starlette `SessionMiddleware` with the secret from `backend/app_secrets.py` which is a secret file:

```python
app.add_middleware(SessionMiddleware, secret_key=session_secret_key)
```

Signin writes the user id into the session:

```python
request.session["user_id"] = result["user_id"]
```

Signout clears the whole session. The cookie itself is signed with the secret. The server keeps no separate session table. If the cookie is missing or the id has no matching user row, the request is rejected.

`get_current_user` in `backend/services/auth.py` reads `request.session.get("user_id")`, selects the username from `users` by id, and returns an `AuthenticatedUser` with `is_admin` set by membership in an `admins` set from `app_secrets.py` which is a secret file.

## How APIs check the user

Most routers depend on `get_current_user`:

```python
user_info: AuthenticatedUser = Depends(get_current_user)
```

`GET /api/` and `GET /api/exam-list` need a signed in user. Anything admin only checks `user_info.is_admin` in the router and returns 403 otherwise. That covers `POST /api/upload-exam`, `DELETE /api/delete-exam/{exam_id}`, `PATCH /api/update-exam/{exam_id}`, and `GET /api/answers/{exam_id}`.

Results have two shapes. `GET /api/results` returns only the caller rows unless `view=admin` is passed, which needs admin. `GET /api/result/{attempt_id}` adds a username condition for non admin callers, so admins can open any attempt id while candidates get a 404 for attempts that are not theirs. Attempt PDF and paper fetch paths work the same way through `get_valid_exam_id`, which also requires the attempt to belong to the caller and to be unsubmitted and unexpired.

## Code split

Routers in `backend/routers/` parse HTTP input and enforce the admin checks above. They call into `backend/services/` for the real work. `backend/schemas/` validates bodies with pydantic models for auth, catalog items, answers, submitted answers, and results. `backend/database.py` opens the SQLite file at `backend/database.db` and creates the tables `users`, `exam_catalog`, `answers`, `exam_attempts`, and `answer_submissions` if they are missing.

Exam upload validation lives in `backend/services/exam_catalog.py`. It rejects non PDF papers, checks the PDF opens with `pypdf`, requires the CSV row count to match `total_questions`, and requires MCQ rows to carry an option count from 1 to 4 with Descriptive rows left blank. The CSV stores the MCQ answer as a number, and the service maps 1 to 4 to A, B, C, D before insert. PDFs are written to `backend/exams/{exam_id}.pdf` and the path is stored in `exam_catalog`.

## One server or two

`backend/main.py` registers an `APIRouter` with prefix `/api` and includes the auth, catalog, attempt, and results routers. It also defines `/api/health` and `GET /api/`.

Frontend serving is conditional. If `frontend/dist` exists, the app mounts `/assets` from the build output and serves `index.html` at `GET /`:

```python
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
```

That is the path used by `scripts/start_public.sh`, which builds the frontend and runs only uvicorn on port 8000.

Local development uses two servers through `scripts/start_local.sh`: uvicorn with reload in `backend`, and `npm run dev` in `frontend`. `frontend/vite.config.ts` proxies `/api` to `http://127.0.0.1:8000`, so fetch calls keep the same relative URLs in both setups.

## Deployment

The demo runs on an Ubuntu instance on Oracle Cloud Infrastructure, served as a single server on port 8000 through the `start_public.sh` path: the frontend is built once and FastAPI serves the static output alongside `/api`.

Two layers of networking had to allow inbound traffic for that to work. On the Oracle side, the cloud network settings for the instance were opened for the app port. On the instance itself, the Ubuntu firewall was opened for the same port. Without both, the port stayed unreachable from the internet even while the app was listening.

## Attempts, timing, and scoring

`start_exam` in `backend/services/exam_attempt.py` reads the exam duration in minutes, converts it to seconds, and stores `start_time` and `expiry_time` as unix seconds. It takes a write lock with `BEGIN IMMEDIATE` and reuses an open attempt for the same user and exam when one exists. Otherwise it inserts a new row with a uuid attempt id. The response returns `attempt_id`, `current_time`, and `expiry_time`, and the frontend uses those to show the remaining time.

`fetch_exam_pdf` and `get_question_list` only work while `submission_time IS NULL` and the current time is within expiry. Submit allows 20 extra seconds past expiry (grace time). Question metadata excludes `correct_answer`. Submit dedupes by question number, drops blank answers, sets `submission_time`, and inserts into `answer_submissions`. The unique key on `(attempt_id, question_number)` plus the update guard on `submission_time IS NULL` blocks double submit.

Scoring is not done in the request. `backend/scripts/evaluater.py` is a separate script that updates every pending submitted attempt in one SQL statement:

```sql
UPDATE exam_attempts
SET score = (
  SELECT SUM(
    CASE
      WHEN t2.answer = t3.correct_answer THEN t3.correct_score
      ELSE t3.incorrect_score
    END
  )
  FROM answer_submissions t2
  JOIN answers t3
    ON t2.exam_id = t3.exam_id
    AND t2.question_number = t3.question_number
  WHERE t2.attempt_id = exam_attempts.attempt_id
),
evaluation_status = 'evaluated',
evaluation_time = unixepoch()
WHERE evaluation_status = 'pending'
AND submission_time IS NOT NULL;
```

Unanswered questions have no submission row, so they add nothing to the sum. `get_results` only selects rows with `evaluation_status = 'evaluated'`. The detailed result view joins `answers` to `answer_submissions` per attempt and computes per question score, `is_correct`, and `is_attempted` at read time.
