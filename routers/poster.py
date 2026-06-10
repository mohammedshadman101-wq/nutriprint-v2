from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from models.db import supabase
from models.schemas import MealPlan
import io

router    = APIRouter(tags=["Poster"])
templates = Jinja2Templates(directory="templates")

def _get_plan_by_token(token: str):
    result = supabase.table("meal_plans")\
        .select("*")\
        .eq("share_token", token)\
        .single()\
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    row = result.data
    return row, MealPlan(**{
        **row["plan_json"],
        "plan_id"    : str(row["id"]),
        "share_token": str(row["share_token"]),
    })

@router.get("/plan/{share_token}", response_class=HTMLResponse)
async def plan_public(request: Request, share_token: str):
    try:
        row, plan = _get_plan_by_token(share_token)
        return templates.TemplateResponse("plan_public.html", {
            "request"     : request,
            "plan"        : plan,
            "share_token" : share_token,
            "base_url"    : str(request.base_url),
        })
    except Exception as e:
        raise HTTPException(status_code=404, detail="Plan not found")

@router.get("/poster/{share_token}/pdf")
async def download_pdf(share_token: str, request: Request):
    try:
        from services.pdf_generator import generate_poster_pdf

        row, plan = _get_plan_by_token(share_token)

        pdf_bytes = generate_poster_pdf(
            plan     = plan.dict(),
            base_url = str(request.base_url),
        )

        filename = f"NutriPrint_{plan.student_name.replace(' ','_')}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type = "application/pdf",
            headers    = {
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))