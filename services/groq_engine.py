import json
from groq import Groq
from config import GROQ_API_KEY
from models.schemas import MealPlan, MealDay, MealItem
from services.fallback_engine import generate_fallback_plan, DAYS_KN

client = Groq(api_key=GROQ_API_KEY)

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
) -> MealPlan:

    if allergies is None:
        allergies = []

    prompt_data = {
        "age_group": age_group,
        "diet_pref": diet_pref,
        "region":    region,
        "month":     month,
        "strategy":  strategy,
        "bmi_class": bmi_class,
        "allergies": allergies,
    }

    try:
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
            bmi_class      = bmi_class,
            week           = week,
            avg_daily_cal  = round(total_cal   / 7, 1),
            avg_protein_g  = round(total_pro   / 7, 2),
            avg_calcium_mg = round(total_cal_mg/ 7, 1),
            avg_iron_mg    = round(total_iron  / 7, 2),
            total_cost_inr = round(total_cost,  2),
            generated_by   = "groq",
        )

    except Exception as e:
        print(f"⚠️ Groq failed: {e} — switching to fallback engine")
        return generate_fallback_plan(
            school_name, student_name, teacher_name,
            age_group, diet_pref, region, month, strategy, bmi_class
        )
