from fastapi import APIRouter, HTTPException

from models.schemas import AIAdvisorRequest, AIAdvisorResponse
from services.groq_engine import ask_nutrition_advisor

router = APIRouter(prefix="/api/ai-advisor", tags=["AI Advisor"])


@router.post("/chat", response_model=AIAdvisorResponse)
async def chat_with_advisor(data: AIAdvisorRequest):
    try:
        try:
            profile = data.profile.model_dump()
        except AttributeError:
            profile = data.profile.dict()

        history = []
        for item in data.history:
            try:
                history.append(item.model_dump())
            except AttributeError:
                history.append(item.dict())

        result = ask_nutrition_advisor(
            question=data.question,
            profile=profile,
            history=history,
            language=data.language,
        )
        return AIAdvisorResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
