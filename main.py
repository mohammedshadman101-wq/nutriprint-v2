import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from routers import bmi, meals, foods, auth, poster
from routers.foods import chat, get_impact_stats
from routers.foods import ChatMessage

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
app.include_router(foods.router)
app.include_router(auth.router)
app.include_router(poster.router)


@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
    )


@app.get("/ping")
async def ping():
    return {"status": "ok", "app": "NutriPrint V2"}


@app.on_event("startup")
async def startup_event():
    print("NutriPrint V2 started")
    print("API docs: /docs")
    print("Health:   /ping")


@app.post("/api/chat")
async def chat_proxy(data: ChatMessage):
    return await chat(data)


@app.get("/api/impact")
async def impact_proxy():
    return get_impact_stats()
