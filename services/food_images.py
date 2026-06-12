"""
Food image/icon lookup with graceful emoji fallback.
"""

# Keyword → icon file slug mapping
FOOD_ICON_MAP = {
    "egg": "egg",
    "mutte": "egg",
    "chicken": "chicken",
    "koli": "chicken",
    "fish": "fish",
    "meen": "fish",
    "rice": "rice",
    "anna": "rice",
    "chapati": "rice",
    "rotti": "rice",
    "dosa": "rice",
    "mudde": "rice",
    "ragi": "rice",
    "jowar": "rice",
    "banana": "fruits",
    "apple": "fruits",
    "mango": "fruits",
    "fruit": "fruits",
    "papaya": "fruits",
    "vegetable": "vegetables",
    "palak": "vegetables",
    "drumstick": "vegetables",
    "methi": "vegetables",
    "soppu": "vegetables",
    "dal": "dal",
    "saaru": "dal",
    "bele": "dal",
    "paneer": "paneer",
    "milk": "milk",
    "curd": "milk",
    "mosaru": "milk",
    "nut": "nuts",
    "groundnut": "nuts",
    "kadlekai": "nuts",
    "laddu": "nuts",
}

FOOD_EMOJI = {
    "egg": "🥚",
    "chicken": "🍗",
    "fish": "🐟",
    "rice": "🍚",
    "fruits": "🍎",
    "vegetables": "🥦",
    "dal": "🫘",
    "paneer": "🧀",
    "milk": "🥛",
    "nuts": "🥜",
    "default": "🥗",
}

NUTRIENT_ICONS = {
    "calories": "🔥",
    "protein": "💪",
    "protein_g": "💪",
    "carbs": "🍚",
    "carbs_g": "🍚",
    "fat": "🥑",
    "fat_g": "🥑",
    "fiber": "🌿",
    "fiber_g": "🌿",
    "calcium": "🦴",
    "calcium_mg": "🦴",
    "iron": "🩸",
    "iron_mg": "🩸",
}


def _match_icon_slug(text: str) -> str:
    lower = text.lower()
    for keyword, slug in FOOD_ICON_MAP.items():
        if keyword in lower:
            return slug
    return "default"


def get_food_icon(name: str) -> dict:
    """Return image URL and emoji fallback for a food name."""
    slug = _match_icon_slug(name)
    if slug == "default":
        return {
            "slug": slug,
            "url": None,
            "emoji": FOOD_EMOJI["default"],
        }
    return {
        "slug": slug,
        "url": f"/static/images/foods/{slug}.svg",
        "emoji": FOOD_EMOJI.get(slug, FOOD_EMOJI["default"]),
    }


def get_nutrient_icon(key: str) -> str:
    return NUTRIENT_ICONS.get(key, "📊")


def enrich_meal_with_icon(meal: dict) -> dict:
    """Add icon data to a meal item dict."""
    icon = get_food_icon(meal.get("name_en", ""))
    meal = dict(meal)
    meal["food_icon"] = icon
    return meal
