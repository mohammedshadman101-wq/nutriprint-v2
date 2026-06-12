"""
NutriPrint Food Image Service
=============================
Resolves a food name → the best available image URL + emoji fallback.

Resolution order for each food name:
  1. Exact slug match  (e.g. "ragi_mudde.webp")
  2. Alternate slug    (e.g. "ragi_mudde.jpg", "ragi_mudde.png", "ragi_mudde.svg")
  3. Category fallback (e.g. "dal.svg")
  4. App-level fallback placeholder

When you drop a photo  static/images/foods/ragi_mudde.webp  it is
automatically picked up — no code change needed.
"""

from __future__ import annotations
import os
import re
from pathlib import Path
from functools import lru_cache

# ── Constants ─────────────────────────────────────────────────────────────────

FOODS_DIR   = Path(__file__).parent.parent / "static" / "images" / "foods"
STATIC_BASE = "/static/images/foods"

# Preferred extension order (photos before SVG icons)
EXT_ORDER = (".webp", ".jpg", ".jpeg", ".png", ".svg")

# ── Master food-name → slug mapping (53 Karnataka foods) ─────────────────────
# slug = lowercase filename without extension, stored in FOODS_DIR

FOOD_SLUG_MAP: dict[str, str] = {
    # ── Ragi / millet ─────────────────────────────────────────────────────────
    "Ragi Mudde"                              : "ragi_mudde",
    "Ragi Dosa"                               : "ragi_dosa",
    "Mudde Saaru (Finger Millet with Rasam)"  : "mudde_saaru",
    "Ragi Malt"                               : "ragi_malt",

    # ── Dosa / idli family ────────────────────────────────────────────────────
    "Neer Dosa"                               : "neer_dosa",
    "Wheat Dosa"                              : "wheat_dosa",
    "Idli with Sambar"                        : "idli_with_sambar",
    "Rava Idli"                               : "rava_idli",
    "Akki Roti"                               : "akki_roti",

    # ── Roti / paratha ────────────────────────────────────────────────────────
    "Jowar Roti"                              : "jowar_roti",
    "Jolada Rotti with Ennegayi"              : "jolada_rotti_with_ennegayi",
    "Methi Paratha"                           : "methi_paratha",
    "Chapati with Chana Masala"               : "chapati_with_chana_masala",
    "Beans Curry with Chapati"                : "beans_curry_with_chapati",

    # ── Rice dishes ───────────────────────────────────────────────────────────
    "Coconut Rice"                            : "coconut_rice",
    "Groundnut Chutney Rice"                  : "groundnut_chutney_rice",
    "Sambar Rice"                             : "sambar_rice",
    "Curd Rice"                               : "curd_rice",
    "Tomato Gojju with Rice"                  : "tomato_gojju_with_rice",
    "Lemon Rice"                              : "lemon_rice",
    "Vangi Bath"                              : "vangi_bath",
    "Toor Dal with Ghee Rice"                 : "toor_dal_with_ghee_rice",
    "Poha"                                    : "poha",

    # ── Bowl / khichdi / porridge ─────────────────────────────────────────────
    "Upma"                                    : "upma",
    "Bisibelebath"                            : "bisibelebath",
    "Sabudana Khichdi"                        : "sabudana_khichdi",
    "Mixed Veg Khichdi"                       : "mixed_veg_khichdi",
    "Pongal"                                  : "pongal",
    "Shavige Bath"                            : "shavige_bath",

    # ── Dal / lentil curries ──────────────────────────────────────────────────
    "Palak Dal"                               : "palak_dal",
    "Horsegram Saaru"                         : "horsegram_saaru",
    "Avarekalu Saaru"                         : "avarekalu_saaru",
    "Dill Leaves Dal"                         : "dill_leaves_dal",
    "Ambat (Goan-Mangalorean Curry)"          : "ambat",
    "Moong Dal Payasam"                       : "moong_dal_payasam",

    # ── Vegetable dishes ──────────────────────────────────────────────────────
    "Drumstick Leaves Curry"                  : "drumstick_leaves_curry",
    "Jackfruit Curry"                         : "jackfruit_curry",
    "Colocasia Fry"                           : "colocasia_fry",
    "Sweet Potato Curry"                      : "sweet_potato_curry",
    "Pathrode"                                : "pathrode",
    "Kelyache Shiite (Banana Flower Curry)"   : "kelyache_shiite",

    # ── Sprouts / street food ─────────────────────────────────────────────────
    "Green Gram Sprouted Salad"               : "green_gram_sprouted_salad",
    "Girmit"                                  : "girmit",

    # ── Egg dishes ────────────────────────────────────────────────────────────
    "Egg Curry with Rice"                     : "egg_curry_with_rice",
    "Boiled Egg with Ragi Mudde"              : "boiled_egg_with_ragi_mudde",
    "Omelette with Bread"                     : "omelette_with_bread",

    # ── Non-veg protein ───────────────────────────────────────────────────────
    "Fish Curry with Rice"                    : "fish_curry_with_rice",
    "Chicken Saaru with Jolada Rotti"         : "chicken_saaru_with_jolada_rotti",
    "Koli Saaru (Chicken Soup)"               : "koli_saaru",
    "Prawn Ghee Roast with Neer Dosa"         : "prawn_ghee_roast_with_neer_dosa",

    # ── Sweets / dairy ────────────────────────────────────────────────────────
    "Banana Sheera"                           : "banana_sheera",
    "Carrot Halwa"                            : "carrot_halwa",
    "Groundnut Laddu"                         : "groundnut_laddu",
}

