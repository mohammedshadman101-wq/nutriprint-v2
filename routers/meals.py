from fastapi import APIRouter, HTTPException
from models.schemas import MealInput, MealPlan, RegenerateDay
from models.db import supabase
from services.groq_engine import generate_groq_plan
from services.fallback_engine import generate_fallback_plan
from routers.deps import safe_error_detail

import secrets
import json
import traceback

router = APIRouter(prefix="/api/meal", tags=["Meals"])
legacy_router = APIRouter(prefix="/api/meals", tags=["Meals"])


@router.post("/generate", response_model=MealPlan)
async def generate_meal(data: MealInput):
    try:
        # Cache disabled for now to avoid stale student data
        cached = (
            supabase.table("meal_plans")
            .select("*")
            .eq("age_group", data.age_group.value)
            .eq("diet_pref", data.diet_pref.value)
            .eq("region", data.region.value)
            .eq("month", data.month)
            .eq("strategy", data.strategy.value)
            .limit(1)
            .execute()
        )

        # Keep disabled until caching is redesigned
        if False and cached.data:
            row = cached.data[0]

            plan_json = row["plan_json"]

            if isinstance(plan_json, str):
                plan_json = json.loads(plan_json)

            plan_json["plan_id"] = str(row["id"])
            plan_json["share_token"] = str(row["share_token"])

            return MealPlan(**plan_json)

        # Generate fresh plan
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
            ai_recommendations=[
                rec.model_dump() if hasattr(rec, "model_dump") else rec.dict()
                for rec in data.ai_recommendations
            ],
        )

        share_token = secrets.token_urlsafe(16)

        # Pydantic v1/v2 compatibility
        try:
            plan_json = plan.model_dump()
        except AttributeError:
            plan_json = plan.dict()

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
            "plan_json": plan_json,
            "avg_daily_cal": plan.avg_daily_cal,
            "avg_protein_g": plan.avg_protein_g,
            "avg_calcium_mg": plan.avg_calcium_mg,
            "avg_iron_mg": plan.avg_iron_mg,
            "total_cost_inr": plan.total_cost_inr,
            "generated_by": plan.generated_by,
            "share_token": share_token,
        }

        if data.student_id:
            insert_data["student_id"] = data.student_id
        if data.teacher_id:
            insert_data["teacher_id"] = data.teacher_id

        saved = (
            supabase.table("meal_plans")
            .insert(insert_data)
            .execute()
        )

        if not saved.data:
            raise Exception("Database insert failed")

        row = saved.data[0]

        plan.plan_id    = str(row["id"])
        plan.share_token = str(row.get("share_token") or share_token)

        return plan

    except Exception as e:
        traceback.print_exc()
        print("MEAL ERROR (falling back to generated plan):", repr(e))

        # Generate fallback plan gracefully
        try:
            plan = generate_fallback_plan(
                school_name=data.school_name,
                student_name=data.student_name,
                teacher_name=data.teacher_name or "",
                age_group=data.age_group.value,
                diet_pref=data.diet_pref.value,
                region=data.region.value,
                month=data.month,
                strategy=data.strategy.value,
                bmi_class=data.bmi_class.value if data.bmi_class else None,
                ai_recommendations=[
                    rec.model_dump() if hasattr(rec, "model_dump") else rec.dict()
                    for rec in data.ai_recommendations
                ],
            )
            plan.plan_id = "demo-" + secrets.token_hex(4)
            plan.share_token = "demo-" + secrets.token_hex(8)
            return plan
        except Exception as fallback_e:
            print("FALLBACK ERROR:", repr(fallback_e))
            raise HTTPException(
                status_code=500,
                detail=safe_error_detail(e, "Meal plan generation failed"),
            )


@legacy_router.post("/generate", response_model=MealPlan)
async def generate_meal_legacy(data: MealInput):
    return await generate_meal(data)


@router.patch("/{plan_id}/day")
async def regenerate_day(plan_id: str, data: RegenerateDay):
    try:
        result = (
            supabase.table("meal_plans")
            .select("*")
            .eq("id", plan_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Plan not found")

        row = result.data
        plan_json = row["plan_json"]
        if isinstance(plan_json, str):
            plan_json = json.loads(plan_json)

        fallback = generate_fallback_plan(
            school_name=row.get("school_name", ""),
            student_name=row.get("student_name", "Student"),
            teacher_name=row.get("teacher_name", ""),
            age_group=row.get("age_group", "9-12"),
            diet_pref=row.get("diet_pref", "vegetarian"),
            region=row.get("region", "mangalore"),
            month=row.get("month", "january"),
            strategy=row.get("strategy", "standard"),
            bmi_class=row.get("bmi_class"),
        )

        new_day = next(
            (d for d in fallback.week if d.day == data.day_name),
            None,
        )
        if not new_day:
            raise HTTPException(status_code=400, detail="Invalid day name")

        for i, day in enumerate(plan_json.get("week", [])):
            if day.get("day") == data.day_name:
                try:
                    plan_json["week"][i] = new_day.model_dump()
                except AttributeError:
                    plan_json["week"][i] = new_day.dict()
                break
        else:
            raise HTTPException(status_code=400, detail="Day not found in plan")

        supabase.table("meal_plans").update(
            {"plan_json": plan_json}
        ).eq("id", plan_id).execute()

        try:
            day_payload = new_day.model_dump()
        except AttributeError:
            day_payload = new_day.dict()

        return {"day": day_payload}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_detail(e))


@router.get("/by-token/{share_token}", response_model=MealPlan)
async def get_plan_by_token(share_token: str):
    """Fetch a saved meal plan by share token (for page refresh restoration)."""
    try:
        result = (
            supabase.table("meal_plans")
            .select("*")
            .eq("share_token", share_token)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Plan not found")

        row = result.data
        plan_json = row.get("plan_json", {})
        if isinstance(plan_json, str):
            plan_json = json.loads(plan_json)

        plan_json.pop("plan_id", None)
        plan_json.pop("share_token", None)
        plan_json["plan_id"] = str(row["id"])
        plan_json["share_token"] = str(row["share_token"])

        return MealPlan(**plan_json)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_detail(e))
