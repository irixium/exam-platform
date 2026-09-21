# Backend design

Low level reference for the FastAPI backend: storage, endpoints, services, auth, and the attempt lifecycle. For the narrative version, see `technical-details.md`. For what the app does, see `README.md`.

Code lives in `backend/`. App setup is `backend/main.py`. HTTP wiring is `backend/routers/`, database access and exam rules are `backend/services/`, and request validation is `backend/schemas/`. SQLite setup is `backend/database.py`. PDFs are stored on disk under `backend/exams/`, named `{exam_id}.pdf`.

## Storage

SQLite file at `backend/database.db`, opened per operation through `get_connection()` in `backend/database.py`. `init_db()` runs on import in `main.py` and creates tables with `CREATE TABLE IF NOT EXISTS`. There are no migrations. Foreign keys are declared in the DDL below.

### users

| Column | Type | Notes |
|---|---|---|
| id | TEXT PRIMARY KEY | uuid4 assigned at signup |
| username | TEXT UNIQUE NOT NULL | 5 to 20 chars, letters, numbers, underscore |
| password_hash | TEXT NOT NULL | argon2 hash, never plain text |

### exam_catalog

| Column | Type | Notes |
|---|---|---|
| exam_id | TEXT PRIMARY KEY | uuid4 assigned at upload |
| name | TEXT NOT NULL | 3 to 100 chars |
| exam_type | TEXT NOT NULL | JEE MAIN, JEE ADVANCED, or OTHER |
| description | TEXT | defaults to empty, max 500 chars |
| duration | INTEGER NOT NULL | minutes, positive |
| total_marks | INTEGER NOT NULL | positive |
| total_questions | INTEGER NOT NULL | positive, must equal CSV row count |
| exam_path | TEXT NOT NULL | disk path of the PDF |
| created_at | TIMESTAMP | defaults to CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | defaults to CURRENT_TIMESTAMP, refreshed on update |
| created_by | TEXT NOT NULL | username, references users(username) |
| updated_by | TEXT NOT NULL | username, references users(username) |

### answers

One row per question. Composite primary key on `(exam_id, question_number)`.

| Column | Type | Notes |
|---|---|---|
| exam_id | TEXT NOT NULL | references exam_catalog(exam_id) |
| question_number | INTEGER NOT NULL | positive, ordered for display |
| correct_answer | TEXT NOT NULL | letter A to D for MCQ, free text for Descriptive |
| correct_score | INTEGER NOT NULL | points when correct |
| incorrect_score | INTEGER NOT NULL | points when wrong, usually negative or zero |
| question_type | TEXT NOT NULL | MCQ or Descriptive, enforced by CHECK |
| option_count | INTEGER | 1 to 4 for MCQ, NULL for Descriptive |

### exam_attempts

| Column | Type | Notes |
|---|---|---|
| attempt_id | TEXT PRIMARY KEY | uuid4 assigned at start |
| exam_id | TEXT NOT NULL | references exam_catalog(exam_id) |
| username | TEXT NOT NULL | references users(username) |
| start_time | TIMESTAMP NOT NULL | unix seconds, server clock |
| expiry_time | TIMESTAMP NOT NULL | start plus duration in seconds |
| submission_time | TIMESTAMP | NULL until submit, unix seconds |
| evaluation_status | TEXT | pending or evaluated, defaults to pending, enforced by CHECK |
| evaluation_time | TIMESTAMP | set by the evaluator script |
| score | INTEGER | NULL until evaluated |

### answer_submissions

| Column | Type | Notes |
|---|---|---|
| attempt_id | TEXT NOT NULL | no separate PK, uniqueness comes from the constraint below |
| exam_id | TEXT NOT NULL | references exam_catalog(exam_id) |
| username | TEXT NOT NULL | references users(username) |
| question_number | INTEGER NOT NULL | |
| answer | TEXT NOT NULL | letter for MCQ, free text for Descriptive |

Unique constraint on `(attempt_id, question_number)`. One stored answer per question per attempt.

## Auth

Signup hashes the password with argon2 `PasswordHasher` and inserts into `users`. Duplicate usernames return 409. Signin looks up the row by username and verifies with `ph.verify`; a missing user and a bad password both return 401 with the same message.

Sessions use Starlette `SessionMiddleware` with the secret in `backend/app_secrets.py`. Signin stores `request.session["user_id"]`. Signout clears the session. There is no session table. `get_current_user` in `backend/services/auth.py` reads the session user id, selects the username from `users`, and returns `AuthenticatedUser(username, is_admin)` where `is_admin` is membership in the `admins` set in `app_secrets.py`. Missing or unknown session ids return 401.

## API reference

All paths below sit under `/api` through the `api_router` in `main.py`. `GET /api/health` is public. Everything else needs a signed in user through `Depends(get_current_user)`, and admin routes additionally check `is_admin` and return 403.

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| POST | /api/signup | public | SignupRequest JSON | 201 message, 409 if username taken |
| POST | /api/signin | public | SigninRequest JSON | message, sets session cookie, 401 on bad credentials |
| POST | /api/signout | signed in | none | message, clears session |
| GET | /api/ | signed in | none | welcome message, username, is_admin |
| GET | /api/health | public | none | status ok |
| POST | /api/upload-exam | admin | multipart form: name, exam_type, description, duration, total_marks, total_questions, exam_doc PDF, key_csv CSV | message, exam_id, parsed answers |
| GET | /api/exam-list | signed in | none | list of CatalogItem |
| PATCH | /api/update-exam/{exam_id} | admin | ExamUpdateRequest JSON | message |
| DELETE | /api/delete-exam/{exam_id} | admin | none | message, deletes answer rows, catalog row, and PDF |
| GET | /api/answers/{exam_id} | admin | none | list of Answer with correct answers |
| POST | /api/start-exam/{exam_id} | signed in | none | attempt_id, current_time, expiry_time |
| GET | /api/fetch_exam/{attempt_id} | owner | none | PDF file, only while unsubmitted and unexpired |
| GET | /api/question-list/{attempt_id} | owner | none | question metadata without correct answers |
| POST | /api/submit-exam/{attempt_id} | owner | list of SubmittedAnswer | none, 404 if already submitted, 400 if past expiry plus grace |
| GET | /api/results | signed in | optional query view=admin | evaluated attempts, own only unless view=admin by an admin |
| GET | /api/result/{attempt_id} | owner or admin | none | DetailedExamResult with per question scoring |
| GET | /api/result/fetch_exam/{attempt_id} | owner or admin | none | PDF file, only for submitted attempts |

