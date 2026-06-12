"""
NutriPrint — Parent Nutrition Awareness Pack (PDF)
Generates a professional 7-section A4 report via ReportLab.

Sections:
  1. Cover — school branding + student summary + BMI status card
  2. AI Nutrition Recommendations
  3. Weekly Meal Plan (7-day grid)
  4. Food Benefits (protein / iron / calcium spotlight)
  5. QR Recipe Access
  6. Parent Guidance tips
  7. School Recommendation + signatures
"""

from __future__ import annotations

import io
import textwrap
from xml.sax.saxutils import escape

import qrcode
from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    FrameBreak,
    HRFlowable,
    Image as RLImage,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ─── Palette ─────────────────────────────────────────────────────────────────
C_GREEN      = colors.HexColor("#1D9E75")
C_GREEN_DARK = colors.HexColor("#0F5E46")
C_GREEN_MID  = colors.HexColor("#136B4F")
C_GREEN_LITE = colors.HexColor("#F0FDF4")
C_GREEN_BRD  = colors.HexColor("#BBF7D0")
C_SAFFRON    = colors.HexColor("#F97316")
C_AMBER_LITE = colors.HexColor("#FFF7ED")
C_AMBER_BRD  = colors.HexColor("#FED7AA")
C_NAVY       = colors.HexColor("#0F172A")
C_SLATE      = colors.HexColor("#475569")
C_MUTED      = colors.HexColor("#94A3B8")
C_RULE       = colors.HexColor("#E2E8F0")
C_WHITE      = colors.white
C_BLUE       = colors.HexColor("#3B82F6")
C_BLUE_LITE  = colors.HexColor("#EFF6FF")
C_BLUE_BRD   = colors.HexColor("#BFDBFE")
C_RED        = colors.HexColor("#EF4444")
C_RED_LITE   = colors.HexColor("#FEF2F2")
C_RED_BRD    = colors.HexColor("#FECACA")
C_ORANGE_LT  = colors.HexColor("#FFF7ED")
C_PURPLE     = colors.HexColor("#8B5CF6")
C_GRAY_50    = colors.HexColor("#F8FAFC")
C_GRAY_100   = colors.HexColor("#F1F5F9")

CLASS_COLOR = {
    "underweight": C_BLUE,
    "normal":      C_GREEN,
    "overweight":  C_SAFFRON,
    "obese":       C_RED,
}
CLASS_LITE = {
    "underweight": C_BLUE_LITE,
    "normal":      C_GREEN_LITE,
    "overweight":  C_AMBER_LITE,
    "obese":       C_RED_LITE,
}
CLASS_BRD = {
    "underweight": C_BLUE_BRD,
    "normal":      C_GREEN_BRD,
    "overweight":  C_AMBER_BRD,
    "obese":       C_RED_BRD,
}
CLASS_LABEL = {
    "underweight": "⚠ Underweight",
    "normal":      "✓ Healthy Weight",
    "overweight":  "⚠ Overweight",
    "obese":       "⚠ Obese",
}

# ─── Page geometry ────────────────────────────────────────────────────────────
PW, PH   = A4                  # 595 × 842 pt
MARGIN_H = 14 * mm
MARGIN_V = 14 * mm
BODY_W   = PW - 2 * MARGIN_H  # usable width

# ─── Style factory ───────────────────────────────────────────────────────────

def _s(name, base="Normal", **kw) -> ParagraphStyle:
    """Create a named ParagraphStyle in one call."""
    styles = getSampleStyleSheet()
    parent = styles[base] if base in styles else styles["Normal"]
    return ParagraphStyle(name, parent=parent, **kw)


# ─── QR helpers ──────────────────────────────────────────────────────────────

