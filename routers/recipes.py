import json
import re
from pathlib import Path

from fastapi import APIRouter
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["Recipes"])

templates = Jinja2Templates(directory="templates")

# ── Data paths ────────────────────────────────────────────────────────────────
_FOODS_FILE   = Path("data/foods.json")
_RECIPES_FILE = Path("data/recipes.json")
_FOODS_DIR    = Path("static/images/foods")

# ── Image slug helpers (mirrors meal.js logic) ────────────────────────────────

_FOOD_SLUG: dict[str, str] = {
    "Ragi Mudde"                             : "ragi_mudde",
    "Ragi Dosa"                              : "ragi_dosa",
    "Mudde Saaru (Finger Millet with Rasam)" : "mudde_saaru",
    "Ragi Malt"                              : "ragi_malt",
    "Neer Dosa"                              : "neer_dosa",
    "Wheat Dosa"                             : "wheat_dosa",
    "Idli with Sambar"                       : "idli_with_sambar",
    "Rava Idli"                              : "rava_idli",
    "Akki Roti"                              : "akki_roti",
    "Jowar Roti"                             : "jowar_roti",
    "Jolada Rotti with Ennegayi"             : "jolada_rotti_with_ennegayi",
    "Methi Paratha"                          : "methi_paratha",
    "Chapati with Chana Masala"              : "chapati_with_chana_masala",
    "Beans Curry with Chapati"               : "beans_curry_with_chapati",
    "Coconut Rice"                           : "coconut_rice",
    "Groundnut Chutney Rice"                 : "groundnut_chutney_rice",
    "Sambar Rice"                            : "sambar_rice",
    "Curd Rice"                              : "curd_rice",
    "Tomato Gojju with Rice"                 : "tomato_gojju_with_rice",
    "Lemon Rice"                             : "lemon_rice",
    "Vangi Bath"                             : "vangi_bath",
    "Toor Dal with Ghee Rice"                : "toor_dal_with_ghee_rice",
    "Poha"                                   : "poha",
    "Upma"                                   : "upma",
    "Bisibelebath"                           : "bisibelebath",
    "Sabudana Khichdi"                       : "sabudana_khichdi",
    "Mixed Veg Khichdi"                      : "mixed_veg_khichdi",
    "Pongal"                                 : "pongal",
    "Shavige Bath"                           : "shavige_bath",
    "Palak Dal"                              : "palak_dal",
    "Horsegram Saaru"                        : "horsegram_saaru",
    "Avarekalu Saaru"                        : "avarekalu_saaru",
    "Dill Leaves Dal"                        : "dill_leaves_dal",
    "Ambat (Goan-Mangalorean Curry)"         : "ambat",
    "Moong Dal Payasam"                      : "moong_dal_payasam",
    "Drumstick Leaves Curry"                 : "drumstick_leaves_curry",
    "Jackfruit Curry"                        : "jackfruit_curry",
    "Colocasia Fry"                          : "colocasia_fry",
    "Sweet Potato Curry"                     : "sweet_potato_curry",
    "Pathrode"                               : "pathrode",
    "Kelyache Shiite (Banana Flower Curry)"  : "kelyache_shiite",
    "Green Gram Sprouted Salad"              : "green_gram_sprouted_salad",
    "Girmit"                                 : "girmit",
    "Egg Curry with Rice"                    : "egg_curry_with_rice",
    "Boiled Egg with Ragi Mudde"             : "boiled_egg_with_ragi_mudde",
    "Omelette with Bread"                    : "omelette_with_bread",
    "Fish Curry with Rice"                   : "fish_curry_with_rice",
    "Chicken Saaru with Jolada Rotti"        : "chicken_saaru_with_jolada_rotti",
    "Koli Saaru (Chicken Soup)"              : "koli_saaru",
    "Prawn Ghee Roast with Neer Dosa"        : "prawn_ghee_roast_with_neer_dosa",
    "Banana Sheera"                          : "banana_sheera",
    "Carrot Halwa"                           : "carrot_halwa",
    "Groundnut Laddu"                        : "groundnut_laddu",
}

