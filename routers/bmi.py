from fastapi import APIRouter, HTTPException
from models.schemas import BMIInput, BMIResult
from models.db import supabase
from services.bmi_calculator import calculate_bmi

router = APIRouter(prefix="/api/bmi", tags=["BMI"])

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

        # Save to Supabase if teacher is logged in
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


@router.get("/export/{teacher_id}")
async def export_csv(teacher_id: str):
    try:
        from fastapi.responses import StreamingResponse
        import csv, io

        records = supabase.table("bmi_records")\
            .select("*, students(name, age, gender)")\
            .eq("teacher_id", teacher_id)\
            .order("assessed_at", desc=True)\
            .execute()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Student Name","Age","Gender","Height(cm)",
            "Weight(kg)","BMI","Percentile","Classification","Date"
        ])

        for r in records.data:
            s = r.get("students", {}) or {}
            writer.writerow([
                s.get("name",""),
                s.get("age",""),
                s.get("gender",""),
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
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bmi_records.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/dashboard/stats")
@router.get("/dashboard/students") # becomes /api/bmi/dashboard/students
@router.get("/dashboard/recent-plans") # becomes /api/bmi/dashboard/recent-plans
async def dashboard_stats(teacher_id: str):
    try:
        # Teacher info
        teacher = supabase.table("teachers")\
            .select("name, school_name")\
            .eq("id", teacher_id)\
            .single().execute()

        # Students count
        students = supabase.table("students")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        # Plans count
        plans = supabase.table("meal_plans")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        # Plans this month
        from datetime import datetime
        month_start = datetime.now().strftime("%Y-%m-01")
        plans_month = supabase.table("meal_plans")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .gte("created_at", month_start)\
            .execute()

        # Assessments count
        assessments = supabase.table("bmi_records")\
            .select("id", count="exact")\
            .eq("teacher_id", teacher_id)\
            .execute()

        # BMI distribution
        records = supabase.table("bmi_records")\
            .select("classification")\
            .eq("teacher_id", teacher_id)\
            .execute()

        dist = {}
        for r in records.data:
            c = r["classification"]
            dist[c] = dist.get(c, 0) + 1

        bmi_dist = [{"classification": k, "count": v}
                    for k, v in dist.items()]

        t = teacher.data or {}
        return {
            "teacher_name"     : t.get("name", ""),
            "school_name"      : t.get("school_name", ""),
            "total_students"   : students.count   or 0,
            "total_plans"      : plans.count       or 0,
            "plans_this_month" : plans_month.count or 0,
            "total_assessments": assessments.count or 0,
            "bmi_distribution" : bmi_dist,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                .limit(1).execute()

            rec = latest.data[0] if latest.data else {}
            result.append({
                "id"            : s["id"],
                "name"          : s["name"],
                "age"           : s["age"],
                "gender"        : s["gender"],
                "last_bmi"      : rec.get("bmi_value"),
                "classification": rec.get("classification"),
                "last_assessed" : rec.get("assessed_at", "")[:10] if rec else None,
            })

        return {"students": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/recent-plans")
async def recent_plans(teacher_id: str):
    try:
        plans = supabase.table("meal_plans")\
            .select("student_name, share_token, region, diet_pref, month")\
            .eq("teacher_id", teacher_id)\
            .order("created_at", desc=True)\
            .limit(5).execute()
        return {"plans": plans.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

ICMR_RDA = {
    "5-8":  {"calories":1350,"protein_g":20,"calcium_mg":600,"iron_mg":13},
    "9-12": {"calories":1700,"protein_g":30,"calcium_mg":800,"iron_mg":16},
    "13-15":{"calories":2100,"protein_g":45,"calcium_mg":800,"iron_mg":22},
}

FIX_FOODS = {
    "calories" : {"en":"Ragi Mudde, Groundnut Laddu, Ghee Rice",
                  "kn":"ರಾಗಿ ಮುದ್ದೆ, ಕಡಲೆಕಾಯಿ ಉಂಡೆ, ತುಪ್ಪದ ಅನ್ನ"},
    "protein_g": {"en":"Horsegram Saaru, Sprouted Moong, Egg Curry",
                  "kn":"ಹುರಳಿ ಸಾರು, ಮೊಳಕೆ ಹೆಸರುಕಾಳು, ಮೊಟ್ಟೆ ಸಾಲನ್"},
    "calcium_mg":{"en":"Drumstick Leaves, Ragi Dosa, Curd Rice",
                  "kn":"ನುಗ್ಗೆ ಸೊಪ್ಪು, ರಾಗಿ ದೋಸೆ, ಮೊಸರು ಅನ್ನ"},
    "iron_mg":   {"en":"Banana Flower Curry, Palak Dal, Methi Paratha",
                  "kn":"ಬಾಳೆ ಹೂವಿನ ಪಲ್ಯ, ಪಾಲಕ್ ಬೇಳೆ, ಮೆಂತ್ಯ ಪರಾಠ"},
}

@router.post("/nutrition-gap")
async def nutrition_gap(plan_id: str, age_group: str):
    from models.db import supabase
    plan = supabase.table("meal_plans")\
        .select("plan_json")\
        .eq("id", plan_id).single().execute()

    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    pj  = plan.data["plan_json"]
    rda = ICMR_RDA.get(age_group, ICMR_RDA["9-12"])

    gaps = []
    nutrients = ["calories","protein_g","calcium_mg","iron_mg"]
    labels    = ["Calories","Protein","Calcium","Iron"]
    units     = ["kcal","g","mg","mg"]

    avg_keys  = ["avg_daily_cal","avg_protein_g","avg_calcium_mg","avg_iron_mg"]

    for i, key in enumerate(nutrients):
        getting = pj.get(avg_keys[i], 0)
        needed  = rda[key]
        gap     = round(needed - getting, 1)
        pct     = round((getting / needed) * 100, 1)
        status  = "🔴 Critical" if pct < 60 else "⚠️ Low" if pct < 85 else "✅ Good"
        gaps.append({
            "nutrient"   : labels[i],
            "unit"       : units[i],
            "getting"    : getting,
            "needed"     : needed,
            "gap"        : gap,
            "percent"    : pct,
            "status"     : status,
            "fix_en"     : FIX_FOODS[key]["en"] if gap > 0 else None,
            "fix_kn"     : FIX_FOODS[key]["kn"] if gap > 0 else None,
        })

    return {"gaps": gaps, "age_group": age_group, "rda": rda}
