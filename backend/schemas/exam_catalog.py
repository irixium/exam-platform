from pydantic import BaseModel, Field

class Answer(BaseModel):
    exam_id: str
    question_number: int
    correct_answer: str

class CatalogItem(BaseModel):
    exam_id: str
    name: str = Field(min_length=3, max_length=100)
    exam_type: str = Field(["JEE MAIN", "JEE ADVANCED", "OTHER"], description="Type of the exam")
    description: str = Field(default="", max_length=500)
    duration: int = Field(gt=0)
    total_marks: int = Field(gt=0)