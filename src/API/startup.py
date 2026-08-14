"""
Startup helper — loads .env and starts the FastAPI server.
Run with: python startup.py
"""
import os
import subprocess
import sys

# Load .env from src/ (parent of API/)
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ .env loaded from {os.path.abspath(env_path)}")
    else:
        print(f"⚠️  No .env found at {os.path.abspath(env_path)} — using system environment variables")
except ImportError:
    print("⚠️  python-dotenv not installed; skipping .env load")

if __name__ == "__main__":
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=os.path.dirname(__file__),
    )
