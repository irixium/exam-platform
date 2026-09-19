from pydantic import BaseModel, Field

class ExamResult(BaseModel):
    username: str
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
    answer: str | None
    correct_answer: str
    correct_score: int
    incorrect_score: int
    question_type: str
    option_count: int | None
    score: int
    is_correct: bool
    is_attempted: bool
    


class DetailedExamResult(ExamResult):
    question_results: list[ExamQuestionResult]

