import json
from groq import Groq
from config import GROQ_API_KEY
from models.schemas import MealPlan, MealDay, MealItem, AIRecommendation
from services.fallback_engine import generate_fallback_plan, DAYS_KN

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

ICMR_RDA = {
    "5-8":   {"calories": 1350, "protein_g": 20, "calcium_mg": 600, "iron_mg": 13},
    "9-12":  {"calories": 1700, "protein_g": 30, "calcium_mg": 800, "iron_mg": 16},
    "13-15": {"calories": 2100, "protein_g": 45, "calcium_mg": 800, "iron_mg": 22},
}

STRATEGY_NOTES = {
    "standard":      "Balanced macros following ICMR RDA.",
    "high_protein":  "Prioritize high-protein foods like horsegram, eggs, chicken, moong dal. Every meal must exceed 8g protein.",
    "calcium_iron":  "Prioritize calcium and iron rich foods like Ragi Mudde, Drumstick leaves, Palak Dal, Banana flower. Critical for anaemia prevention.",
    "calorie_control":"Use low-calorie high-fiber foods. Avoid ghee-heavy or fried items. Max 400 cal per meal.",
}

def _build_prompt(data: dict) -> str:
    rda = ICMR_RDA.get(data["age_group"], ICMR_RDA["9-12"])
    strategy_note = STRATEGY_NOTES.get(data["strategy"], "")

    return f"""
You are a certified child nutritionist for Karnataka schools, India.
Generate a 7-day weekly meal plan as valid JSON only.

STUDENT PROFILE:
- Age Group: {data['age_group']} years
- Diet: {data['diet_pref']}
- Region: {data['region']} (Karnataka)
- Month: {data['month']} (use seasonal ingredients)
- BMI Classification: {data.get('bmi_class', 'normal')}
- Strategy: {data['strategy']} — {strategy_note}
- Allergies to avoid: {data.get('allergies', [])}
- Teacher-selected AI recommendations to consider: {data.get('ai_recommendations', [])}

ICMR DAILY TARGETS:
- Calories: {rda['calories']} kcal
- Protein: {rda['protein_g']}g
- Calcium: {rda['calcium_mg']}mg
- Iron: {rda['iron_mg']}mg

STRICT RULES:
1. Use ONLY locally available Karnataka foods for {data['region']} region
2. Each meal cost must be under ₹50
3. No meal name repeated more than twice across 7 days
4. Include Kannada name for every meal
5. Seasonal ingredients for {data['month']}
6. All 7 days must be complete with breakfast, lunch, dinner

RESPOND WITH ONLY THIS JSON, NO OTHER TEXT:
{{
  "week": [
    {{
      "day": "Monday",
      "day_kn": "ಸೋಮವಾರ",
      "breakfast": {{
        "name_en": "...",
        "name_kn": "...",
        "ingredients": ["...", "..."],
        "calories": 0,
        "protein_g": 0,
        "calcium_mg": 0,
        "iron_mg": 0,
        "cost_inr": 0,
        "prep_time_min": 0
      }},
      "lunch": {{ same structure }},
      "dinner": {{ same structure }}
    }}
  ]
}}
"""

