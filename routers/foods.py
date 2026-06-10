from fastapi import APIRouter, Query
from models.db import supabase
from typing import Optional

router = APIRouter(prefix="/api/foods", tags=["Foods"])

@router.get("")
async def get_foods(
    region    : Optional[str] = Query(None),
    diet      : Optional[str] = Query(None),
    meal_type : Optional[str] = Query(None),
    highlight : Optional[str] = Query(None),
    page      : int           = Query(1, ge=1),
    limit     : int           = Query(12, ge=1, le=50),
):
    try:
        query = supabase.table("foods")\
            .select("*")\
            .eq("is_active", True)

        if diet:
            query = query.eq("diet_type", diet)

        # Fetch all then filter arrays in Python
        result = query.execute()
        foods  = result.data

        if region:
            foods = [f for f in foods if region in f.get("regions", [])]
        if meal_type:
            foods = [f for f in foods if meal_type in f.get("meal_type", [])]
        if highlight:
            foods = [f for f in foods if highlight in f.get("highlights", [])]

        # Paginate
        total  = len(foods)
        start  = (page - 1) * limit
        end    = start + limit
        paged  = foods[start:end]

        return {
            "foods"      : paged,
            "total"      : total,
            "page"       : page,
            "total_pages": (total + limit - 1) // limit,
        }

    except Exception as e:
        return {"error": str(e), "foods": []}

from fastapi import APIRouter
from pydantic import BaseModel
from groq import Groq
from config import GROQ_API_KEY

class ChatMessage(BaseModel):
    message: str

@router.post("/chat")
async def chat(data: ChatMessage):
    client = Groq(api_key=GROQ_API_KEY)
    res = client.chat.completions.create(
        model    = "llama-3.1-8b-instant",
        messages = [{
            "role"   : "system",
            "content": """You are NutriBot, a school nutrition assistant 
            for Karnataka schools in India. Answer only about child nutrition,
            Karnataka foods, BMI, and healthy eating. Keep answers under 
            3 sentences. Support both English and Kannada questions."""
        }, {
            "role"   : "user",
            "content": data.message
        }],
        max_tokens  = 150,
        temperature = 0.5,
    )
    return {"reply": res.choices[0].message.content}

@router.get("/impact")
async def impact():
    from models.db import supabase
    plans    = supabase.table("meal_plans").select("id", count="exact").execute()
    students = supabase.table("students").select("id",   count="exact").execute()
    return {
        "total_plans"   : plans.count    or 0,
        "total_students": students.count or 0,
        "total_foods"   : 53,
    }
