from pydantic import BaseModel, Field

class ExamResult(BaseModel):
    attempt_id: str
    exam_id: str
    name: str = Field(min_length=3, max_length=100)
    exam_type: str = Field(["JEE MAIN", "JEE ADVANCED", "OTHER"], description="Type of the exam")
    description: str = Field(default="", max_length=500)
    duration: int = Field(gt=0)
    total_marks: int = Field(gt=0)
    total_questions: int = Field(gt=0)
    score: int
    submission_time: int

class ExamQuestionResult(BaseModel):
    question_number: int
    correct_answer: str
    submitted_answer: str
    is_correct: bool
    correct_score: int
    incorrect_score: int

class DetailedExamResult(ExamResult):
    question_results: list[ExamQuestionResult]