# Test-Taking Application — High-Level Design

## 1. Scope

A simple web application for administering and taking MCQ-based tests.

- Admin uploads question papers as CSV files.
- Users log in and view available tests.
- Users can start, complete, and submit tests.
- Backend controls exam timing and scoring.
- Users can view their previous attempts and results.
- Initial deployment target: **local development**.
- Database: **SQLite** via SQLAlchemy.
- Future deployment can move to PostgreSQL/cloud hosting without major application changes.

---

## 2. Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- CSV parsing using Python's standard CSV tooling
- Password hashing using a suitable password-hashing library

### Frontend
- HTML
- CSS
- Vanilla JavaScript where required
- Browser `localStorage` for temporary answer persistence

### Future
- PostgreSQL
- Cloud deployment
- Object/file storage if required
- Authentication/proctoring enhancements

---

# 3. UI

## Login

- Username/password login.
- Clear error for invalid credentials.
- Successful login takes the user to the test library.
- No registration flow in the initial version; users can be created by the admin/backend.

## Test Library

Displays available tests.

Each test shows, where applicable:

- Test name
- Duration
- Number of questions
- Previous attempt information
- Best/previous score

Actions:

- **Start Test**
- View previous results

## Start Test

Before starting:

- Show test name.
- Show duration.
- Clearly state that the timer cannot be paused.
- Require confirmation before starting.

On confirmation:

- Backend creates a new exam attempt.
- Backend records the server-side start time.
- Frontend loads the questions and starts the displayed timer.

## Exam / Paper

- Display one or more questions at a time.
- Four options per question.
- Allow users to navigate between questions.
- Show answered/unanswered state.
- Display remaining time.
- Allow submission before the timer expires.

Answers:

- Stored in browser state/localStorage during the exam.
- Restored after a browser refresh/crash where possible.
- Correct answers are **never sent to the browser**.

## Results

Users can view:

- Past attempts
- Test name
- Attempt date
- Score
- Percentage
- Per-question result
- Selected answer
- Correct answer

---

# 4. Backend

## Authentication

- Authenticate users using username/password.
- Passwords are **never stored in plaintext**.
- Store a secure password hash.
- Authenticated requests identify the current user.

## Paper Upload

Admin can upload a CSV containing:

```text
question
option_a
option_b
option_c
option_d
correct_option
```

Backend:

- Parses the CSV.
- Validates required fields.
- Validates correct-option values.
- Creates the test and its questions.
- Rejects invalid uploads rather than partially importing them.

The correct answers remain server-side.

## Exam Attempts

Starting a test creates a new attempt.

The backend records:

- Attempt ID
- User ID
- Test ID
- Start timestamp
- Submission timestamp
- Answers
- Attempt status

Possible statuses:

```text
IN_PROGRESS
SUBMITTED
EXPIRED
```

Each attempt is independent.

## Time Validation

The backend is the authority for exam duration.

On start:

```text
started_at = server timestamp
```

On submission:

```text
submitted_at = server timestamp
```

The backend determines validity using:

```text
submitted_at - started_at <= test duration
```

The browser's clock/timer is **not trusted**.

The browser timer is only for displaying the remaining time to the user.

## Scoring

On submission:

- Backend retrieves the correct answers for the test.
- Compares submitted answers against correct answers.
- Calculates the final score.
- Stores the result.
- Marks the attempt as submitted.

Users cannot submit modified scores or correct answers from the frontend.

---

# 5. Database

Keep the initial schema minimal.

### `users`

- `id`
- `username`
- `password_hash`

### `exam_attempts`

- `id`
- `user_id`
- `paper_id`
- `started_at`
- `submitted_at`
- `status`
- `answers` — JSON

### `results`

- `id`
- `attempt_id`
- `score`
- `question_results` — JSON

The paper/question data can be represented separately as needed by the implementation, but the initial design should avoid unnecessary database complexity.

---

# 6. Basic Request Flow

```text
Login
  ↓
Test Library
  ↓
Select Test
  ↓
Confirm Start
  ↓
POST /attempts
  ↓
Backend records start time
  ↓
Load questions
  ↓
Take Test
  ↓
Submit
  ↓
Backend records current server time
  ↓
Validate duration
  ↓
Score
  ↓
Store result
  ↓
Results page
```

---

# 7. Out of Scope for V1

The design should leave room for, but not implement initially:

- Cloud deployment
- PostgreSQL migration
- Object storage for uploaded papers
- Admin web interface
- Multiple question types
- Negative marking/custom scoring rules
- Test scheduling
- Test availability windows
- Browser full-screen enforcement
- Tab/window switching detection
- Away-from-screen monitoring
- Webcam-based proctoring
- Detailed anti-cheating/proctoring rules
- Advanced analytics
- Email notifications
- Multiple administrators
- Mobile-specific UI

The application should be structured so these can be added without changing the core exam/attempt model.