def _qr_image(url: str, pts: float = 60) -> RLImage | None:
    """Return a ReportLab Image for a QR code, or None on error."""
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=3,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img: PILImage.Image = qr.make_image(fill_color="#0F5E46", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return RLImage(buf, width=pts, height=pts)
    except Exception:
        return None


# ─── Reusable section-header row ─────────────────────────────────────────────

def _section_header(title: str, subtitle: str = "", icon: str = "") -> Table:
    label_s = _s("SHLabel", fontSize=7, textColor=C_GREEN,
                 fontName="Helvetica-Bold", leading=10,
                 letterSpacing=1, spaceAfter=0)
    title_s = _s("SHTitle", fontSize=13, textColor=C_NAVY,
                 fontName="Helvetica-Bold", leading=16, spaceAfter=0)
    sub_s   = _s("SHSub",   fontSize=8,  textColor=C_SLATE,
                 fontName="Helvetica",    leading=11, spaceAfter=0)

    icon_text = f"{icon}  " if icon else ""
    inner = [Paragraph(icon_text + title, title_s)]
    if subtitle:
        inner.append(Paragraph(subtitle, sub_s))

    t = Table([[inner]], colWidths=[BODY_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_GREEN_LITE),
        ("LINEBELOW",     (0, 0), (-1, -1), 1.5, C_GREEN),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


# ─── Cover / page background callback ────────────────────────────────────────

def _draw_page_chrome(canvas, doc):
    """Draws repeating header stripe + footer on every page."""
    canvas.saveState()
    # Thin top accent bar
    canvas.setFillColor(C_GREEN)
    canvas.rect(0, PH - 5, PW, 5, fill=1, stroke=0)
    # Bottom footer bar
    canvas.setFillColor(C_GRAY_100)
    canvas.rect(0, 0, PW, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(C_SLATE)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(
        PW / 2, 3.5 * mm,
        "NutriPrint · AI-Powered School Nutrition · Karnataka  |  "
        "Yenepoya Institute of Technology, Moodbidri  |  Free for all Karnataka schools"
    )
    # Page number (right)
    canvas.drawRightString(PW - MARGIN_H, 3.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION BUILDERS
# ═══════════════════════════════════════════════════════════════════════════════

# ── § COVER ───────────────────────────────────────────────────────────────────

def _build_cover(plan: dict, share_token: str, base_url: str) -> list:
    story = []

    student  = plan.get("student_name", "Student")
    school   = plan.get("school_name",  "School")
    teacher  = plan.get("teacher_name", "")
    age      = plan.get("age_group",    "")
    diet     = plan.get("diet_pref",    "").replace("-", " ").title()
    region   = plan.get("region",       "").replace("_", " ").title()
    month    = plan.get("month",        "").title()
    bmi_cls  = (plan.get("bmi_class")   or "").lower()
    gender   = plan.get("gender",       "")
    height   = plan.get("height_cm",    "")
    weight   = plan.get("weight_kg",    "")
    bmi_val  = plan.get("bmi_value",    "")

    # ── Full-width cover header ──────────────────────────────────────────────
    logo_s = _s("Logo", fontSize=22, textColor=C_WHITE, fontName="Helvetica-Bold",
                leading=26, spaceAfter=0)
    tag_s  = _s("Tag",  fontSize=8,  textColor=colors.HexColor("#D1FAE5"),
                fontName="Helvetica", leading=12, spaceAfter=0)
    doc_s  = _s("DocT", fontSize=9,  textColor=colors.HexColor("#BBF7D0"),
                fontName="Helvetica-Bold", leading=12, spaceAfter=0)

    cover_left = [
        Paragraph("NutriPrint", logo_s),
        Spacer(1, 2 * mm),
        Paragraph("AI-Powered School Nutrition Platform · Karnataka", tag_s),
        Spacer(1, 3 * mm),
        Paragraph("PARENT NUTRITION AWARENESS PACK", doc_s),
        Spacer(1, 1 * mm),
        Paragraph("Confidential — For School &amp; Parent Use Only", tag_s),
    ]

    stud_s  = _s("StudN", fontSize=14, textColor=C_WHITE, fontName="Helvetica-Bold",
                 leading=18, alignment=TA_RIGHT)
    info_s  = _s("Inf",   fontSize=8,  textColor=colors.HexColor("#D1FAE5"),
                 fontName="Helvetica", leading=12, alignment=TA_RIGHT)

    cover_right = [
        Paragraph(escape(student), stud_s),
        Paragraph(escape(school),  info_s),
        Paragraph(escape(f"Teacher: {teacher}") if teacher else "", info_s),
        Paragraph(f"{month}  ·  {region}", info_s),
    ]

    cover_tbl = Table(
        [[cover_left, cover_right]],
        colWidths=[BODY_W * 0.6, BODY_W * 0.4],
    )
    cover_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_GREEN_DARK),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(cover_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── Student summary card ─────────────────────────────────────────────────
    story.append(_section_header("§ 1 — Student Summary",
                                 "Health metrics recorded by the class teacher", "👩‍🎓"))
    story.append(Spacer(1, 3 * mm))

    field_s  = _s("Fld",  fontSize=7.5, textColor=C_MUTED,
                  fontName="Helvetica", leading=10)
    value_s  = _s("Val",  fontSize=10,  textColor=C_NAVY,
                  fontName="Helvetica-Bold", leading=13)
    center_s = _s("Ctr",  fontSize=8,   textColor=C_SLATE,
                  fontName="Helvetica", alignment=TA_CENTER, leading=11)

    def _kv(label, val):
        return [Paragraph(label, field_s), Paragraph(escape(str(val)) if val else "—", value_s)]

    fields = [
        _kv("Student Name",  student),
        _kv("School",        school),
        _kv("Age Group",     f"{age} years"),
        _kv("Gender",        gender.title() if gender else "—"),
        _kv("Height",        f"{height} cm" if height else "—"),
        _kv("Weight",        f"{weight} kg" if weight else "—"),
        _kv("BMI Value",     bmi_val if bmi_val else "—"),
        _kv("Diet Type",     diet),
        _kv("Region",        region),
        _kv("Plan Month",    month),
    ]

    # arrange in 2-column grid
    rows = []
    for i in range(0, len(fields), 2):
        left  = fields[i]
        right = fields[i + 1] if i + 1 < len(fields) else ["", ""]
        rows.append([left[0], left[1], right[0], right[1]])

    info_tbl = Table(
        rows,
        colWidths=[BODY_W * 0.14, BODY_W * 0.36, BODY_W * 0.14, BODY_W * 0.36],
    )
    info_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_WHITE),
        ("BACKGROUND",    (0, 0), (3, 0),   C_GRAY_50),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [C_GRAY_50, C_WHITE]),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_RULE),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_RULE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── BMI status card ──────────────────────────────────────────────────────
    if bmi_cls:
        c_main  = CLASS_COLOR.get(bmi_cls, C_GREEN)
        c_lite  = CLASS_LITE.get(bmi_cls,  C_GREEN_LITE)
        c_brd   = CLASS_BRD.get(bmi_cls,   C_GREEN_BRD)
        lbl     = CLASS_LABEL.get(bmi_cls, bmi_cls.upper())

        bmi_title_s = _s("BMIT", fontSize=13, textColor=c_main,
                          fontName="Helvetica-Bold", leading=16)
        bmi_msg = {
            "underweight": (
                "This student is underweight for their age and gender. Prioritise "
                "calorie-dense, iron-rich and protein-rich Karnataka foods such as "
                "Ragi Mudde, Groundnut Laddu, Bisibelebath and Horsegram Saaru."
            ),
            "normal": (
                "This student is in the healthy BMI range for their age and gender. "
                "Continue balanced meals using regional Karnataka foods and ensure "
                "adequate intake of calcium, iron and protein daily."
            ),
            "overweight": (
                "This student is overweight. Reduce fried foods, sweets and "
                "packaged snacks. Increase vegetables, ragi and physical activity "
                "to at least 45 minutes per day."
            ),
            "obese": (
                "This student is obese. Please consult a school health officer or "
                "doctor. Avoid junk food completely and follow a high-fibre, "
                "low-calorie meal plan consistently."
            ),
        }.get(bmi_cls, "")

        bmi_body_s  = _s("BMIBody", fontSize=8.5, textColor=C_SLATE,
                          fontName="Helvetica", leading=13, alignment=TA_JUSTIFY)
        bmi_badge_s = _s("BMIBdg", fontSize=11, textColor=C_WHITE,
                          fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14)

        badge_tbl = Table(
            [[Paragraph(lbl, bmi_badge_s)]],
            colWidths=[BODY_W * 0.22],
        )
        badge_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), c_main),
            ("TOPPADDING",    (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("ROUNDEDCORNERS", [5, 5, 5, 5]),
        ]))

        bmi_card = Table(
            [[badge_tbl, Paragraph(escape(bmi_msg), bmi_body_s)]],
            colWidths=[BODY_W * 0.22, BODY_W * 0.78],
        )
        bmi_card.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), c_lite),
            ("BOX",           (0, 0), (-1, -1), 1.0, c_brd),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(bmi_card)
        story.append(Spacer(1, 3 * mm))

    # ── Nutrition summary chips ──────────────────────────────────────────────
    avg_cal  = round(plan.get("avg_daily_cal",  0))
    avg_pro  = round(plan.get("avg_protein_g",  0), 1)
    avg_ca   = round(plan.get("avg_calcium_mg", 0))
    avg_fe   = round(plan.get("avg_iron_mg",    0), 1)
    tot_cost = plan.get("total_cost_inr", 0)

    chip_s  = _s("ChipV", fontSize=11, textColor=C_GREEN,
                 fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14)
    chip_ls = _s("ChipL", fontSize=6.5, textColor=C_MUTED,
                 fontName="Helvetica", alignment=TA_CENTER, leading=9,
                 textTransform="uppercase", letterSpacing=0.8)

    def _chip(val, lbl):
        return [Paragraph(str(val), chip_s), Paragraph(lbl, chip_ls)]

    chips_tbl = Table(
        [[_chip(f"{avg_cal}", "Cal / day"),
          _chip(f"{avg_pro}g", "Protein"),
          _chip(f"{avg_ca}mg", "Calcium"),
          _chip(f"{avg_fe}mg", "Iron"),
          _chip(f"₹{tot_cost}", "Week total")]],
        colWidths=[BODY_W / 5] * 5,
    )
    chips_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_GRAY_50),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_RULE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_RULE),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",    (4, 0), (4, 0),   C_AMBER_LITE),
        ("BOX",           (4, 0), (4, 0),   0.5, C_AMBER_BRD),
    ]))
    story.append(chips_tbl)

    return story


