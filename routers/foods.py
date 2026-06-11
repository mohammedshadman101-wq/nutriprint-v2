import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from groq import Groq

from config import GROQ_API_KEY
from models.db import supabase

router = APIRouter(prefix="/api/foods", tags=["Foods"])


@router.get("")
async def get_foods(
    region: Optional[str] = Query(None),
    diet: Optional[str] = Query(None),
    meal_type: Optional[str] = Query(None),
    highlight: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
):
    try:
        foods_file = Path("data/foods.json")

        with open(foods_file, "r", encoding="utf-8") as f:
            foods = json.load(f)

        if diet:
            foods = [f for f in foods if f.get("diet_type") == diet]

        if region:
            foods = [f for f in foods if region in f.get("regions", [])]
        if meal_type:
            foods = [f for f in foods if meal_type in f.get("meal_type", [])]
        if highlight:
            foods = [f for f in foods if highlight in f.get("highlights", [])]

        total = len(foods)
        start = (page - 1) * limit
        end = start + limit
        paged = foods[start:end]

        return {
            "foods": paged,
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit,
        }

    except Exception as e:
        return {"error": str(e), "foods": []}


class ChatMessage(BaseModel):
    message: str


@router.post("/chat")
async def chat(data: ChatMessage):
    client = Groq(api_key=GROQ_API_KEY)
    res = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are NutriBot, a school nutrition assistant "
                    "for Karnataka schools in India. Answer only about child nutrition, "
                    "Karnataka foods, BMI, and healthy eating. Keep answers under "
                    "3 sentences. Support both English and Kannada questions."
                ),
            },
            {"role": "user", "content": data.message},
        ],
        max_tokens=150,
        temperature=0.5,
    )
    return {"reply": res.choices[0].message.content}


def get_impact_stats() -> dict:
    plans = supabase.table("meal_plans").select("id", count="exact").execute()
    students = supabase.table("students").select("id", count="exact").execute()
    foods_file = Path("data/foods.json")
    with open(foods_file, "r", encoding="utf-8") as f:
        food_count = len(json.load(f))
    return {
        "total_plans": plans.count or 0,
        "total_students": students.count or 0,
        "total_foods": food_count,
    }


@router.get("/impact")
async def impact():
    return get_impact_stats()
