from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

# ─── Enums ───────────────────────────────────────────────

class Gender(str, Enum):
    boy  = "boy"
    girl = "girl"

class AgeGroup(str, Enum):
    primary  = "5-8"
    middle   = "9-12"
    high     = "13-15"

class DietPref(str, Enum):
    vegetarian    = "vegetarian"
    eggetarian    = "eggetarian"
    nonveg        = "non-vegetarian"

class Region(str, Enum):
    mangalore      = "mangalore"
    udupi          = "udupi"
    shivamogga     = "shivamogga"
    bengaluru      = "bengaluru_rural"
    mysuru         = "mysuru"
    hubli          = "hubli_dharwad"

class Strategy(str, Enum):
    standard       = "standard"
    high_protein   = "high_protein"
    calcium_iron   = "calcium_iron"
    calorie_ctrl   = "calorie_control"

class BMIClass(str, Enum):
    underweight = "underweight"
    normal      = "normal"
    overweight  = "overweight"
    obese       = "obese"

# ─── BMI Schemas ─────────────────────────────────────────

class BMIInput(BaseModel):
    student_name : str  = Field(..., min_length=2, max_length=100)
    age          : int  = Field(..., ge=5, le=15)
    gender       : Gender
    height_cm    : float = Field(..., ge=50, le=250)
    weight_kg    : float = Field(..., ge=5,  le=150)
    teacher_id   : Optional[str] = None
    student_id   : Optional[str] = None

class BMIResult(BaseModel):
    student_name : str
    age          : int
    gender       : str
    height_cm    : float
    weight_kg    : float
    bmi_value    : float
    percentile   : float
    z_score      : float
    classification: BMIClass
    advice_en    : str
    advice_kn    : str
    color        : str   # hex color for UI badge

# ─── Meal Schemas ─────────────────────────────────────────

class MealItem(BaseModel):
    name_en       : str
    name_kn       : str
    ingredients   : List[str]
    calories      : float
    protein_g     : float
    calcium_mg    : float
    iron_mg       : float
    cost_inr      : float
    prep_time_min : int

class MealDay(BaseModel):
    day       : str   # Monday, Tuesday etc.
    day_kn    : str   # ಸೋಮವಾರ etc.
    breakfast : MealItem
    lunch     : MealItem
    dinner    : MealItem

class AIRecommendation(BaseModel):
    id                   : str
    title                : str
    short_action         : str
    detailed_explanation : str
    parent_guidance      : str
    language             : str = "en"
    destinations         : List[str] = []

class MealPlan(BaseModel):
    plan_id        : Optional[str] = None
    share_token    : Optional[str] = None
    student_name   : str
    school_name    : str
    teacher_name   : Optional[str] = None
    age_group      : str
    diet_pref      : str
    region         : str
    month          : str
    strategy       : str
    allergies      : List[str] = []
    bmi_class      : Optional[str] = None
    week           : List[MealDay]
    avg_daily_cal  : float
    avg_protein_g  : float
    avg_calcium_mg : float
    avg_iron_mg    : float
    total_cost_inr : float
    generated_by   : str = "groq"
    ai_recommendations: List[AIRecommendation] = []

class MealInput(BaseModel):
    school_name  : str  = Field(..., min_length=2, max_length=200)
    teacher_name : Optional[str] = None
    teacher_id   : Optional[str] = None
    student_name : Optional[str] = "Student"
    student_id   : Optional[str] = None
    age_group    : AgeGroup
    diet_pref    : DietPref
    region       : Region
    month        : str
    strategy     : Strategy = Strategy.standard
    bmi_class    : Optional[BMIClass] = None
    allergies    : List[str] = []
    ai_recommendations: List[AIRecommendation] = []

class AIChatMessage(BaseModel):
    role    : str
    content : str

class StudentProfile(BaseModel):
    student_name   : Optional[str] = "Student"
    age            : Optional[str] = None
    age_group      : Optional[str] = None
    gender         : Optional[str] = None
    height_cm      : Optional[float] = None
    weight_kg      : Optional[float] = None
    bmi_value      : Optional[float] = None
    bmi_class      : Optional[str] = None
    activity_level : Optional[str] = None
    health_notes   : Optional[str] = None
    diet_pref      : Optional[str] = None
    region         : Optional[str] = None
    month          : Optional[str] = None
    strategy       : Optional[str] = None
    allergies      : List[str] = []

class AIAdvisorRequest(BaseModel):
    question : str = Field(..., min_length=1, max_length=800)
    language : str = "auto"
    profile  : StudentProfile
    history  : List[AIChatMessage] = []

class AIAdvisorResponse(BaseModel):
    answer          : str
    recommendations : List[AIRecommendation] = []
    generated_by    : str = "groq"

class RegenerateDay(BaseModel):
    plan_id  : str
    day_name : str   # "Monday" etc.
