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
                        FOREIGN KEY (exam_id) REFERENCES exam_catalog (exam_id)
                    )
                """)