# ── Category fallback slugs (SVG icons always present) ───────────────────────
# Used when no per-food photo exists yet.

_CATEGORY_FALLBACK: dict[str, str] = {
    "ragi_mudde"                          : "ragi_mudde",   # svg exists
    "ragi_dosa"                           : "dosa",
    "mudde_saaru"                         : "ragi_mudde",
    "ragi_malt"                           : "milk",
    "neer_dosa"                           : "dosa",
    "wheat_dosa"                          : "dosa",
    "idli_with_sambar"                    : "idli",
    "rava_idli"                           : "idli",
    "akki_roti"                           : "roti",
    "jowar_roti"                          : "roti",
    "jolada_rotti_with_ennegayi"          : "roti",
    "methi_paratha"                       : "roti",
    "chapati_with_chana_masala"           : "roti",
    "beans_curry_with_chapati"            : "roti",
    "coconut_rice"                        : "rice",
    "groundnut_chutney_rice"              : "rice",
    "sambar_rice"                         : "rice",
    "curd_rice"                           : "curd_rice",
    "tomato_gojju_with_rice"              : "rice",
    "lemon_rice"                          : "rice",
    "vangi_bath"                          : "rice",
    "toor_dal_with_ghee_rice"             : "rice",
    "poha"                                : "rice",
    "upma"                                : "upma",
    "bisibelebath"                        : "khichdi",
    "sabudana_khichdi"                    : "khichdi",
    "mixed_veg_khichdi"                   : "khichdi",
    "pongal"                              : "khichdi",
    "shavige_bath"                        : "upma",
    "palak_dal"                           : "dal",
    "horsegram_saaru"                     : "dal",
    "avarekalu_saaru"                     : "dal",
    "dill_leaves_dal"                     : "dal",
    "ambat"                               : "dal",
    "moong_dal_payasam"                   : "milk",
    "drumstick_leaves_curry"              : "vegetables",
    "jackfruit_curry"                     : "vegetables",
    "colocasia_fry"                       : "vegetables",
    "sweet_potato_curry"                  : "vegetables",
    "pathrode"                            : "vegetables",
    "kelyache_shiite"                     : "vegetables",
    "green_gram_sprouted_salad"           : "sprouts",
    "girmit"                              : "sprouts",
    "egg_curry_with_rice"                 : "egg",
    "boiled_egg_with_ragi_mudde"          : "egg",
    "omelette_with_bread"                 : "egg",
    "fish_curry_with_rice"                : "fish",
    "chicken_saaru_with_jolada_rotti"     : "chicken",
    "koli_saaru"                          : "chicken",
    "prawn_ghee_roast_with_neer_dosa"     : "prawn",
    "banana_sheera"                       : "fruits",
    "carrot_halwa"                        : "milk",
    "groundnut_laddu"                     : "nuts",
}