def generate_groq_plan(
    school_name  : str,
    student_name : str,
    teacher_name : str,
    age_group    : str,
    diet_pref    : str,
    region       : str,
    month        : str,
    strategy     : str,
    bmi_class    : str = None,
    allergies    : list = None,
    ai_recommendations: list = None,
) -> MealPlan:

    if allergies is None:
        allergies = []
    if ai_recommendations is None:
        ai_recommendations = []

    prompt_data = {
        "age_group": age_group,
        "diet_pref": diet_pref,
        "region":    region,
        "month":     month,
        "strategy":  strategy,
        "bmi_class": bmi_class,
        "allergies": allergies,
        "ai_recommendations": ai_recommendations,
    }

    try:
        if client is None:
            raise RuntimeError("GROQ_API_KEY is not configured")
        response = client.chat.completions.create(
            model    = "llama-3.1-8b-instant",
            messages = [{"role": "user", "content": _build_prompt(prompt_data)}],
            max_tokens      = 3000,
            temperature     = 0.4,
            response_format = {"type": "json_object"},
        )

        raw  = response.choices[0].message.content
        data = json.loads(raw)

        # Build MealPlan from Groq response
        week = []
        total_cal = total_pro = total_cal_mg = total_iron = total_cost = 0

        for day_data in data["week"]:
            meals = {}
            for meal_type in ["breakfast", "lunch", "dinner"]:
                m = day_data[meal_type]
                item = MealItem(
                    name_en       = m["name_en"],
                    name_kn       = m["name_kn"],
                    ingredients   = m.get("ingredients", []),
                    calories      = float(m.get("calories", 0)),
                    protein_g     = float(m.get("protein_g", 0)),
                    calcium_mg    = float(m.get("calcium_mg", 0)),
                    iron_mg       = float(m.get("iron_mg", 0)),
                    cost_inr      = float(m.get("cost_inr", 0)),
                    prep_time_min = int(m.get("prep_time_min", 20)),
                )
                meals[meal_type] = item
                total_cal   += item.calories
                total_pro   += item.protein_g
                total_cal_mg+= item.calcium_mg
                total_iron  += item.iron_mg
                total_cost  += item.cost_inr

            week.append(MealDay(
                day       = day_data["day"],
                day_kn    = day_data.get("day_kn", DAYS_KN.get(day_data["day"], "")),
                breakfast = meals["breakfast"],
                lunch     = meals["lunch"],
                dinner    = meals["dinner"],
            ))

        return MealPlan(
            student_name   = student_name,
            school_name    = school_name,
            teacher_name   = teacher_name,
            age_group      = age_group,
            diet_pref      = diet_pref,
            region         = region,
            month          = month,
            strategy       = strategy,
            allergies      = allergies,
            bmi_class      = bmi_class,
            week           = week,
            avg_daily_cal  = round(total_cal   / 7, 1),
            avg_protein_g  = round(total_pro   / 7, 2),
            avg_calcium_mg = round(total_cal_mg/ 7, 1),
            avg_iron_mg    = round(total_iron  / 7, 2),
            total_cost_inr = round(total_cost,  2),
            generated_by   = "groq",
            ai_recommendations = [AIRecommendation(**r) if isinstance(r, dict) else r for r in ai_recommendations],
        )

    except Exception as e:
        print(f"⚠️ Groq failed: {e} — switching to fallback engine")
        plan = generate_fallback_plan(
            school_name, student_name, teacher_name,
            age_group, diet_pref, region, month, strategy, bmi_class
        )
        plan.ai_recommendations = [AIRecommendation(**r) if isinstance(r, dict) else r for r in ai_recommendations]
        return plan


def _advisor_system_prompt() -> str:
    return """
You are NutriPrint Nutrition AI Assistant, a careful child-nutrition co-pilot for Karnataka school teachers.
Scope: nutrition, child health habits, Karnataka foods, portions, hydration, school meal planning, and parent guidance.
Do not diagnose disease or prescribe treatment. For medical red flags, advise consulting a qualified doctor.
Support English and Kannada. Match the teacher's requested language; if auto, use the user's language.
Keep responses practical, low-cost, school-friendly, and culturally relevant to Karnataka.

Return ONLY valid JSON:
{
  "answer": "brief helpful chat answer in English or Kannada",
  "recommendations": [
    {
      "title": "short label",
      "short_action": "imperative poster-ready action, max 12 words",
      "detailed_explanation": "2-4 sentences for the report",
      "parent_guidance": "practical home food or habit suggestion",
      "language": "en or kn"
    }
  ]
}
Give 1-3 recommendations only when the answer contains actionable advice. Otherwise use an empty array.
"""


