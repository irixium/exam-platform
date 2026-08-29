from schemas.auth import SignupRequest, SigninRequest
from fastapi import Request
from argon2 import PasswordHasher

def hashPassword(password: str) -> str:
    ph = PasswordHasher()
    return ph.hash(password)


def validateUser(data: SigninRequest):
    username = data.username
    password = data.password
    hashed_password = hashPassword(password)
    return username in users_db and users_db[username] == hashed_password

def addUser(data: SignupRequest):
    username = data.username
    password = data.password
    hashed_password = hashPassword(password)
    users_db[username] = hashed_password
    return {"message": "User signed up successfully"}


