from schemas.auth import SignupRequest, SigninRequest
from fastapi import Request
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from database import get_connection
import uuid

ph = PasswordHasher()

def hashPassword(password: str) -> str:
    return ph.hash(password)


def validateUser(data: SigninRequest):
    username = data.username
    password = data.password
    with get_connection() as conn:
        cursor = conn.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row is None:
            return False
        stored_hashed_password = row[2]
        try:
            ph.verify(stored_hashed_password, password)
            return {"user_id": row[0], "username": row[1]}
        except VerifyMismatchError:
            return False

def addUser(data: SignupRequest):
    username = data.username
    password = data.password
    hashed_password = hashPassword(password)

    with get_connection() as conn:
        cursor = conn.execute("SELECT username FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row is not None:
            return {"message": "User already exists"}
        
        conn.execute("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)", (str(uuid.uuid4()), username, hashed_password))
    return {"message": "User signed up successfully"}


