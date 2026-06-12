from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
import io
import qrcode
from PIL import Image as PILImage
from xml.sax.saxutils import escape

# ── Colors ───────────────────────────────────────────────
PRIMARY    = colors.HexColor('#1D9E75')
SAFFRON    = colors.HexColor('#F97316')
DARK       = colors.HexColor('#1A1A2E')
GRAY       = colors.HexColor('#6B7280')
LIGHT_GRAY = colors.HexColor('#F8FAF9')
WHITE      = colors.white
RED        = colors.HexColor('#EF4444')
BLUE       = colors.HexColor('#3B82F6')
AMBER      = colors.HexColor('#FBBF24')

# ── Classification Colors ─────────────────────────────────
CLASS_COLORS = {
    'underweight': BLUE,
    'normal'     : PRIMARY,
    'overweight' : SAFFRON,
    'obese'      : RED,
}

def generate_qr_image(url: str, size: int = 80) -> PILImage.Image:
    qr_img = qrcode.make(url)
    qr_img = qr_img.resize((size, size))
    return qr_img

def pil_to_reportlab(pil_img):
    """Convert PIL image to ReportLab Image."""
    from reportlab.platypus import Image as RLImage
    buf = io.BytesIO()
    pil_img.save(buf, format='PNG')
    buf.seek(0)
    return RLImage(buf, width=22*mm, height=22*mm)

