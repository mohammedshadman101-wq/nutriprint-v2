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