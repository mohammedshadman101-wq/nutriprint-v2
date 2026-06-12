"""
Food quantity → nutrient mapping for practical serving examples.
Used in printable reports, meal summaries, and nutrition gap UI.
"""

from services.bmi_calculator import ICMR_RDA

# Per-serving nutrient values for common Karnataka foods
FOOD_SERVINGS = {
    "protein_g": [
        {"name": "Egg", "serving": "1 Egg", "amount": 6, "icon": "egg"},
        {"name": "Chicken Breast", "serving": "100g Chicken Breast", "amount": 31, "icon": "chicken"},
        {"name": "Toor Dal", "serving": "1 Cup Dal", "amount": 18, "icon": "dal"},
        {"name": "Paneer", "serving": "100g Paneer", "amount": 18, "icon": "paneer"},
        {"name": "Moong Sprouts", "serving": "1 Cup Sprouts", "amount": 7, "icon": "vegetables"},
        {"name": "Fish", "serving": "100g Fish", "amount": 22, "icon": "fish"},
    ],
    "carbs_g": [
        {"name": "Rice", "serving": "1 Cup Rice", "amount": 45, "icon": "rice"},
        {"name": "Chapati", "serving": "2 Chapati", "amount": 30, "icon": "rice"},
        {"name": "Ragi Mudde", "serving": "1 Ragi Mudde", "amount": 35, "icon": "rice"},
        {"name": "Banana", "serving": "1 Banana", "amount": 27, "icon": "fruits"},
        {"name": "Jowar Roti", "serving": "2 Jowar Roti", "amount": 40, "icon": "rice"},
    ],
    "fat_g": [
        {"name": "Groundnuts", "serving": "30g Nuts", "amount": 15, "icon": "nuts"},
        {"name": "Ghee", "serving": "1 tbsp Ghee", "amount": 14, "icon": "milk"},
        {"name": "Coconut", "serving": "2 tbsp Coconut", "amount": 10, "icon": "fruits"},
        {"name": "Paneer", "serving": "100g Paneer", "amount": 20, "icon": "paneer"},
        {"name": "Full Cream Milk", "serving": "1 Cup Milk", "amount": 8, "icon": "milk"},
    ],
    "fiber_g": [
        {"name": "Ragi", "serving": "1 Ragi Mudde", "amount": 4, "icon": "rice"},
        {"name": "Vegetables", "serving": "1 Cup Mixed Veg", "amount": 5, "icon": "vegetables"},
        {"name": "Fruits", "serving": "1 Apple/Banana", "amount": 3, "icon": "fruits"},
        {"name": "Dal", "serving": "1 Cup Dal", "amount": 8, "icon": "dal"},
        {"name": "Jowar Roti", "serving": "2 Jowar Roti", "amount": 4, "icon": "rice"},
    ],
}

NUTRIENT_LABELS = {
    "protein_g": {"label": "Protein", "unit": "g", "icon": "💪"},
    "carbs_g": {"label": "Carbohydrates", "unit": "g", "icon": "🍚"},
    "fat_g": {"label": "Fats", "unit": "g", "icon": "🥑"},
    "fiber_g": {"label": "Fiber", "unit": "g", "icon": "🌿"},
}

# ICMR fiber targets by age (not in ICMR_RDA dict)
FIBER_RDA = {"5-8": 15, "9-12": 20, "13-15": 25}

# Estimated daily fat target (~30% of calories)
FAT_RDA = {"5-8": 45, "9-12": 57, "13-15": 70}

# Estimated daily carbs (~55% of calories)
CARBS_RDA = {"5-8": 185, "9-12": 233, "13-15": 288}


def _suggest_combination(foods: list, target: float, nutrient_key: str) -> list:
    """Greedy combination to reach ~target nutrient amount."""
    if target <= 0:
        return []

    combo = []
    remaining = target
    sorted_foods = sorted(foods, key=lambda f: f["amount"], reverse=True)

    for food in sorted_foods:
        if remaining <= 0:
            break
        count = max(1, round(remaining / food["amount"]))
        if count > 4:
            count = min(count, 3)
        combo.append({
            "serving": food["serving"],
            "name": food["name"],
            "icon": food["icon"],
            "count": count,
            "total": round(count * food["amount"], 1),
        })
        remaining -= count * food["amount"]
        if len(combo) >= 3:
            break

    return combo


def get_nutrient_targets(age_group: str) -> dict:
    rda = ICMR_RDA.get(age_group, ICMR_RDA["9-12"])
    return {
        "protein_g": rda["protein_g"],
        "carbs_g": CARBS_RDA.get(age_group, CARBS_RDA["9-12"]),
        "fat_g": FAT_RDA.get(age_group, FAT_RDA["9-12"]),
        "fiber_g": FIBER_RDA.get(age_group, FIBER_RDA["9-12"]),
    }


def get_food_equivalents(age_group: str) -> list:
    """Return food equivalent blocks for protein, carbs, fats, fiber."""
    targets = get_nutrient_targets(age_group)
    results = []

    for key in ("protein_g", "carbs_g", "fat_g", "fiber_g"):
        foods = FOOD_SERVINGS[key]
        target = targets[key]
        meta = NUTRIENT_LABELS[key]

        examples = [
            {
                "serving": f["serving"],
                "name": f["name"],
                "amount": f["amount"],
                "icon": f["icon"],
                "display": f"{f['serving']} = {f['amount']}{meta['unit']} {meta['label']}",
            }
            for f in foods[:4]
        ]

        combo = _suggest_combination(foods, target, key)

        results.append({
            "nutrient": meta["label"],
            "key": key,
            "unit": meta["unit"],
            "icon": meta["icon"],
            "target": target,
            "examples": examples,
            "suggested_combo": combo,
        })

    return results


def estimate_meal_macros(calories: float, protein_g: float) -> dict:
    """Estimate carbs and fat when not stored in meal data."""
    protein_cal = protein_g * 4
    remaining = max(0, calories - protein_cal)
    carbs_g = round(remaining * 0.55 / 4, 1)
    fat_g = round(remaining * 0.45 / 9, 1)
    fiber_g = round(carbs_g * 0.12, 1)
    return {"carbs_g": carbs_g, "fat_g": fat_g, "fiber_g": fiber_g}