def generate_poster_pdf(plan: dict, base_url: str) -> bytes:
    """
    Generate A4 PDF poster for a meal plan.
    plan: dict from MealPlan.dict()
    Returns: PDF bytes
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize     = A4,
        rightMargin  = 12*mm,
        leftMargin   = 12*mm,
        topMargin    = 12*mm,
        bottomMargin = 12*mm,
    )

    W = A4[0] - 24*mm   # usable width
    story = []

    # ── STYLES ───────────────────────────────────────────
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'Title',
        fontSize  = 18,
        textColor = WHITE,
        fontName  = 'Helvetica-Bold',
        alignment = TA_LEFT,
        leading   = 22,
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        fontSize  = 9,
        textColor = colors.HexColor('#D1FAE5'),
        fontName  = 'Helvetica',
        alignment = TA_LEFT,
        leading   = 13,
    )
    info_style = ParagraphStyle(
        'Info',
        fontSize  = 9,
        textColor = WHITE,
        fontName  = 'Helvetica',
        alignment = TA_RIGHT,
        leading   = 13,
    )
    section_style = ParagraphStyle(
        'Section',
        fontSize  = 10,
        textColor = DARK,
        fontName  = 'Helvetica-Bold',
        alignment = TA_LEFT,
        leading   = 14,
    )
    cell_en_style = ParagraphStyle(
        'CellEN',
        fontSize  = 7.5,
        textColor = DARK,
        fontName  = 'Helvetica-Bold',
        leading   = 10,
    )
    cell_meta_style = ParagraphStyle(
        'CellMeta',
        fontSize  = 6.5,
        textColor = GRAY,
        fontName  = 'Helvetica',
        leading   = 9,
    )
    small_style = ParagraphStyle(
        'Small',
        fontSize  = 7,
        textColor = GRAY,
        fontName  = 'Helvetica',
        alignment = TA_CENTER,
        leading   = 10,
    )
    footer_style = ParagraphStyle(
        'Footer',
        fontSize  = 7,
        textColor = GRAY,
        fontName  = 'Helvetica',
        alignment = TA_CENTER,
        leading   = 10,
    )

    # ── HEADER TABLE ─────────────────────────────────────
    student_name = plan.get('student_name', 'Student')
    school_name  = plan.get('school_name',  'School')
    teacher_name = plan.get('teacher_name', '')
    region       = plan.get('region', '').replace('_', ' ').title()
    month        = plan.get('month',  '').title()
    diet_pref    = plan.get('diet_pref', '').title()
    age_group    = plan.get('age_group', '')
    bmi_class    = plan.get('bmi_class', '')
    share_token  = plan.get('share_token', '')

    header_left = [
        Paragraph('NutriPrint', title_style),
        Paragraph('AI-Powered School Nutrition · Karnataka', subtitle_style),
        Spacer(1, 2*mm),
        Paragraph(
            f'<font size="8" color="#BBF7D0">Karnataka School Nutrition Plan</font>',
            subtitle_style
        ),
    ]

    teacher_line = f'Teacher: {teacher_name}' if teacher_name else ''
    header_right = [
        Paragraph(f'<b>{student_name}</b>', info_style),
        Paragraph(school_name, info_style),
        Paragraph(teacher_line, info_style),
        Paragraph(f'{month} · {region}', info_style),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths = [W * 0.62, W * 0.38],
    )
    header_table.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,-1), PRIMARY),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [PRIMARY]),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING',(0,0), (-1,-1), 8),
        ('TOPPADDING',  (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0),(-1,-1), 8),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 3*mm))

    # ── INFO CHIPS ROW ────────────────────────────────────
    chips_data = [
        f'Age: {age_group} yrs',
        diet_pref,
        region,
        month,
        'Under Rs.150/day',
    ]
    chip_cells = [[Paragraph(c, ParagraphStyle(
        'Chip',
        fontSize  = 7.5,
        textColor = PRIMARY,
        fontName  = 'Helvetica-Bold',
        alignment = TA_CENTER,
    )) for c in chips_data]]

    chips_table = Table(
        chip_cells,
        colWidths = [W/5] * 5,
    )
    chips_table.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), colors.HexColor('#F0FDF4')),
        ('BOX',          (0,0), (0,0),   0.5, colors.HexColor('#BBF7D0')),
        ('BOX',          (1,0), (1,0),   0.5, colors.HexColor('#BBF7D0')),
        ('BOX',          (2,0), (2,0),   0.5, colors.HexColor('#BBF7D0')),
        ('BOX',          (3,0), (3,0),   0.5, colors.HexColor('#BBF7D0')),
        ('BOX',          (4,0), (4,0),   0.5, colors.HexColor('#FED7AA')),
        ('BACKGROUND',   (4,0), (4,0),   colors.HexColor('#FFF7ED')),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(chips_table)
    story.append(Spacer(1, 3*mm))

    # ── NUTRITION SUMMARY ────────────────────────────────
    avg_cal  = plan.get('avg_daily_cal',  0)
    avg_pro  = plan.get('avg_protein_g',  0)
    avg_ca   = plan.get('avg_calcium_mg', 0)
    avg_fe   = plan.get('avg_iron_mg',    0)
    tot_cost = plan.get('total_cost_inr', 0)

    nut_style = ParagraphStyle(
        'Nut',
        fontSize  = 7,
        textColor = GRAY,
        fontName  = 'Helvetica',
        alignment = TA_CENTER,
        leading   = 10,
    )
    nut_val_style = ParagraphStyle(
        'NutVal',
        fontSize  = 11,
        textColor = PRIMARY,
        fontName  = 'Helvetica-Bold',
        alignment = TA_CENTER,
        leading   = 14,
    )

    nut_data = [[
        [Paragraph(str(avg_cal),  nut_val_style),
         Paragraph('Cal/day',     nut_style)],
        [Paragraph(f'{avg_pro}g', nut_val_style),
         Paragraph('Protein',     nut_style)],
        [Paragraph(f'{avg_ca}mg', nut_val_style),
         Paragraph('Calcium',     nut_style)],
        [Paragraph(f'{avg_fe}mg', nut_val_style),
         Paragraph('Iron',        nut_style)],
        [Paragraph(f'Rs.{tot_cost}', nut_val_style),
         Paragraph('Week Total',  nut_style)],
    ]]

    nut_table = Table(nut_data, colWidths=[W/5]*5)
    nut_table.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), LIGHT_GRAY),
        ('BOX',          (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('INNERGRID',    (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',        (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
    ]))
    story.append(nut_table)
    story.append(Spacer(1, 3*mm))

    # ── BMI ADVICE (if available) ─────────────────────────
    if bmi_class:
        bmi_color = CLASS_COLORS.get(bmi_class, PRIMARY)
        advice_style = ParagraphStyle(
            'Advice',
            fontSize  = 8,
            textColor = colors.HexColor('#92400E'),
            fontName  = 'Helvetica',
            leading   = 12,
        )
        bmi_badge_style = ParagraphStyle(
            'BMIBadge',
            fontSize  = 8,
            textColor = WHITE,
            fontName  = 'Helvetica-Bold',
            alignment = TA_CENTER,
        )
        advice_table = Table(
            [[
                Paragraph(f'BMI: {bmi_class.upper()}', bmi_badge_style),
                Paragraph(
                    'Follow this meal plan regularly to maintain healthy growth.',
                    advice_style
                ),
            ]],
            colWidths=[W*0.2, W*0.8]
        )
        advice_table.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (0,0),   bmi_color),
            ('BACKGROUND',   (1,0), (1,0),   colors.HexColor('#FFF7ED')),
            ('BOX',          (0,0), (-1,-1), 0.5, colors.HexColor('#FED7AA')),
            ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING',   (0,0), (-1,-1), 6),
            ('BOTTOMPADDING',(0,0), (-1,-1), 6),
            ('LEFTPADDING',  (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(advice_table)
        story.append(Spacer(1, 3*mm))

    # ── AI ACTION TIPS ───────────────────────────────────
    ai_recs = [
        rec for rec in plan.get('ai_recommendations', [])
        if 'poster' in (rec.get('destinations') or [])
    ][:5]

    if ai_recs:
        tip_title_style = ParagraphStyle(
            'AITipTitle',
            fontSize=8,
            textColor=PRIMARY,
            fontName='Helvetica-Bold',
            leading=11,
        )
        tip_style = ParagraphStyle(
            'AITip',
            fontSize=7,
            textColor=colors.HexColor('#166534'),
            fontName='Helvetica-Bold',
            leading=10,
        )
        tip_cells = [[Paragraph('AI Action Tips', tip_title_style)]]
        for i in range(0, len(ai_recs), 2):
            left = escape(ai_recs[i].get('short_action', ''))
            right = escape(ai_recs[i + 1].get('short_action', '')) if i + 1 < len(ai_recs) else ''
            tip_cells.append([
                Paragraph(f'✓ {left}', tip_style),
                Paragraph(f'✓ {right}', tip_style) if right else Paragraph('', tip_style),
            ])
        tips_table = Table(tip_cells, colWidths=[W*0.5, W*0.5])
        tips_table.setStyle(TableStyle([
            ('SPAN', (0,0), (-1,0)),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0FDF4')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#BBF7D0')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(tips_table)
        story.append(Spacer(1, 3*mm))

    # ── 7-DAY MEAL TABLE ──────────────────────────────────
    DAYS_KN = {
        'Monday'   : 'ಸೋಮವಾರ',
        'Tuesday'  : 'ಮಂಗಳವಾರ',
        'Wednesday': 'ಬುಧವಾರ',
        'Thursday' : 'ಗುರುವಾರ',
        'Friday'   : 'ಶುಕ್ರವಾರ',
        'Saturday' : 'ಶನಿವಾರ',
        'Sunday'   : 'ಭಾನುವಾರ',
    }

    day_style = ParagraphStyle(
        'Day',
        fontSize  = 8,
        textColor = PRIMARY,
        fontName  = 'Helvetica-Bold',
        leading   = 11,
    )
    day_kn_style = ParagraphStyle(
        'DayKN',
        fontSize  = 7,
        textColor = SAFFRON,
        fontName  = 'Helvetica',
        leading   = 10,
    )
    header_cell_style = ParagraphStyle(
        'HeaderCell',
        fontSize  = 8,
        textColor = WHITE,
        fontName  = 'Helvetica-Bold',
        alignment = TA_CENTER,
        leading   = 11,
    )

    # Table header
    meal_header = [
        Paragraph('Day', header_cell_style),
        Paragraph('Breakfast', header_cell_style),
        Paragraph('Lunch', header_cell_style),
        Paragraph('Dinner', header_cell_style),
    ]

    col_w = [W*0.13, W*0.29, W*0.29, W*0.29]
    table_data = [meal_header]

    week = plan.get('week', [])
    for day_data in week:
        day_name = day_data.get('day', '')
        day_kn   = day_data.get('day_kn', DAYS_KN.get(day_name, ''))

        row = [
            # Day cell
            [
                Paragraph(day_name[:3], day_style),
                Paragraph(day_kn,       day_kn_style),
            ]
        ]

        for meal_key in ['breakfast', 'lunch', 'dinner']:
            meal = day_data.get(meal_key, {})
            name_en  = meal.get('name_en',  '')
            calories = meal.get('calories', 0)
            protein  = meal.get('protein_g', 0)
            cost     = meal.get('cost_inr', 0)

            cell = [
                Paragraph(name_en, cell_en_style),
                Paragraph(
                    f'{calories}cal · {protein}g prot · Rs.{cost}',
                    cell_meta_style
                ),
            ]
            row.append(cell)

        table_data.append(row)

    meal_table = Table(table_data, colWidths=col_w)

    # Alternating row colors
    row_styles = [
        ('BACKGROUND',   (0,0), (-1,0),  PRIMARY),
        ('TEXTCOLOR',    (0,0), (-1,0),  WHITE),
        ('FONTNAME',     (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,0),  8),
        ('ALIGN',        (0,0), (-1,0),  'CENTER'),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('INNERGRID',    (0,0), (-1,-1), 0.3, colors.HexColor('#E5E7EB')),
        ('BOX',          (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
    ]

    for i in range(1, len(table_data)):
        bg = LIGHT_GRAY if i % 2 == 0 else WHITE
        row_styles.append(('BACKGROUND', (0,i), (-1,i), bg))

    meal_table.setStyle(TableStyle(row_styles))
    story.append(meal_table)
    story.append(Spacer(1, 3*mm))

    # ── FOOTER WITH QR ────────────────────────────────────
    base = base_url if base_url.endswith("/") else f"{base_url}/"
    plan_url = f"{base}plan/{share_token}"
    qr_image  = None

    try:
        qr_pil   = generate_qr_image(plan_url, size=100)
        qr_image = pil_to_reportlab(qr_pil)
    except Exception:
        pass

    footer_left = [
        Paragraph(
            '<b>NutriPrint</b> · nutriprint.onrender.com',
            footer_style
        ),
        Paragraph(
            'Free for all Karnataka schools',
            footer_style
        ),
        Paragraph(
            'Yenepoya Institute of Technology, Moodbidri',
            footer_style
        ),
    ]

    if qr_image:
        footer_data  = [[footer_left, qr_image]]
        footer_table = Table(
            footer_data,
            colWidths=[W*0.75, W*0.25]
        )
    else:
        footer_table = Table(
            [[footer_left]],
            colWidths=[W]
        )

    footer_table.setStyle(TableStyle([
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',        (0,0), (0,0),   'LEFT'),
        ('ALIGN',        (1,0), (1,0),   'RIGHT'),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LINEABOVE',    (0,0), (-1,0),  0.5, colors.HexColor('#E5E7EB')),
    ]))

    story.append(footer_table)

    # ── BUILD PDF ─────────────────────────────────────────
    doc.build(story)
    buffer.seek(0)
    return buffer.read()
