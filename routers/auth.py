import os

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from models.db import supabase

router = APIRouter(prefix="/auth", tags=["Auth"])
legacy_router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginInput(BaseModel):
    email: str

class VerifyInput(BaseModel):
    email: str
    token: str

class TeacherProfile(BaseModel):
    name        : str
    school_name : str
    district    : str
    auth_user_id: str

@router.post("/login")
async def login(data: LoginInput):
    try:
        supabase.auth.sign_in_with_otp({"email": data.email})
        return {"success": True, "message": "OTP sent to your email"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@legacy_router.get("/me")
async def me(request: Request):
    try:
        session_token = request.cookies.get("session")
        if not session_token:
            return {"logged_in": False}

        try:
            auth_result = supabase.auth.get_user(session_token)
            user = getattr(auth_result, "user", None)
        except Exception:
            user = None

        if not user:
            return {"logged_in": False}

        existing = supabase.table("teachers") \
            .select("id, name, school_name, district, auth_user_id") \
            .eq("auth_user_id", user.id) \
            .execute()

        if not existing.data:
            return {
                "logged_in": True,
                "teacher": {
                    "auth_user_id": user.id,
                },
            }

        return {
            "logged_in": True,
            "teacher": existing.data[0],
        }
    except Exception:
        return {"logged_in": False}

@router.post("/verify")
async def verify(data: VerifyInput, response: Response):
    try:
        result = supabase.auth.verify_otp({
            "email": data.email,
            "token": data.token,
            "type" : "email",
        })
        session = result.session
        if not session:
            raise HTTPException(status_code=401, detail="Invalid OTP")

        # Set session cookie
        response.set_cookie(
            key="session",
            value=session.access_token,
            httponly=True,
            secure=os.getenv("ENVIRONMENT", "development") == "production",
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        teacher_id = None
        existing = supabase.table("teachers")\
            .select("id")\
            .eq("auth_user_id", session.user.id)\
            .execute()
        if existing.data:
            teacher_id = existing.data[0]["id"]

        return {
            "success"     : True,
            "user_id"     : session.user.id,
            "teacher_id"  : teacher_id,
            "access_token": session.access_token,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/profile")
async def create_profile(data: TeacherProfile):
    try:
        existing = supabase.table("teachers")\
            .select("id")\
            .eq("auth_user_id", data.auth_user_id)\
            .execute()

        if existing.data:
            return {"success": True, "teacher_id": existing.data[0]["id"]}

        result = supabase.table("teachers").insert({
            "auth_user_id": data.auth_user_id,
            "name"        : data.name,
            "school_name" : data.school_name,
            "district"    : data.district,
        }).execute()

        return {"success": True, "teacher_id": result.data[0]["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    return {"success": True}


@legacy_router.post("/logout")
async def logout_compat(response: Response):
    response.delete_cookie("session")
    return {"success": True}