# Category fallback slugs (all verified to exist as .jpg)
_FALLBACK: dict[str, str] = {
    "ragi_mudde"                      : "ragi_mudde",
    "ragi_dosa"                       : "ragi_dosa",
    "mudde_saaru"                     : "ragi_mudde",
    "ragi_malt"                       : "ragi_malt",
    "neer_dosa"                       : "neer_dosa",
    "wheat_dosa"                      : "dosa",
    "idli_with_sambar"                : "idli_with_sambar",
    "rava_idli"                       : "rava_idli",
    "akki_roti"                       : "akki_roti",
    "jowar_roti"                      : "jowar_roti",
    "jolada_rotti_with_ennegayi"      : "jolada_rotti_with_ennegayi",
    "methi_paratha"                   : "roti",
    "chapati_with_chana_masala"       : "roti",
    "beans_curry_with_chapati"        : "roti",
    "coconut_rice"                    : "coconut_rice",
    "groundnut_chutney_rice"          : "rice",
    "sambar_rice"                     : "sambar_rice",
    "curd_rice"                       : "curd_rice",
    "tomato_gojju_with_rice"          : "rice",
    "lemon_rice"                      : "lemon_rice",
    "vangi_bath"                      : "rice",
    "toor_dal_with_ghee_rice"         : "toor_dal_with_ghee_rice",
    "poha"                            : "rice",
    "upma"                            : "upma",
    "bisibelebath"                    : "bisibelebath",
    "sabudana_khichdi"                : "sabudana_khichdi",
    "mixed_veg_khichdi"               : "khichdi",
    "pongal"                          : "khichdi",
    "shavige_bath"                    : "upma",
    "palak_dal"                       : "palak_dal",
    "horsegram_saaru"                 : "horsegram_saaru",
    "avarekalu_saaru"                 : "avarekalu_saaru",
    "dill_leaves_dal"                 : "dill_leaves_dal",
    "ambat"                           : "dal",
    "moong_dal_payasam"               : "moong_dal_payasam",
    "drumstick_leaves_curry"          : "drumstick_leaves_curry",
    "jackfruit_curry"                 : "vegetables",
    "colocasia_fry"                   : "vegetables",
    "sweet_potato_curry"              : "sweet_potato",
    "pathrode"                        : "pathrode",
    "kelyache_shiite"                 : "kelyache_shiite",
    "green_gram_sprouted_salad"       : "green_gram_sprouted_salad",
    "girmit"                          : "nuts",
    "egg_curry_with_rice"             : "egg",
    "boiled_egg_with_ragi_mudde"      : "egg",
    "omelette_with_bread"             : "egg",
    "fish_curry_with_rice"            : "fish_curry",
    "chicken_saaru_with_jolada_rotti" : "chicken_curry",
    "koli_saaru"                      : "chicken",
    "prawn_ghee_roast_with_neer_dosa" : "fish",
    "banana_sheera"                   : "banana_sheera",
    "carrot_halwa"                    : "vegetables",
    "groundnut_laddu"                 : "groundnut_laddu",
}


def _norm_slug(name: str) -> str:
    """Normalise a food name to a file slug."""
    cleaned = re.sub(r"\(.*?\)", "", name).strip()
    cleaned = cleaned.lower()
    cleaned = re.sub(r"[^a-z0-9 ]", "", cleaned).strip()
    return re.sub(r"\s+", "_", cleaned)


def _resolve_image_file(name: str) -> str | None:
    """
    Return the .jpg filename (basename only) for a given food name,
    or None if nothing can be resolved.
    Mirrors the JavaScript _resolveFood() logic in meal.js.
    """
    slug = _FOOD_SLUG.get(name) or _norm_slug(name)

    # 1. Direct per-food jpg
    direct = _FOODS_DIR / f"{slug}.jpg"
    if direct.exists():
        return f"{slug}.jpg"

    # 2. Category fallback
    fb_slug = _FALLBACK.get(slug)
    if fb_slug:
        fb_path = _FOODS_DIR / f"{fb_slug}.jpg"
        if fb_path.exists():
            return f"{fb_slug}.jpg"

    return None


# ── Data loaders ──────────────────────────────────────────────────────────────

def _load_foods() -> list[dict]:
    with open(_FOODS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _load_recipes() -> dict:
    with open(_RECIPES_FILE, encoding="utf-8") as f:
        return json.load(f)


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/recipes/{food_name}", response_class=HTMLResponse)
async def recipe_page(food_name: str, request: Request):
    """
    Recipe page for a single food.
    food_name is URL-encoded (spaces as +/%20 or _ as separators).
    Matching is case-insensitive after normalising underscores/hyphens to spaces.
    """
    # Normalise the path param to a human-readable name
    normalised = food_name.replace("_", " ").replace("-", " ").strip()

    foods = _load_foods()
    recipes = _load_recipes()

    # Case-insensitive match
    food = next(
        (f for f in foods if f["name_en"].lower() == normalised.lower()),
        None,
    )

    if food is None:
        return templates.TemplateResponse(
            request=request,
            name="recipe.html",
            context={
                "food": None,
                "food_name": normalised,
                "recipe": {"ingredients": [], "steps": []},
            },
        )

    # Attach resolved image filename
    food = dict(food)  # shallow copy to avoid mutating cached data
    food["image_file"] = _resolve_image_file(food["name_en"])

    # Get recipe data (ingredients + steps)
    recipe = recipes.get(food["name_en"], {"ingredients": [], "steps": []})

    return templates.TemplateResponse(
        request=request,
        name="recipe.html",
        context={
            "food": food,
            "food_name": food["name_en"],
            "recipe": recipe,
        },
    )
