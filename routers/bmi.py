from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import BMIInput, BMIResult
from models.db import supabase
from services.bmi_calculator import calculate_bmi, calculate_nutrition_gap
from services.food_equivalents import get_food_equivalents
from datetime import datetime

router = APIRouter(prefix="/api/bmi", tags=["BMI"])


# ── Calculate BMI ─────────────────────────────────────────
@router.post("/calculate", response_model=BMIResult)
async def bmi_calculate(data: BMIInput):
    try:
        result = calculate_bmi(
            student_name = data.student_name,
            age          = data.age,
            gender       = data.gender.value,
            height_cm    = data.height_cm,
            weight_kg    = data.weight_kg,
        )

        if data.teacher_id:
            supabase.table("bmi_records").insert({
                "student_id"     : data.student_id,
                "teacher_id"     : data.teacher_id,
                "height_cm"      : data.height_cm,
                "weight_kg"      : data.weight_kg,
                "bmi_value"      : result.bmi_value,
                "percentile"     : result.percentile,
                "z_score"        : result.z_score,
                "classification" : result.classification.value,
                "advice_en"      : result.advice_en,
                "advice_kn"      : result.advice_kn,
            }).execute()

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── BMI History ───────────────────────────────────────────
@router.get("/history/{student_id}")
async def bmi_history(student_id: str):
    try:
        result = supabase.table("bmi_records")\
            .select("*")\
            .eq("student_id", student_id)\
            .order("assessed_at", desc=False)\
            .execute()
        return {"history": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Export CSV ────────────────────────────────────────────
@router.get("/export/{teacher_id}")
async def export_csv(teacher_id: str):
    try:
        import csv
        import io

        records = supabase.table("bmi_records")\
            .select("*, students(name, age, gender)")\
            .eq("teacher_id", teacher_id)\
            .order("assessed_at", desc=True)\
            .execute()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Student Name", "Age", "Gender",
            "Height(cm)", "Weight(kg)", "BMI",
            "Percentile", "Classification", "Date"
        ])

        for r in records.data:
            s = r.get("students", {}) or {}
            writer.writerow([
                s.get("name", ""),
                s.get("age", ""),
                s.get("gender", ""),
                r["height_cm"],
                r["weight_kg"],
                r["bmi_value"],
                r["percentile"],
                r["classification"],
                r["assessed_at"][:10],
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type = "text/csv",
            headers    = {
                "Content-Disposition":
                    "attachment; filename=bmi_records.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Nutrition Gap ─────────────────────────────────────────
@router.get("/nutrition-gap")
async def nutrition_gap(plan_id: str, age_group: str):
    try:
        result = supabase.table("meal_plans")\
            .select("plan_json")\
            .eq("id", plan_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="Plan not found"
            )

        plan_json = result.data["plan_json"]
        if isinstance(plan_json, str):
            import json
            plan_json = json.loads(plan_json)

        gaps = calculate_nutrition_gap(plan_json, age_group)
        return {"gaps": gaps, "age_group": age_group}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/food-equivalents")
async def food_equivalents(age_group: str = "9-12"):
    """Practical food serving examples for nutrient targets."""
    return {"equivalents": get_food_equivalents(age_group), "age_group": age_group}


# ── Dashboard Stats ───────────────────────────────────────
@router.get("/dashboard/stats")
async def dashboard_stats(teacher_id: str):
    try:
        teacher = supabase.table("teachers")\
            .select("name, school_name")\
            .eq("id", teacher_id)\
            .single()\
            .execute()

        students = supabase.table("students")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        plans = supabase.table("meal_plans")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        month_start = datetime.now().strftime("%Y-%m-01")
        plans_month = supabase.table("meal_plans")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .gte("created_at", month_start)\
            .execute()

        assessments = supabase.table("bmi_records")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        records = supabase.table("bmi_records")\
            .select("classification")\
            .eq("teacher_id", teacher_id)\
            .execute()

        dist = {}
        for r in records.data:
            c = r["classification"]
            dist[c] = dist.get(c, 0) + 1

        bmi_dist = [
            {"classification": k, "count": v}
            for k, v in dist.items()
        ]

        t = teacher.data or {}
        return {
            "teacher_name"     : t.get("name", ""),
            "school_name"      : t.get("school_name", ""),
            "total_students"   : students.count   or 0,
            "total_plans"      : plans.count      or 0,
            "plans_this_month" : plans_month.count or 0,
            "total_assessments": assessments.count or 0,
            "bmi_distribution" : bmi_dist,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Dashboard Students ────────────────────────────────────
@router.get("/dashboard/students")
async def dashboard_students(teacher_id: str):
    try:
        students = supabase.table("students")\
            .select("*")\
            .eq("teacher_id", teacher_id)\
            .eq("is_active", True)\
            .execute()

        result = []
        for s in students.data:
            latest = supabase.table("bmi_records")\
                .select("bmi_value, classification, assessed_at")\
                .eq("student_id", s["id"])\
                .order("assessed_at", desc=True)\
                .limit(1)\
                .execute()

            rec = latest.data[0] if latest.data else {}
            result.append({
                "id"            : s["id"],
                "name"          : s["name"],
                "age"           : s["age"],
                "gender"        : s["gender"],
                "last_bmi"      : rec.get("bmi_value"),
                "classification": rec.get("classification"),
                "last_assessed" : rec.get("assessed_at", "")[:10]
                                  if rec else None,
            })

        return {"students": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Recent Plans ──────────────────────────────────────────
@router.get("/dashboard/recent-plans")
async def recent_plans(teacher_id: str):
    try:
        plans = supabase.table("meal_plans")\
            .select(
                "student_name, share_token, "
                "region, diet_pref, month"
            )\
            .eq("teacher_id", teacher_id)\
            .order("created_at", desc=True)\
            .limit(5)\
            .execute()
        return {"plans": plans.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Class Progress ────────────────────────────────────────
@router.get("/class-progress")
async def class_progress(teacher_id: str):
    try:
        students = supabase.table("students")\
            .select("id, name, age, gender")\
            .eq("teacher_id", teacher_id)\
            .eq("is_active", True)\
            .execute()

        if not students.data:
            return {
                "error"         : "No students found",
                "total_students": 0,
            }

        records = supabase.table("bmi_records")\
            .select(
                "student_id, bmi_value, "
                "classification, percentile, assessed_at"
            )\
            .eq("teacher_id", teacher_id)\
            .order("assessed_at", desc=True)\
            .execute()

        # Latest record per student only
        seen   = set()
        latest = []
        for r in records.data:
            sid = r["student_id"]
            if sid not in seen:
                seen.add(sid)
                latest.append(r)

        dist = {
            "underweight": 0,
            "normal"     : 0,
            "overweight" : 0,
            "obese"      : 0,
        }
        total_percentile = 0
        assessed_count   = 0

        for r in latest:
            c = r["classification"]
            if c in dist:
                dist[c] += 1
            total_percentile += r.get("percentile", 50)
            assessed_count   += 1

        total_students = len(students.data)

        normal_pct   = (
            dist["normal"] / assessed_count * 100
        ) if assessed_count else 0
        health_score = round(normal_pct / 10, 1)

        avg_percentile = round(
            total_percentile / assessed_count, 1
        ) if assessed_count else 0

        if dist["underweight"] >= dist["overweight"]:
            deficiency = "Iron & Calories 🩸🔥"
            rec_en = "Add Ragi Mudde + Horsegram Saaru to daily lunch."
            rec_kn = "ದಿನದ ಊಟಕ್ಕೆ ರಾಗಿ ಮುದ್ದೆ + ಹುರಳಿ ಸಾರು ಸೇರಿಸಿ."
        else:
            deficiency = "Fiber & Vegetables 🥬"
            rec_en = "Replace fried snacks with seasonal vegetables."
            rec_kn = "ಕರಿದ ತಿಂಡಿ ಬದಲು ತರಕಾರಿ ನೀಡಿ."

        student_map = {s["id"]: s for s in students.data}
        leaderboard = []

        for r in latest:
            s = student_map.get(r["student_id"], {})
            dist_from_normal = abs(
                r.get("percentile", 50) - 50
            )
            leaderboard.append({
                "name"          : s.get("name", "Unknown"),
                "bmi"           : r["bmi_value"],
                "classification": r["classification"],
                "percentile"    : r.get("percentile", 50),
                "health_rank"   : dist_from_normal,
            })

        leaderboard.sort(key=lambda x: x["health_rank"])

        assessed_ids = {r["student_id"] for r in latest}
        not_assessed = [
            s for s in students.data
            if s["id"] not in assessed_ids
        ]

        return {
            "total_students"    : total_students,
            "assessed_count"    : assessed_count,
            "not_assessed"      : len(not_assessed),
            "not_assessed_names": [
                s["name"] for s in not_assessed[:5]
            ],
            "distribution"      : dist,
            "health_score"      : health_score,
            "karnataka_avg"     : 5.8,
            "avg_percentile"    : avg_percentile,
            "deficiency"        : deficiency,
            "recommendation"    : {
                "en": rec_en,
                "kn": rec_kn,
            },
            "top_5"             : leaderboard[:5],
            "needs_attention"   : leaderboard[-5:],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))