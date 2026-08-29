from pydantic import BaseModel, Field

class SignupRequest(BaseModel):
    username: str = Field(min_length=5, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=100)

class SigninRequest(BaseModel):
    username: str
    password: str