# ── § 2 AI NUTRITION RECOMMENDATIONS ─────────────────────────────────────────

def _build_ai_section(plan: dict) -> list:
    story = []
    story.append(Spacer(1, 5 * mm))
    story.append(_section_header(
        "§ 2 — AI Nutrition Recommendations",
        "Personalised guidance generated by Groq AI based on this student's profile",
        "🤖",
    ))
    story.append(Spacer(1, 3 * mm))

    ai_recs = plan.get("ai_recommendations") or []

    title_s  = _s("AITit", fontSize=9,  textColor=C_GREEN_DARK,
                  fontName="Helvetica-Bold", leading=12)
    body_s   = _s("AIBdy", fontSize=8,  textColor=C_SLATE,
                  fontName="Helvetica", leading=12, alignment=TA_JUSTIFY)
    guide_s  = _s("AIGd",  fontSize=7.5, textColor=colors.HexColor("#92400E"),
                  fontName="Helvetica", leading=11, alignment=TA_JUSTIFY)

    if not ai_recs:
        default_recs = [
            ("🥗 Increase Nutrient Diversity",
             "Include at least 5 different food groups daily — grains, legumes, "
             "vegetables, dairy/eggs, and fruits. Rotate between Karnataka regional "
             "foods to maximise micronutrient coverage.",
             "Cook ragi or jowar at least 3 times per week. Add leafy vegetables "
             "like drumstick leaves or palak to at least one meal daily."),
            ("💪 Boost Protein Intake",
             "School-age children require 0.9–1.2 g of protein per kg body weight "
             "for optimal growth. Include protein-rich foods like horsegram, "
             "avarekalu, eggs, or dal at every meal.",
             "Add a boiled egg or a small bowl of sprouted moong to tiffin. "
             "Replace plain rice meals with bisibelebath or khichdi."),
            ("🦴 Prioritise Calcium and Iron",
             "Calcium supports bone density and iron prevents anaemia — both "
             "critical during school-age growth. Karnataka foods like ragi, "
             "drumstick leaves and sesame are excellent natural sources.",
             "Serve ragi malt as morning drink instead of tea. Include "
             "drumstick leaves curry at least twice per week."),
            ("💧 Hydration and Meal Timing",
             "Dehydration reduces concentration and physical performance. "
             "Children should drink 6–8 glasses of clean water daily and eat "
             "at regular intervals — breakfast, lunch and dinner.",
             "Send a water bottle to school daily. Do not skip breakfast "
             "— it is the most important meal for cognitive performance."),
        ]
        recs_to_show = default_recs
        use_default  = True
    else:
        recs_to_show = [(r.get("title",""), r.get("detailed_explanation",""),
                         r.get("parent_guidance","")) for r in ai_recs[:6]]
        use_default  = False

    for i, (title, detail, guidance) in enumerate(recs_to_show):
        num_s = _s(f"AINum{i}", fontSize=10, textColor=C_WHITE,
                   fontName="Helvetica-Bold", alignment=TA_CENTER, leading=13)
        num_tbl = Table(
            [[Paragraph(str(i + 1), num_s)]],
            colWidths=[6 * mm], rowHeights=[6 * mm],
        )
        num_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_GREEN),
            ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))

        content = [
            Paragraph(escape(title),   title_s),
            Spacer(1, 1.5 * mm),
            Paragraph(escape(detail),  body_s),
        ]
        if guidance:
            content += [
                Spacer(1, 1.5 * mm),
                Paragraph(f"👨‍👩‍👧 Parent action: {escape(guidance)}", guide_s),
            ]

        row_tbl = Table(
            [[num_tbl, content]],
            colWidths=[10 * mm, BODY_W - 10 * mm],
        )
        bg = C_GREEN_LITE if i % 2 == 0 else C_WHITE
        row_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), bg),
            ("BOX",           (0, 0), (-1, -1), 0.4, C_GREEN_BRD),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(row_tbl)
        story.append(Spacer(1, 1.5 * mm))

    return story


