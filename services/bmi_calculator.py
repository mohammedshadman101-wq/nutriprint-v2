import math
from models.schemas import BMIResult, BMIClass

# ─── IAP Pediatric BMI Percentile Tables ─────────────────
# Source: Indian Academy of Pediatrics growth charts
# Format: age → [P5, P85, P95] for boys and girls

IAP_BOYS = {
    5:  [13.0, 15.8, 17.0],
    6:  [13.1, 16.0, 17.3],
    7:  [13.2, 16.4, 17.8],
    8:  [13.4, 16.9, 18.4],
    9:  [13.7, 17.5, 19.2],
    10: [14.1, 18.2, 20.1],
    11: [14.6, 19.1, 21.2],
    12: [15.2, 20.0, 22.3],
    13: [15.9, 20.9, 23.3],
    14: [16.6, 21.8, 24.2],
    15: [17.2, 22.5, 24.9],
}

IAP_GIRLS = {
    5:  [13.0, 15.9, 17.1],
    6:  [13.1, 16.2, 17.5],
    7:  [13.2, 16.7, 18.2],
    8:  [13.5, 17.4, 19.1],
    9:  [13.9, 18.2, 20.1],
    10: [14.4, 19.1, 21.2],
    11: [15.0, 20.1, 22.3],
    12: [15.7, 21.0, 23.3],
    13: [16.4, 21.8, 24.1],
    14: [17.0, 22.4, 24.7],
    15: [17.5, 22.9, 25.1],
}

# Kannada days (used elsewhere too)
DAYS_KN = {
    "Monday":    "ಸೋಮವಾರ",
    "Tuesday":   "ಮಂಗಳವಾರ",
    "Wednesday": "ಬುಧವಾರ",
    "Thursday":  "ಗುರುವಾರ",
    "Friday":    "ಶುಕ್ರವಾರ",
    "Saturday":  "ಶನಿವಾರ",
    "Sunday":    "ಭಾನುವಾರ",
}

# ─── Advice Text ──────────────────────────────────────────

ADVICE = {
    "underweight": {
        "en": "This child is underweight. Focus on calorie-dense foods like Ragi Mudde, Groundnut Laddu, and Ghee Rice. Ensure 3 full meals daily.",
        "kn": "ಈ ಮಗು ತೂಕ ಕಡಿಮೆ ಇದೆ. ರಾಗಿ ಮುದ್ದೆ, ಕಡಲೆಕಾಯಿ ಉಂಡೆ ಮತ್ತು ತುಪ್ಪದ ಅನ್ನದಂತಹ ಹೆಚ್ಚು ಕ್ಯಾಲೋರಿ ಆಹಾರ ನೀಡಿ.",
        "color": "#3B82F6"
    },
    "normal": {
        "en": "Healthy weight! Continue balanced meals with local Karnataka foods. Include Ragi, Jowar, and seasonal vegetables daily.",
        "kn": "ಆರೋಗ್ಯಕರ ತೂಕ! ರಾಗಿ, ಜೋಳ ಮತ್ತು ಋತುಮಾನದ ತರಕಾರಿಗಳೊಂದಿಗೆ ಸಮತೋಲಿತ ಊಟ ಮುಂದುವರಿಸಿ.",
        "color": "#10B981"
    },
    "overweight": {
        "en": "This child is overweight. Reduce fried foods and sweets. Increase vegetables, Ragi, and physical activity.",
        "kn": "ಈ ಮಗು ತೂಕ ಹೆಚ್ಚಾಗಿದೆ. ಕರಿದ ಆಹಾರ ಮತ್ತು ಸಿಹಿತಿನಿಸುಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಿ. ತರಕಾರಿ ಮತ್ತು ರಾಗಿ ಹೆಚ್ಚಿಸಿ.",
        "color": "#F97316"
    },
    "obese": {
        "en": "This child is obese. Please consult a doctor. Avoid junk food completely. Use high-fiber, low-calorie meal plan.",
        "kn": "ಈ ಮಗು ಸ್ಥೂಲಕಾಯ. ದಯವಿಟ್ಟು ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ. ಜಂಕ್ ಫುಡ್ ಸಂಪೂರ್ಣವಾಗಿ ತಪ್ಪಿಸಿ.",
        "color": "#EF4444"
    },
}

# ─── Core Function ────────────────────────────────────────

def calculate_bmi(
    student_name: str,
    age: int,
    gender: str,
    height_cm: float,
    weight_kg: float
) -> BMIResult:

    # BMI formula
    height_m  = height_cm / 100
    bmi_value = round(weight_kg / (height_m ** 2), 2)

    # Get IAP thresholds for this age+gender
    table     = IAP_BOYS if gender == "boy" else IAP_GIRLS
    age_key   = max(5, min(15, age))
    p5, p85, p95 = table[age_key]

    # Classify
    if bmi_value < p5:
        classification = BMIClass.underweight
        percentile     = round((bmi_value / p5) * 5, 1)
    elif bmi_value < p85:
        classification = BMIClass.normal
        percentile     = round(5 + ((bmi_value - p5) / (p85 - p5)) * 80, 1)
    elif bmi_value < p95:
        classification = BMIClass.overweight
        percentile     = round(85 + ((bmi_value - p85) / (p95 - p85)) * 10, 1)
    else:
        classification = BMIClass.obese
        percentile     = min(99.9, round(95 + ((bmi_value - p95) / p95) * 4, 1))

    # Z-score approximation
    median    = (p5 + p85) / 2
    sd        = (p85 - p5) / 2.5
    z_score   = round((bmi_value - median) / sd, 2) if sd > 0 else 0.0

    advice    = ADVICE[classification.value]

    return BMIResult(
        student_name   = student_name,
        age            = age,
        gender         = gender,
        height_cm      = height_cm,
        weight_kg      = weight_kg,
        bmi_value      = bmi_value,
        percentile     = percentile,
        z_score        = z_score,
        classification = classification,
        advice_en      = advice["en"],
        advice_kn      = advice["kn"],
        color          = advice["color"],
    )