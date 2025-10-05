import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# API Configuration - Load multiple API keys from environment variables
def load_api_keys():
    """Load multiple API keys from environment variables with fallback support"""
    api_keys = []
    
    # Method 1: Load individual numbered keys
    for i in range(1, 6):  # Support up to 5 API keys
        key = os.getenv(f"OPENWEATHER_API_KEY_{i}")
        if key and key.strip():  # Only add non-empty keys
            api_keys.append(key.strip())
    
    # Method 2: Also support comma-separated keys (alternative approach)
    comma_separated = os.getenv("OPENWEATHER_API_KEYS")
    if comma_separated:
        additional_keys = [key.strip() for key in comma_separated.split(",") if key.strip()]
        api_keys.extend(additional_keys)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keys = []
    for key in api_keys:
        if key not in seen:
            seen.add(key)
            unique_keys.append(key)
    
    if not unique_keys:
        raise ValueError("No valid OPENWEATHER_API_KEY found in environment variables. Please check your .env file.")
    
    print(f"Loaded {len(unique_keys)} API key(s) for fallback support")
    return unique_keys

# Load API keys with fallback support
API_KEYS = load_api_keys()

# CORS configuration
ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]

def create_app():
    app = FastAPI(
        title="Air Quality Monitor API",
        description="API for fetching air pollution data using OpenWeatherMap",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    return app