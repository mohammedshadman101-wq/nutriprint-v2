import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from routers import ai_advisor, bmi, meals, foods, auth, poster
from routers.foods import impact

app = FastAPI(
    debug=os.getenv("DEBUG", "false").lower() == "true",
    title="NutriPrint V2",
    description="AI-powered school nutrition app for Karnataka",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(bmi.router)
app.include_router(meals.router)
app.include_router(meals.legacy_router)
app.include_router(foods.router)
app.include_router(auth.router)
app.include_router(auth.legacy_router)
app.include_router(poster.router)
app.include_router(ai_advisor.router)


@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


@app.get("/bmi", response_class=HTMLResponse)
async def bmi_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="bmi.html",
    )


@app.get("/meal-planner", response_class=HTMLResponse)
async def meal_planner_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="meal_planner.html",
    )


@app.get("/food-catalog", response_class=HTMLResponse)
async def food_catalog_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="food_catalog.html",
    )


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
    )


@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="about.html",
    )


@app.get("/ping")
async def ping():
    return {"status": "ok", "app": "NutriPrint V2"}


@app.on_event("startup")
async def startup_event():
    print("NutriPrint V2 started")
    print("API docs: /docs")
    print("Health:   /ping")


@app.get("/api/impact")
async def impact_proxy():
    return await impact()