# ── § 3 WEEKLY MEAL PLAN ──────────────────────────────────────────────────────

def _build_meal_plan(plan: dict) -> list:
    story = []
    story.append(PageBreak())
    story.append(_section_header(
        "§ 3 — Weekly Meal Plan",
        "Full 7-day plan · Breakfast · Lunch · Evening Snack · Dinner",
        "🗓️",
    ))
    story.append(Spacer(1, 3 * mm))

    hdr_s  = _s("MPHdr", fontSize=8,  textColor=C_WHITE,
                fontName="Helvetica-Bold", alignment=TA_CENTER, leading=11)
    day_s  = _s("MPDay", fontSize=8,  textColor=C_GREEN,
                fontName="Helvetica-Bold", leading=11)
    kn_s   = _s("MPKn",  fontSize=7,  textColor=C_SAFFRON,
                fontName="Helvetica", leading=10)
    name_s = _s("MPNm",  fontSize=7.5, textColor=C_NAVY,
                fontName="Helvetica-Bold", leading=10)
    meta_s = _s("MPMt",  fontSize=6.5, textColor=C_MUTED,
                fontName="Helvetica", leading=9)

    DAYS_KN = {
        "Monday": "ಸೋಮವಾರ", "Tuesday": "ಮಂಗಳವಾರ",
        "Wednesday": "ಬುಧವಾರ", "Thursday": "ಗುರುವಾರ",
        "Friday": "ಶುಕ್ರವಾರ", "Saturday": "ಶನಿವಾರ",
        "Sunday": "ಭಾನುವಾರ",
    }

    col_w = [BODY_W * 0.12, BODY_W * 0.22, BODY_W * 0.22,
             BODY_W * 0.22, BODY_W * 0.22]

    header_row = [
        Paragraph("Day",          hdr_s),
        Paragraph("🌅 Breakfast", hdr_s),
        Paragraph("☀️ Lunch",    hdr_s),
        Paragraph("🍵 Snack",    hdr_s),
        Paragraph("🌙 Dinner",   hdr_s),
    ]
    tbl_data  = [header_row]
    tbl_styles = [
        ("BACKGROUND",    (0, 0), (-1, 0),   C_GREEN_DARK),
        ("TEXTCOLOR",     (0, 0), (-1, 0),   C_WHITE),
        ("INNERGRID",     (0, 0), (-1, -1),  0.3, C_RULE),
        ("BOX",           (0, 0), (-1, -1),  0.6, C_GREEN_BRD),
        ("VALIGN",        (0, 0), (-1, -1),  "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1),  4),
        ("BOTTOMPADDING", (0, 0), (-1, -1),  4),
        ("LEFTPADDING",   (0, 0), (-1, -1),  5),
        ("RIGHTPADDING",  (0, 0), (-1, -1),  5),
    ]

    def _meal_cell(meal: dict) -> list:
        en   = meal.get("name_en", "")
        kn   = meal.get("name_kn", "")
        cal  = meal.get("calories", 0)
        pro  = meal.get("protein_g", 0)
        cost = meal.get("cost_inr",  0)
        return [
            Paragraph(escape(en), name_s),
            Paragraph(escape(kn), kn_s),
            Paragraph(f"🔥{round(cal)}cal  💪{round(pro,1)}g  ₹{cost}", meta_s),
        ]

    week = plan.get("week", [])
    for row_idx, day_data in enumerate(week):
        day_name = day_data.get("day", "")
        day_kn   = day_data.get("day_kn", DAYS_KN.get(day_name, ""))
        bf       = day_data.get("breakfast", {})
        ln       = day_data.get("lunch",     {})
        dn       = day_data.get("dinner",    {})

        # Snack = light version of breakfast or "Seasonal fruit / water"
        snack_name = bf.get("name_en", "Seasonal fruit")
        snack_kn   = bf.get("name_kn", "ಹಣ್ಣು")
        snack_cell = [
            Paragraph(escape(snack_name[:20] + "…"
                             if len(snack_name) > 20 else snack_name), name_s),
            Paragraph(escape(snack_kn), kn_s),
            Paragraph("🍎 Light portion", meta_s),
        ]

        row = [
            [Paragraph(day_name[:3], day_s), Paragraph(escape(day_kn), kn_s)],
            _meal_cell(bf),
            _meal_cell(ln),
            snack_cell,
            _meal_cell(dn),
        ]
        tbl_data.append(row)

        bg = C_GREEN_LITE if row_idx % 2 == 0 else C_WHITE
        r  = row_idx + 1
        tbl_styles.append(("BACKGROUND", (0, r), (-1, r), bg))

    meal_tbl = Table(tbl_data, colWidths=col_w)
    meal_tbl.setStyle(TableStyle(tbl_styles))
    story.append(meal_tbl)

    return story


# ── § 4 FOOD BENEFITS ─────────────────────────────────────────────────────────

_FOOD_BENEFITS = {
    "protein": [
        ("Horsegram Saaru",   "22g/100g", "Highest protein lentil in Karnataka; supports muscle growth and repair"),
        ("Avarekalu Saaru",   "23g/100g", "Winter superfood; complete plant protein with all essential amino acids"),
        ("Eggs",              "13g/egg",  "Bioavailable protein; supports brain development in school-age children"),
        ("Chicken Saaru",     "22g/100g", "Lean protein; rich in B-vitamins for energy metabolism"),
        ("Green Gram Sprout", "8.8g/100g","Live enzymes + protein; easiest protein source requiring no cooking"),
    ],
    "iron": [
        ("Drumstick Leaves",  "7.0mg/100g","Highest iron vegetable in Karnataka; moringa surpasses spinach"),
        ("Horsegram",         "7.0mg/100g","Dual iron + protein source; traditional Karnataka winter staple"),
        ("Ragi Mudde",        "3.9mg/100g","Finger millet ball; staple school meal with exceptional mineral density"),
        ("Kelyache Shiite",   "5.6mg/100g","Banana flower; iron-rich coastal vegetable, anti-anaemia food"),
        ("Methi Paratha",     "3.5mg/100g","Fenugreek flatbread; iron + fibre; ideal winter breakfast"),
    ],
    "calcium": [
        ("Drumstick Leaves",  "440mg/100g","440 mg calcium per 100g — exceeds milk; moringa is Karnataka's calcium king"),
        ("Ragi Mudde",        "344mg/100g","344 mg per 100g; ragi has 3× more calcium than rice or wheat"),
        ("Ragi Dosa",         "310mg/100g","Fermented finger millet dosa; probiotic + calcium in one meal"),
        ("Horsegram Saaru",   "287mg/100g","Kulthi lentil soup; calcium-iron-protein triple benefit"),
        ("Curd Rice",         "95mg/100g", "Yogurt rice; probiotic calcium source; cooling summer food"),
    ],
}

def _build_food_benefits() -> list:
    story = []
    story.append(Spacer(1, 5 * mm))
    story.append(_section_header(
        "§ 4 — Food Benefits",
        "Top Karnataka foods for protein, iron and calcium — with educational descriptions",
        "🥗",
    ))
    story.append(Spacer(1, 3 * mm))

    sec_hdr_s = _s("FBSec", fontSize=9,  textColor=C_WHITE,
                   fontName="Helvetica-Bold", alignment=TA_CENTER, leading=12)
    food_s    = _s("FBFd",  fontSize=8,  textColor=C_NAVY,
                   fontName="Helvetica-Bold", leading=11)
    qty_s     = _s("FBQty", fontSize=7.5, textColor=C_GREEN,
                   fontName="Helvetica-Bold", leading=10)
    desc_s    = _s("FBDs",  fontSize=7,  textColor=C_SLATE,
                   fontName="Helvetica", leading=10, alignment=TA_JUSTIFY)

    sections = [
        ("💪 Protein-Rich Foods", C_BLUE,    C_BLUE_LITE,  C_BLUE_BRD,  "protein"),
        ("🩸 Iron-Rich Foods",   C_RED,     C_RED_LITE,   C_RED_BRD,   "iron"),
        ("🦴 Calcium-Rich Foods",C_PURPLE,  colors.HexColor("#F5F3FF"),
                                             colors.HexColor("#DDD6FE"), "calcium"),
    ]

    for sec_title, c_main, c_lite, c_brd, key in sections:
        foods = _FOOD_BENEFITS[key]

        # Section sub-header
        sub_tbl = Table(
            [[Paragraph(sec_title, sec_hdr_s)]],
            colWidths=[BODY_W],
        )
        sub_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), c_main),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ]))
        story.append(sub_tbl)
        story.append(Spacer(1, 1 * mm))

        # Food rows
        row_data = []
        for fname, qty, desc in foods:
            row_data.append([
                Paragraph(escape(fname), food_s),
                Paragraph(escape(qty),   qty_s),
                Paragraph(escape(desc),  desc_s),
            ])

        food_tbl = Table(
            row_data,
            colWidths=[BODY_W * 0.28, BODY_W * 0.15, BODY_W * 0.57],
        )
        row_styles = [
            ("BOX",           (0, 0), (-1, -1), 0.4, c_brd),
            ("INNERGRID",     (0, 0), (-1, -1), 0.2, c_brd),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 7),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        for ri in range(len(row_data)):
            bg = c_lite if ri % 2 == 0 else C_WHITE
            row_styles.append(("BACKGROUND", (0, ri), (-1, ri), bg))

        food_tbl.setStyle(TableStyle(row_styles))
        story.append(food_tbl)
        story.append(Spacer(1, 3 * mm))

    return story