Owner means the attempt username must match the caller, enforced in SQL by `get_valid_exam_id` and in the results queries by a username condition for non admins.

## Services

### exam_catalog.py

`parse_catalog_item` reads the multipart form fields into an `ExamUploadRequest`. `upload` validates the PDF content type, parses it with `pypdf` to reject corrupt files, and requires the CSV filename to end in `.csv`. It decodes the CSV as UTF-8, parses with `csv.DictReader`, and rejects the upload when row count differs from `total_questions`. Each row becomes an `Answer`. MCQ rows need `option_count` in 1 to 4 and the CSV answer number is mapped to a letter with `{1: A, 2: B, 3: C, 4: D}`. Descriptive rows must leave `option_count` blank. The PDF is written to `exams/{exam_id}.pdf` first, then the catalog row and answer rows are inserted. If the database insert fails, the written PDF is removed.

`update` builds a dynamic UPDATE over the provided metadata fields plus `updated_at` and `updated_by`, then updates each answer row matched on `(exam_id, question_number)`. It applies the same MCQ letter mapping and option count checks as upload, and rejects answers whose `exam_id` does not match the path. `remove` deletes answer rows and the catalog row, then deletes the PDF from disk. `get_answers` returns stored answers including correct letters, admin only. `get_catalog_items` returns exam metadata without answers.

### exam_attempt.py

`start_exam` reads the exam duration, opens a write transaction with `BEGIN IMMEDIATE`, and looks for an existing open attempt for the same user and exam with `submission_time IS NULL` and `expiry_time` in the future. If one exists, it rolls back and returns the same `attempt_id` with fresh `current_time`. Otherwise it inserts a new attempt with `expiry_time` equal to start plus duration in seconds. The lock plus the recheck makes double clicks and concurrent starts return one attempt instead of creating two.

`get_valid_exam_id` is the shared guard for fetch, question list, and submit. It requires the attempt to belong to the caller and to be unsubmitted, and requires current server time to be within `expiry_time` plus an optional grace. Submit passes 20 seconds of grace for network delay. Anything else fails closed with 404 for unknown or already submitted attempts and 400 for expired ones.

`get_question_list` returns `ExamQuestionMetadata` rows ordered by question number. Correct answers are never selected, so they never reach the browser. `submit_exam` dedupes by question number, drops blank answers, sets `submission_time` with a guarded UPDATE that only matches unsubmitted rows, and inserts the answers. The guarded update plus the unique constraint on `(attempt_id, question_number)` makes repeat submits fail instead of double counting.

### results.py

`get_results` joins `exam_catalog` to `exam_attempts` and returns only rows with `evaluation_status` equal to evaluated. Non admin callers get a username filter. `get_attempt_result` fetches the attempt header with the same owner check, then left joins `answers` to `answer_submissions` on the attempt id and computes per question `score`, `is_correct`, and `is_attempted` with CASE expressions at read time. `fetch_exam_pdf` serves the stored PDF only for submitted attempts, owner checked.

### evaluater.py

Standalone script in `backend/scripts/`, run separately after submissions. One UPDATE marks every pending submitted attempt as evaluated and sets its total with a correlated SUM over the joined submissions:

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

Unanswered questions have no submission row and contribute nothing. Attempts stay invisible in results until this script runs.

## Attempt lifecycle

Start creates a row with status pending and no submission time. Fetch and question list work while the attempt is open. Submit records `submission_time` and answer rows, still pending. The evaluator script scores and flips status to evaluated. Results endpoints only read evaluated rows, so scoring delay never shows partial data.

## Validation and errors

Pydantic schemas reject bad shapes before services run: username 5 to 20 chars of letters, numbers, underscore; password 8 to 100 chars; exam name 3 to 100 chars; description max 500; duration, marks, and question counts positive; `option_count` positive when present. Question type values are enforced by the CHECK constraint in SQLite and by explicit checks in the catalog service, which return 400 with a plain detail message. Auth failures return 401, admin only routes return 403, missing exams or attempts return 404, and expired submits return 400. Unhandled exceptions are caught by the handler in `main.py` and returned as 500 with a generic detail message.

## Mounting and processes

`main.py` creates the FastAPI app, adds `SessionMiddleware`, registers the exception handler, and includes the four routers under `/api`. When `frontend/dist` exists, `/assets` is served from the build output and `GET /` returns `index.html`. Local work runs two processes through `scripts/start_local.sh` with the Vite proxy forwarding `/api` to port 8000. Public serving builds once and runs only uvicorn through `scripts/start_public.sh`. The live instance follows the single server path on an Oracle Cloud Ubuntu host, with inbound opened on the app port at both the cloud network level and the host firewall.