def _fallback_advisor_response(question: str, language: str) -> dict:
    is_kn = language == "kn" or any("\u0c80" <= ch <= "\u0cff" for ch in question)
    if is_kn:
        return {
            "answer": "AI ಸೇವೆ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ಈ ನಡುವೆ, ಸ್ಥಳೀಯ ಆಹಾರಗಳು, ಸರಿಯಾದ ಪ್ರಮಾಣ, ನೀರಿನ ಸೇವನೆ ಮತ್ತು ನಿಯಮಿತ ಚಟುವಟಿಕೆಗೆ ಗಮನ ಕೊಡಿ.",
            "recommendations": [{
                "title": "ನೀರಿನ ಅಭ್ಯಾಸ",
                "short_action": "ಪ್ರತಿದಿನ ನೀರಿನ ಬಾಟಲಿ ಕಳುಹಿಸಿ",
                "detailed_explanation": "ಮಕ್ಕಳಿಗೆ ಶಾಲೆಯಲ್ಲಿ ನಿಯಮಿತವಾಗಿ ನೀರು ಕುಡಿಯುವ ಅಭ್ಯಾಸ ಅಗತ್ಯ. ಊಟಗಳ ನಡುವೆ ಸಣ್ಣ ಸಿಪ್‌ಗಳು ದೇಹದ ನೀರಿನ ಸಮತೋಲನ ಮತ್ತು ಗಮನ ಕಾಪಾಡಲು ಸಹಾಯ ಮಾಡುತ್ತವೆ.",
                "parent_guidance": "ಮನೆದಿಂದ ತುಂಬಿದ ನೀರಿನ ಬಾಟಲಿ ಕಳುಹಿಸಿ ಮತ್ತು ಸಂಜೆ ಹಿಂತಿರುಗಿದಾಗ ಎಷ್ಟು ಕುಡಿದಿದ್ದಾರೆ ಎಂದು ನೋಡಿ.",
                "language": "kn",
            }],
        }
    return {
        "answer": "The AI service is temporarily unavailable. Meanwhile, focus on local foods, sensible portions, hydration, and regular activity.",
        "recommendations": [{
            "title": "Hydration habit",
            "short_action": "Send a filled water bottle daily",
            "detailed_explanation": "Children need regular water breaks during school. Small sips between classes and meals support hydration and attention.",
            "parent_guidance": "Send a filled bottle from home and check how much was consumed after school.",
            "language": "en",
        }],
    }


def ask_nutrition_advisor(question: str, profile: dict, history: list = None, language: str = "auto") -> dict:
    if history is None:
        history = []

    profile_text = json.dumps(profile, ensure_ascii=False)
    messages = [{"role": "system", "content": _advisor_system_prompt()}]
    messages.append({
        "role": "user",
        "content": f"Student profile JSON:\n{profile_text}\n\nUse this profile automatically in your answer.",
    })
    for item in history[-8:]:
        role = item.get("role", "user") if isinstance(item, dict) else getattr(item, "role", "user")
        content = item.get("content", "") if isinstance(item, dict) else getattr(item, "content", "")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({
        "role": "user",
        "content": f"Language preference: {language}. Teacher question: {question}",
    })

    try:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured")
        if client is None:
            raise RuntimeError("Groq client is not available")
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            max_tokens=900,
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content)
        recommendations = []
        for idx, rec in enumerate(payload.get("recommendations", [])[:3]):
            recommendations.append({
                "id": rec.get("id") or f"ai-{idx + 1}",
                "title": rec.get("title", "Nutrition recommendation"),
                "short_action": rec.get("short_action", rec.get("title", ""))[:120],
                "detailed_explanation": rec.get("detailed_explanation", ""),
                "parent_guidance": rec.get("parent_guidance", ""),
                "language": rec.get("language", "en"),
                "destinations": [],
            })
        return {
            "answer": payload.get("answer", "I can help with nutrition, portions, hydration, and healthy habits."),
            "recommendations": recommendations,
        }
    except Exception as e:
        print(f"⚠️ Advisor Groq failed: {e}")
        fallback = _fallback_advisor_response(question, language)
        for idx, rec in enumerate(fallback["recommendations"]):
            rec["id"] = f"fallback-{idx + 1}"
            rec["destinations"] = []
        return fallback
