import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "database.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)
        conn.execute("""
                    CREATE TABLE IF NOT EXISTS exam_catalog (
                        exam_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        exam_type TEXT NOT NULL,
                        description TEXT,
                        duration INTEGER NOT NULL,
                        total_marks INTEGER NOT NULL,
                        exam_path TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_by TEXT NOT NULL,
                        FOREIGN KEY (created_by) REFERENCES users (id)
                    )
                """)
        conn.execute("""
                    CREATE TABLE IF NOT EXISTS answers (
                        exam_id TEXT NOT NULL,
                        question_number INTEGER NOT NULL,
                        correct_answer TEXT NOT NULL,
                        correct_score INTEGER NOT NULL,
                        incorrect_score INTEGER NOT NULL,
                        FOREIGN KEY (exam_id) REFERENCES exam_catalog (exam_id)
                    )
                """)
        conn.execute("""
                    CREATE TABLE IF NOT EXISTS exam_attempts (
                        exam_id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        start_time TIMESTAMP NOT NULL,
                        expiry_time TIMESTAMP NOT NULL,
                        submission_time TIMESTAMP,
                        evaluation_status TEXT DEFAULT 'pending',
                        evaluation_time TIMESTAMP,
                        score INTEGER,
                        FOREIGN KEY (exam_id) REFERENCES exam_catalog (exam_id),
                        FOREIGN KEY (username) REFERENCES users (username)
                        )
                """)
        conn.execute("""
                    CREATE TABLE IF NOT EXISTS answer_submissions (
                        exam_id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        question_number INTEGER NOT NULL,
                        answer TEXT NOT NULL,
                        FOREIGN KEY (exam_id) REFERENCES exam_catalog (exam_id),
                        FOREIGN KEY (username) REFERENCES users (username)
                    )
                """)