# ── § 5 QR RECIPE ACCESS ──────────────────────────────────────────────────────

def _build_qr_section(plan: dict, base_url: str) -> list:
    story = []
    story.append(PageBreak())
    story.append(_section_header(
        "§ 5 — QR Recipe Access",
        "Scan any QR code with your smartphone camera — no app needed",
        "⬜",
    ))
    story.append(Spacer(1, 3 * mm))

    # Instruction banner
    instr_s = _s("QRInstr", fontSize=8.5, textColor=C_GREEN_DARK,
                 fontName="Helvetica-Bold", alignment=TA_CENTER, leading=12)
    sub_instr_s = _s("QRSub", fontSize=7.5, textColor=C_SLATE,
                     fontName="Helvetica", alignment=TA_CENTER, leading=11)

    instr_tbl = Table(
        [[Paragraph("📱 How to use: Open your phone camera → Point at any QR code below → Tap the link that appears", instr_s)],
         [Paragraph("Works on all Android and iPhone cameras without any app installation. "
                    "Opens the full recipe in English and Kannada.", sub_instr_s)]],
        colWidths=[BODY_W],
    )
    instr_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_GREEN_LITE),
        ("BOX",           (0, 0), (-1, -1), 0.8, C_GREEN_BRD),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    story.append(instr_tbl)
    story.append(Spacer(1, 4 * mm))

    # Collect unique meals from week
    seen: set[str] = set()
    meals_for_qr: list[dict] = []
    for day_data in plan.get("week", []):
        for key in ("breakfast", "lunch", "dinner"):
            meal = day_data.get(key, {})
            name = meal.get("name_en", "")
            if name and name not in seen:
                seen.add(name)
                meals_for_qr.append(meal)
                if len(meals_for_qr) >= 9:   # max 9 QR codes per page (3×3)
                    break
        if len(meals_for_qr) >= 9:
            break

    base = base_url.rstrip("/")
    qr_cells = []

    name_s = _s("QRNm",  fontSize=7.5, textColor=C_NAVY,
                fontName="Helvetica-Bold", alignment=TA_CENTER, leading=10)
    kn_s   = _s("QRKn",  fontSize=6.5, textColor=C_SAFFRON,
                fontName="Helvetica",      alignment=TA_CENTER, leading=9)
    url_s  = _s("QRUrl", fontSize=5.5, textColor=C_MUTED,
                fontName="Helvetica",      alignment=TA_CENTER, leading=8)

    for meal in meals_for_qr:
        name     = meal.get("name_en", "")
        name_kn  = meal.get("name_kn", "")
        slug     = name.replace(" ", "_")
        recipe_url = f"{base}/recipes/{slug}"
        # Also show plan URL below
        plan_url   = f"{base}/plan/{plan.get('share_token','')}"

        qr_img = _qr_image(recipe_url, pts=52)
        if qr_img is None:
            continue

        cell = [
            qr_img,
            Spacer(1, 1 * mm),
            Paragraph(escape(name),    name_s),
            Paragraph(escape(name_kn), kn_s),
            Paragraph(escape(recipe_url[-38:]), url_s),
        ]
        qr_cells.append(cell)

    # Pad to multiple of 3
    while len(qr_cells) % 3 != 0:
        qr_cells.append([""])

    rows = [qr_cells[i:i+3] for i in range(0, len(qr_cells), 3)]
    if rows:
        qr_tbl = Table(
            rows,
            colWidths=[BODY_W / 3] * 3,
        )
        qr_tbl.setStyle(TableStyle([
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_RULE),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GREEN_BRD),
            ("TOPPADDING",    (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(qr_tbl)
        story.append(Spacer(1, 3 * mm))

    # Full-plan QR
    share_token = plan.get("share_token", "")
    if share_token:
        full_url  = f"{base}/plan/{share_token}"
        full_qr   = _qr_image(full_url, pts=80)
        full_lbl_s = _s("FullQRL", fontSize=8.5, textColor=C_GREEN_DARK,
                         fontName="Helvetica-Bold", alignment=TA_CENTER, leading=12)
        full_url_s = _s("FullQRU", fontSize=6.5, textColor=C_MUTED,
                         fontName="Helvetica", alignment=TA_CENTER, leading=9)

        if full_qr:
            plan_qr_tbl = Table(
                [[full_qr,
                  [Paragraph("📄 Full Meal Plan", full_lbl_s),
                   Spacer(1, 2 * mm),
                   Paragraph("Scan to open the complete interactive meal plan with all recipes, "
                              "nutrition analysis and week-by-week breakdown.", full_url_s),
                   Spacer(1, 2 * mm),
                   Paragraph(escape(full_url), full_url_s)]]],
                colWidths=[25 * mm, BODY_W - 25 * mm],
            )
            plan_qr_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), C_GREEN_LITE),
                ("BOX",           (0, 0), (-1, -1), 0.8, C_GREEN_BRD),
                ("ALIGN",         (0, 0), (0, 0),   "CENTER"),
                ("VALIGN",        (0, 0), (-1, -1),  "MIDDLE"),
                ("LEFTPADDING",   (0, 0), (-1, -1),  10),
                ("RIGHTPADDING",  (0, 0), (-1, -1),  10),
                ("TOPPADDING",    (0, 0), (-1, -1),  10),
                ("BOTTOMPADDING", (0, 0), (-1, -1),  10),
            ]))
            story.append(plan_qr_tbl)

    return story


