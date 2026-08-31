from pydantic import BaseModel, Field

class Question(BaseModel):
    question_id: str
    exam_id: str
    question_number: int
    question_subject: str
    question_text: str
    options: str  # JSON string of options
    correct_answer: str

class CatalogItem(BaseModel):
    exam_id: str
    name: str = Field(min_length=3, max_length=100)
    exam_type: str = Field(["JEE MAIN", "JEE ADVANCED", "OTHER"], description="Type of the exam")
    description: str = Field(default="", max_length=500)
    duration: int = Field(gt=0)
    total_marks: int = Field(gt=0)
    state: str = Field(["DRAFT", "PUBLISHED"], description="State of the exam")
    created_at: str  # ISO format date string
    updated_at: str  # ISO format date string