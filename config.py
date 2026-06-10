from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY        = os.getenv("GROQ_API_KEY")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_KEY        = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SECRET_KEY          = os.getenv("SECRET_KEY")
ADMIN_TOKEN         = os.getenv("ADMIN_TOKEN")