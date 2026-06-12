import json
import random
from pathlib import Path
from models.schemas import MealPlan, MealDay, MealItem

# Load foods once at startup
FOODS_PATH = Path(__file__).parent.parent / "data" / "foods.json"
with open(FOODS_PATH, encoding="utf-8") as f:
    ALL_FOODS = json.load(f)

DAYS_EN = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
DAYS_KN = {
    "Monday":"ಸೋಮವಾರ","Tuesday":"ಮಂಗಳವಾರ",
    "Wednesday":"ಬುಧವಾರ","Thursday":"ಗುರುವಾರ",
    "Friday":"ಶುಕ್ರವಾರ","Saturday":"ಶನಿವಾರ","Sunday":"ಭಾನುವಾರ"
}

def _filter_foods(region, diet, meal_type, month):
    results = []
    for f in ALL_FOODS:
        if region not in f["regions"]:
            continue
        # diet matching: veg only gets veg; eggetarian gets veg+egg; nonveg gets all
        if diet == "vegetarian" and f["diet_type"] != "vegetarian":
            continue
        if diet == "eggetarian" and f["diet_type"] == "non-vegetarian":
            continue
        # non-vegetarian gets all types — no filter needed
        if meal_type not in f["meal_type"]:
            continue
        if "all" not in f["season_months"] and month.lower() not in f["season_months"]:
            continue
        results.append(f)
    return results

def _to_meal_item(f) -> MealItem:
    return MealItem(
        name_en       = f["name_en"],
        name_kn       = f["name_kn"],
        ingredients   = [f["name_en"]],  # simplified
        calories      = f["calories_per_100g"],
        protein_g     = f["protein_g"],
        calcium_mg    = f["calcium_mg"],
        iron_mg       = f["iron_mg"],
        cost_inr      = f["cost_inr"],
        prep_time_min = f["prep_time_min"],
    )

def generate_fallback_plan(
    school_name  : str,
    student_name : str,
    teacher_name : str,
    age_group    : str,
    diet_pref    : str,
    region       : str,
    month        : str,
    strategy     : str,
    bmi_class    : str = None,
) -> MealPlan:

    breakfasts = _filter_foods(region, diet_pref, "breakfast", month)
    lunches    = _filter_foods(region, diet_pref, "lunch",     month)
    dinners    = _filter_foods(region, diet_pref, "dinner",    month)

    # Fallback to all regions if not enough local foods
    if len(breakfasts) < 7:
        breakfasts += _filter_foods("bengaluru_rural", diet_pref, "breakfast", month)
    if len(lunches) < 7:
        lunches    += _filter_foods("bengaluru_rural", diet_pref, "lunch",     month)
    if len(dinners) < 7:
        dinners    += _filter_foods("bengaluru_rural", diet_pref, "dinner",    month)

    # Shuffle and pick 7 unique per meal type
    random.shuffle(breakfasts)
    random.shuffle(lunches)
    random.shuffle(dinners)

    week = []
    total_cal = total_pro = total_cal_mg = total_iron = total_cost = 0

    for i, day in enumerate(DAYS_EN):
        b = _to_meal_item(breakfasts[i % len(breakfasts)])
        l = _to_meal_item(lunches[i    % len(lunches)])
        d = _to_meal_item(dinners[i    % len(dinners)])

        total_cal   += b.calories  + l.calories  + d.calories
        total_pro   += b.protein_g + l.protein_g + d.protein_g
        total_cal_mg+= b.calcium_mg+ l.calcium_mg+ d.calcium_mg
        total_iron  += b.iron_mg   + l.iron_mg   + d.iron_mg
        total_cost  += b.cost_inr  + l.cost_inr  + d.cost_inr

        week.append(MealDay(
            day       = day,
            day_kn    = DAYS_KN[day],
            breakfast = b,
            lunch     = l,
            dinner    = d,
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
        generated_by   = "fallback",
    )