# ── § 6 PARENT GUIDANCE ───────────────────────────────────────────────────────

_PARENT_TIPS = [
    ("💧 Water intake",
     "Ensure the child drinks 6–8 glasses of clean water daily. Dehydration "
     "reduces concentration and physical performance in school.",
     "Send a 500 ml water bottle to school every day. Remind at breakfast, "
     "after school and before bed."),
    ("🍎 Daily fruits",
     "Include at least one seasonal fruit daily — bananas, guavas, papayas "
     "and mangoes are available year-round at low cost across Karnataka.",
     "Offer fruit as an after-school snack instead of biscuits or chips."),
    ("🚫 Reduce processed foods",
     "Packaged snacks, instant noodles, chips and sugary drinks contain "
     "excess salt, sugar and trans fats. These displace real nutrition.",
     "Replace one packaged snack per day with groundnut laddu, "
     "banana sheera or sprouted moong salad."),
    ("🥗 Balanced plate",
     "Every meal should have a grain (rice/ragi/jowar), a protein (dal/egg/"
     "legume), a vegetable and a small amount of healthy fat (ghee/oil).",
     "Use the 'half plate' rule: half the plate is vegetables, quarter is grain, "
     "quarter is protein."),
    ("🌙 Never skip dinner",
     "Dinner provides nutrients for overnight growth and repair. Children who "
     "skip dinner show slower growth and lower haemoglobin levels.",
     "Serve a light but complete dinner — curd rice, khichdi or ragi mudde "
     "with sambar is sufficient even on busy nights."),
    ("🏃 Physical activity",
     "30–45 minutes of outdoor physical activity improves appetite, bone "
     "density, muscle development and mental health.",
     "Encourage school-ground play, cycling, or walking. Reduce screen "
     "time to under 2 hours on school days."),
]

