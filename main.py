from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from routers import bmi, meals, foods, auth, poster

app = FastAPI(
    debug=True,
    title       = "NutriPrint V2",
    description = "AI-powered school nutrition app for Karnataka",
    version     = "2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Static files + templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Include all routers
app.include_router(bmi.router)
app.include_router(meals.router)
app.include_router(foods.router)
app.include_router(auth.router)
app.include_router(poster.router)

# Homepage
@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

# Dashboard
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

# Health check for UptimeRobot
@app.get("/ping")
async def ping():
    return {"status": "ok", "app": "NutriPrint V2"}

# Startup event
@app.on_event("startup")
async def startup_event():
    print("🚀 NutriPrint V2 started!")
    print("📊 API docs: /docs")
    print("🏥 Health:   /ping")

from routers.foods import router as foods_router
# already included — just add /api/chat inside foods.py
# and add this in main.py:
@app.post("/api/chat")
async def chat_proxy(data: dict):
    from routers.foods import chat
    from pydantic import BaseModel
    class CM(BaseModel):
        message: str
    return await chat(CM(message=data["message"]))

@app.get("/api/impact")
async def impact_proxy():
    from models.db import supabase
    plans    = supabase.table("meal_plans").select("id", count="exact").execute()
    students = supabase.table("students").select("id",   count="exact").execute()
    return {
        "total_plans"   : plans.count    or 0,
        "total_students": students.count or 0,
        "total_foods"   : 53,
    }
