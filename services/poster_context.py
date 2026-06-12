"""
Shared template context helpers for poster and report pages.
"""

from services.bmi_calculator import calculate_nutrition_gap, ICMR_RDA
from services.food_equivalents import get_food_equivalents, estimate_meal_macros
from services.food_images import get_food_icon, NUTRIENT_ICONS


def build_poster_context(plan, share_token: str, base_url: str) -> dict:
    try:
        plan_data = plan.model_dump()
    except AttributeError:
        plan_data = plan.dict()

    age_group = plan_data.get("age_group", "9-12")
    gaps = calculate_nutrition_gap(plan_data, age_group)
    equivalents = get_food_equivalents(age_group)
    ai_recommendations = plan_data.get("ai_recommendations") or []

    def by_destination(destination: str, limit=None):
        items = [
            rec for rec in ai_recommendations
            if destination in (rec.get("destinations") or [])
        ]
        return items[:limit] if limit else items

    def food_icon_lookup(name):
        return get_food_icon(name)

    def meal_macros(meal):
        if hasattr(meal, "model_dump"):
            m = meal.model_dump()
        elif isinstance(meal, dict):
            m = meal
        else:
            m = dict(meal)
        return estimate_meal_macros(m.get("calories", 0), m.get("protein_g", 0))

    return {
        "plan": plan,
        "share_token": share_token,
        "base_url": base_url,
        "nutrition_gaps": gaps,
        "food_equivalents": equivalents,
        "nutrient_icons": NUTRIENT_ICONS,
        "icmr_rda": ICMR_RDA.get(age_group, ICMR_RDA["9-12"]),
        "food_icon_lookup": food_icon_lookup,
        "meal_macros": meal_macros,
        "ai_report_recommendations": by_destination("report"),
        "ai_parent_recommendations": by_destination("parent"),
        "ai_poster_recommendations": by_destination("poster", 5),
    }