def _build_parent_guidance(plan: dict) -> list:
    story = []
    story.append(Spacer(1, 5 * mm))
    story.append(_section_header(
        "§ 6 — Parent Guidance",
        "Simple, actionable tips to support your child's nutrition at home",
        "👨‍👩‍👧",
    ))
    story.append(Spacer(1, 3 * mm))

    # Override with AI parent recommendations if available
    ai_parent = [r for r in (plan.get("ai_recommendations") or [])
                 if "parent" in (r.get("destinations") or [])]

    if ai_parent:
        tips = [(r.get("title",""), r.get("parent_guidance",""), "") for r in ai_parent[:6]]
    else:
        tips = _PARENT_TIPS

    icon_s  = _s("PGIc",  fontSize=16, alignment=TA_CENTER, leading=20)
    title_s = _s("PGTit", fontSize=9,  textColor=C_NAVY,
                 fontName="Helvetica-Bold", leading=12)
    body_s  = _s("PGBdy", fontSize=7.5, textColor=C_SLATE,
                 fontName="Helvetica", leading=11, alignment=TA_JUSTIFY)
    act_s   = _s("PGAct", fontSize=7.5, textColor=colors.HexColor("#92400E"),
                 fontName="Helvetica", leading=11)

    tip_rows = []
    for tip_title, tip_body, tip_action in tips:
        parts = tip_title.split(" ", 1)
        icon  = parts[0] if len(parts) > 1 else "▸"
        text  = parts[1] if len(parts) > 1 else tip_title

        card_content = [Paragraph(escape(text), title_s), Spacer(1, 1 * mm),
                        Paragraph(escape(tip_body), body_s)]
        if tip_action:
            card_content += [Spacer(1, 1 * mm),
                             Paragraph(f"✅ Action: {escape(tip_action)}", act_s)]

        tip_rows.append([Paragraph(icon, icon_s), card_content])

    # 2-column layout
    left_tips  = tip_rows[0::2]   # even indices
    right_tips = tip_rows[1::2]   # odd indices

    max_rows = max(len(left_tips), len(right_tips))
    grid_data = []
    for i in range(max_rows):
        l = left_tips[i]  if i < len(left_tips)  else ["", ""]
        r = right_tips[i] if i < len(right_tips) else ["", ""]
        # Each tip is icon + content; pack into a mini table for column layout
        grid_data.append([l, r])

    col_half = BODY_W / 2 - 2 * mm

    def _tip_cell(tip_row):
        if tip_row == ["", ""]:
            return Paragraph("", body_s)
        ic, content = tip_row
        t = Table([[ic, content]], colWidths=[8 * mm, col_half - 8 * mm])
        t.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return t

    for left_tip, right_tip in zip(left_tips + [""] * max_rows,
                                   right_tips + [""] * max_rows):
        if left_tip == "" and right_tip == "":
            break
        l_cell = _tip_cell(left_tip)
        r_cell = _tip_cell(right_tip) if right_tip else Paragraph("", body_s)

        row_tbl = Table(
            [[l_cell, r_cell]],
            colWidths=[col_half + 2 * mm, col_half + 2 * mm],
        )
        row_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_AMBER_LITE),
            ("BOX",           (0, 0), (-1, -1), 0.4, C_AMBER_BRD),
            ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_AMBER_BRD),
            ("TOPPADDING",    (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(row_tbl)
        story.append(Spacer(1, 2 * mm))

    return story


# ── § 7 SCHOOL RECOMMENDATION ─────────────────────────────────────────────────

def _build_school_recommendation(plan: dict) -> list:
    story = []
    story.append(Spacer(1, 5 * mm))
    story.append(_section_header(
        "§ 7 — School Recommendation",
        "Official summary generated for school records and parent communication",
        "🏫",
    ))
    story.append(Spacer(1, 3 * mm))

    student  = plan.get("student_name", "The student")
    bmi_cls  = (plan.get("bmi_class") or "").lower()
    age      = plan.get("age_group", "")
    diet     = plan.get("diet_pref", "").title()
    region   = plan.get("region",    "").replace("_", " ").title()
    avg_cal  = round(plan.get("avg_daily_cal",  0))
    avg_pro  = round(plan.get("avg_protein_g",  0), 1)
    avg_ca   = round(plan.get("avg_calcium_mg", 0))

    # Build dynamic recommendation text
    reco_parts = [
        f"Based on the nutritional assessment carried out by the class teacher, "
        f"{escape(student)} (Age: {age} years, Diet: {diet}, Region: {region}) "
        f"has been assessed and a personalised 7-day meal plan has been generated "
        f"using NutriPrint AI."
    ]

    if bmi_cls == "underweight":
        reco_parts.append(
            f"The student's BMI indicates underweight status. "
            f"It is recommended that the student receive increased calorie intake "
            f"through energy-dense Karnataka foods such as Ragi Mudde, Groundnut "
            f"Laddu and Bisibelebath. The current plan provides an average of "
            f"{avg_cal} kcal/day with {avg_pro}g protein and {avg_ca}mg calcium."
        )
        reco_parts.append(
            "The school health team recommends monthly BMI monitoring and "
            "referral to the school health officer if no improvement is seen "
            "within 8 weeks."
        )
    elif bmi_cls == "normal":
        reco_parts.append(
            f"The student's BMI is within the healthy range. The current plan "
            f"provides {avg_cal} kcal/day, {avg_pro}g protein and {avg_ca}mg "
            f"calcium — well-aligned with ICMR RDA for this age group. "
            f"Continue the current dietary approach."
        )
    elif bmi_cls in ("overweight", "obese"):
        reco_parts.append(
            f"The student's BMI indicates {'overweight' if bmi_cls == 'overweight' else 'obese'} "
            f"status. The meal plan has been designed with a calorie-controlled "
            f"approach providing {avg_cal} kcal/day. The school recommends "
            f"reducing processed food consumption and increasing daily physical "
            f"activity to 45 minutes."
        )
        if bmi_cls == "obese":
            reco_parts.append(
                "⚕️ URGENT: Please consult a doctor or school health officer "
                "within two weeks. Medical supervision is advised."
            )
    else:
        reco_parts.append(
            f"The 7-day plan provides {avg_cal} kcal/day, {avg_pro}g protein "
            f"and {avg_ca}mg calcium. Regular use of this plan will help maintain "
            f"healthy nutritional status throughout the academic year."
        )

    reco_parts.append(
        "This report was generated by NutriPrint, an AI-powered school nutrition "
        "platform developed at Yenepoya Institute of Technology, Moodbidri. "
        "All recommendations are aligned with ICMR Dietary Reference Values and "
        "Indian Academy of Pediatrics growth standards."
    )

    body_s = _s("SRBdy", fontSize=9, textColor=C_NAVY,
                fontName="Helvetica", leading=14, alignment=TA_JUSTIFY,
                spaceAfter=4)
    urgent_s = _s("SRUrg", fontSize=9, textColor=C_RED,
                  fontName="Helvetica-Bold", leading=13, alignment=TA_JUSTIFY)

    reco_content = []
    for part in reco_parts:
        s = urgent_s if part.startswith("⚕️") else body_s
        reco_content.append(Paragraph(part, s))

    reco_tbl = Table(
        [[reco_content]],
        colWidths=[BODY_W],
    )
    reco_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_GRAY_50),
        ("BOX",           (0, 0), (-1, -1), 0.8, C_RULE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(reco_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── Signature block ──────────────────────────────────────────────────────
    sig_label_s  = _s("SigLbl",  fontSize=8, textColor=C_SLATE,
                       fontName="Helvetica", leading=11)
    sig_name_s   = _s("SigNm",   fontSize=8, textColor=C_MUTED,
                       fontName="Helvetica", leading=11)
    sig_line_s   = _s("SigLine", fontSize=8, textColor=C_NAVY,
                       fontName="Helvetica-Bold", leading=12)

    teacher_name = plan.get("teacher_name", "_" * 30)
    school_name  = plan.get("school_name",  "")

    sig_data = [
        [
            [Paragraph("Teacher Signature:", sig_label_s),
             Spacer(1, 8 * mm),
             HRFlowable(width=48 * mm, thickness=0.8, color=C_NAVY),
             Paragraph(escape(teacher_name), sig_name_s)],
            [Paragraph("School Principal / HM:", sig_label_s),
             Spacer(1, 8 * mm),
             HRFlowable(width=48 * mm, thickness=0.8, color=C_NAVY),
             Paragraph("_" * 30, sig_name_s)],
            [Paragraph("School Seal:", sig_label_s),
             Spacer(1, 8 * mm),
             HRFlowable(width=48 * mm, thickness=0.8, color=C_NAVY),
             Paragraph(escape(school_name), sig_name_s)],
        ]
    ]
    sig_tbl = Table(sig_data, colWidths=[BODY_W / 3] * 3)
    sig_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_RULE),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_RULE),
    ]))
    story.append(sig_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── Footer disclaimer ────────────────────────────────────────────────────
    disc_s = _s("Disc", fontSize=6.5, textColor=C_MUTED, fontName="Helvetica",
                alignment=TA_CENTER, leading=9)
    story.append(Paragraph(
        "This report is generated by NutriPrint AI and is intended for educational "
        "and nutritional awareness purposes only. It does not constitute medical "
        "advice. Consult a qualified healthcare professional for clinical decisions.",
        disc_s,
    ))

    return story


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def generate_poster_pdf(plan: dict, base_url: str) -> bytes:
    """
    Generate the Parent Nutrition Awareness Pack PDF.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    share_token = plan.get("share_token", "")

    doc = SimpleDocTemplate(
        buffer,
        pagesize     = A4,
        rightMargin  = MARGIN_H,
        leftMargin   = MARGIN_H,
        topMargin    = MARGIN_V + 6,   # +6 for top accent bar
        bottomMargin = MARGIN_V + 8 * mm,  # +8mm for footer bar
        title        = f"NutriPrint — {plan.get('student_name','Student')} Nutrition Pack",
        author       = "NutriPrint · Yenepoya Institute of Technology",
        subject      = "Parent Nutrition Awareness Pack",
    )

    story: list = []

    # § 1 — Cover + Student Summary
    story.extend(_build_cover(plan, share_token, base_url))

    # § 2 — AI Nutrition Recommendations
    story.extend(_build_ai_section(plan))

    # § 3 — Weekly Meal Plan (new page)
    story.extend(_build_meal_plan(plan))

    # § 4 — Food Benefits
    story.extend(_build_food_benefits())

    # § 5 — QR Recipe Access (new page)
    story.extend(_build_qr_section(plan, base_url))

    # § 6 — Parent Guidance
    story.extend(_build_parent_guidance(plan))

    # § 7 — School Recommendation + signatures
    story.extend(_build_school_recommendation(plan))

    doc.build(story, onFirstPage=_draw_page_chrome, onLaterPages=_draw_page_chrome)
    buffer.seek(0)
    return buffer.read()