# Per-category emoji (shown only when NO image at all is available)
_EMOJI: dict[str, str] = {
    "egg"        : "🥚",
    "chicken"    : "🍗",
    "fish"       : "🐟",
    "prawn"      : "🦐",
    "rice"       : "🍚",
    "dosa"       : "🫓",
    "idli"       : "🫓",
    "roti"       : "🫓",
    "ragi_mudde" : "🟤",
    "upma"       : "🍚",
    "khichdi"    : "🍲",
    "dal"        : "🫘",
    "curd_rice"  : "🍚",
    "vegetables" : "🥦",
    "sprouts"    : "🌱",
    "fruits"     : "🍎",
    "milk"       : "🥛",
    "nuts"       : "🥜",
    "paneer"     : "🧀",
    "default"    : "🥗",
}

# ── Runtime file resolver ─────────────────────────────────────────────────────

@lru_cache(maxsize=128)
def _file_exists(slug: str) -> str | None:
    """
    Return the URL path to the first existing file for this slug,
    checking extensions in preference order (webp → jpg → png → svg).
    Cached so we only hit the filesystem once per slug per process lifetime.
    """
    for ext in EXT_ORDER:
        path = FOODS_DIR / f"{slug}{ext}"
        if path.exists():
            return f"{STATIC_BASE}/{slug}{ext}"
    return None


def _make_slug(name: str) -> str:
    """Normalise a food name to a filesystem slug."""
    name = re.sub(r"\(.*?\)", "", name).strip()
    name = re.sub(r"[^a-z0-9 ]", "", name.lower())
    return re.sub(r"\s+", "_", name.strip())


def get_food_icon(name: str) -> dict:
    """
    Primary API.  Returns:
      url   – path to best available image, or None
      emoji – text fallback if url is None
      slug  – the per-food slug
    """
    # 1. Exact name match → per-food slug
    slug = FOOD_SLUG_MAP.get(name) or _make_slug(name)

    # 2. Try to find a real photo/SVG for this exact slug
    url = _file_exists(slug)
    if url:
        return {"slug": slug, "url": url, "emoji": _EMOJI.get(slug, _EMOJI["default"])}

    # 3. Try the category fallback slug
    fallback_slug = _CATEGORY_FALLBACK.get(slug)
    if fallback_slug:
        fb_url = _file_exists(fallback_slug)
        if fb_url:
            return {"slug": slug, "url": fb_url, "emoji": _EMOJI.get(fallback_slug, _EMOJI["default"])}

    # 4. Absolute last resort — emoji only
    return {"slug": slug, "url": None, "emoji": _EMOJI.get(slug, _EMOJI["default"])}


def invalidate_cache() -> None:
    """Call after uploading new image files to pick them up immediately."""
    _file_exists.cache_clear()


# ── Nutrient icons ────────────────────────────────────────────────────────────

NUTRIENT_ICONS: dict[str, str] = {
    "calories"   : "🔥",
    "protein"    : "💪",
    "protein_g"  : "💪",
    "carbs"      : "🍚",
    "carbs_g"    : "🍚",
    "fat"        : "🥑",
    "fat_g"      : "🥑",
    "fiber"      : "🌿",
    "fiber_g"    : "🌿",
    "calcium"    : "🦴",
    "calcium_mg" : "🦴",
    "iron"       : "🩸",
    "iron_mg"    : "🩸",
}


def get_nutrient_icon(key: str) -> str:
    return NUTRIENT_ICONS.get(key, "📊")


def enrich_meal_with_icon(meal: dict) -> dict:
    icon = get_food_icon(meal.get("name_en", ""))
    meal = dict(meal)
    meal["food_icon"] = icon
    return meal
