from pydantic import BaseModel, Field

class Answer(BaseModel):
    exam_id: str
    question_number: int
    correct_answer: str
    correct_score: int
    incorrect_score: int
    question_type: str = Field(["MCQ", "Descriptive"], description="Type of the question")
    option_count: int | None = Field(default=None, gt=0)

class ExamUploadRequest(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    exam_type: str = Field(["JEE MAIN", "JEE ADVANCED", "OTHER"], description="Type of the exam")
    description: str = Field(default="", max_length=500)
    duration: int = Field(gt=0)
    total_marks: int = Field(gt=0)
    total_questions: int = Field(gt=0)

class CatalogItem(ExamUploadRequest):
    exam_id: str

class ExamUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=100)
    exam_type: str | None = Field(default=None, description="Type of the exam")
    description: str | None = Field(default=None, max_length=500)
    duration: int | None = Field(default=None, gt=0)
    answers: list[Answer] | None = Field(default=None)