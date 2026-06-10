from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates

from models.db import supabase
from models.schemas import MealPlan

import io
import json
import re

router = APIRouter(tags=["Poster"])
templates = Jinja2Templates(directory="templates")


def _get_plan_by_token(token: str):
    result = (
        supabase.table("meal_plans")
        .select("*")
        .eq("share_token", token)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Plan not found"
        )

    row = result.data

    plan_json = row.get("plan_json", {})

    if isinstance(plan_json, str):
        plan_json = json.loads(plan_json)

    # Prevent duplicate keyword errors
    plan_json.pop("plan_id", None)
    plan_json.pop("share_token", None)

    plan_json["plan_id"] = str(row["id"])
    plan_json["share_token"] = str(row["share_token"])

    plan = MealPlan(**plan_json)

    return row, plan


@router.get("/plan/{share_token}", response_class=HTMLResponse)
async def plan_public(
    request: Request,
    share_token: str
):
    try:
        row, plan = _get_plan_by_token(share_token)

        return templates.TemplateResponse(
            "plan_public.html",
            {
                "request": request,
                "plan": plan,
                "share_token": share_token,
                "base_url": str(request.base_url),
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/report/{share_token}", response_class=HTMLResponse)
async def health_report(
    request: Request,
    share_token: str
):
    try:
        row, plan = _get_plan_by_token(share_token)

        return templates.TemplateResponse(
            "health_report.html",
            {
                "request": request,
                "plan": plan,
                "share_token": share_token,
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/poster/{share_token}/pdf")
async def download_pdf(
    share_token: str,
    request: Request
):
    try:
        from services.pdf_generator import generate_poster_pdf

        row, plan = _get_plan_by_token(share_token)

        try:
            plan_data = plan.model_dump()
        except AttributeError:
            plan_data = plan.dict()

        plan_data["share_token"] = share_token

        pdf_bytes = generate_poster_pdf(
            plan=plan_data,
            base_url=str(request.base_url),
        )

        safe_name = re.sub(
            r"[^a-zA-Z0-9_-]",
            "",
            plan.student_name.replace(" ", "_")
        )

        filename = f"NutriPrint_{safe_name}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition":
                f'attachment; filename="{filename}"'
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
