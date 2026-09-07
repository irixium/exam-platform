from pydantic import BaseModel, Field

class SubmittedAnswer(BaseModel):
    question_number: int
    answer: str
class ExamQuestionMetadata(BaseModel):
    exam_id: str
    question_number: int
    correct_score: int
    incorrect_score: int
    question_type: str = Field(["MCQ", "Descriptive"], description="Type of the question")
    option_count: int = Field(gt=0)