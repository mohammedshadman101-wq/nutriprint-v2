from fastapi import APIRouter, HTTPException
from models.schemas import MealInput, MealPlan, RegenerateDay
from models.db import supabase
from services.groq_engine import generate_groq_plan
from services.fallback_engine import generate_fallback_plan, DAYS_KN
import json

router = APIRouter(prefix="/api/meal", tags=["Meals"])


@router.post("/generate", response_model=MealPlan)
async def generate_meal(data: MealInput):
    try:
        # Check cache
        cached = supabase.table("meal_plans")\
            .select("*")\
            .eq("age_group", data.age_group.value)\
            .eq("diet_pref", data.diet_pref.value)\
            .eq("region", data.region.value)\
            .eq("month", data.month)\
            .eq("strategy", data.strategy.value)\
            .limit(1)\
            .execute()

        if cached.data:
            row = cached.data[0]
        
            if isinstance(row["plan_json"], str):
                plan_json = json.loads(row["plan_json"])
            else:
                plan_json = row["plan_json"]
        
            plan_json["plan_id"] = str(row["id"])
            plan_json["share_token"] = str(row["share_token"])
        
            plan = MealPlan(**plan_json)
            return plan
    
        # Generate new plan
        plan = generate_groq_plan(
            school_name=data.school_name,
            student_name=data.student_name,
            teacher_name=data.teacher_name or "",
            age_group=data.age_group.value,
            diet_pref=data.diet_pref.value,
            region=data.region.value,
            month=data.month,
            strategy=data.strategy.value,
            bmi_class=data.bmi_class.value if data.bmi_class else None,
            allergies=data.allergies,
        )

        print("PLAN TYPE:", type(plan))
        print("PLAN:", plan)

        insert_data = {
            "student_name": data.student_name,
            "school_name": data.school_name,
            "teacher_name": data.teacher_name,
            "age_group": data.age_group.value,
            "diet_pref": data.diet_pref.value,
            "region": data.region.value,
            "month": data.month,
            "strategy": data.strategy.value,
            "bmi_class": data.bmi_class.value if data.bmi_class else None,
            "allergies": data.allergies,
            "plan_json": plan.dict(),
            "avg_daily_cal": plan.avg_daily_cal,
            "avg_protein_g": plan.avg_protein_g,
            "avg_calcium_mg": plan.avg_calcium_mg,
            "avg_iron_mg": plan.avg_iron_mg,
            "total_cost_inr": plan.total_cost_inr,
            "generated_by": plan.generated_by,
        }

        if data.student_id:
            insert_data["student_id"] = data.student_id

        saved = supabase.table("meal_plans")\
            .insert(insert_data)\
            .execute()

        print("SAVED DATA:", saved.data)

        row = saved.data[0]

        plan.plan_id = str(row["id"])
        plan.share_token = str(row["share_token"])

        return plan

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("MEAL ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
