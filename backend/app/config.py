import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

# Load environment variables from .env file
load_dotenv()

# MongoDB client (lazy initialization)
_mongodb_client: Optional[AsyncIOMotorClient] = None

# API Configuration - Load OpenWeatherMap API keys
def load_openweather_api_keys():
    """Load multiple OpenWeatherMap API keys from environment variables with fallback support"""
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
    
    print(f"Loaded {len(unique_keys)} OpenWeatherMap API key(s) for fallback support")
    return unique_keys

# Load OpenWeatherMap API keys with fallback support
OPENWEATHER_API_KEYS = load_openweather_api_keys()

# NASA Earthdata credentials (for TEMPO data)
EARTHDATA_USERNAME = os.getenv("EARTHDATA_USERNAME")
EARTHDATA_PASSWORD = os.getenv("EARTHDATA_PASSWORD")

# Data directory for TEMPO downloads
TEMPO_DATA_DIR = os.getenv("TEMPO_DATA_DIR", "data/")

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "air_quality_db")

# CORS configuration
ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "https://biabcaval.github.io",
    "https://magnificent-endurance-production.up.railway.app"
]

def get_mongodb_client():
    """Get or create MongoDB client"""
    global _mongodb_client
    if _mongodb_client is None:
        _mongodb_client = AsyncIOMotorClient(MONGO_URI)
        print(f"✅ Connected to MongoDB at {MONGO_URI}")
    return _mongodb_client

def get_mongodb_database():
    """Get MongoDB database instance"""
    client = get_mongodb_client()
    return client[MONGODB_DATABASE]

async def close_mongodb_connection():
    """Close MongoDB connection"""
    global _mongodb_client
    if _mongodb_client is not None:
        _mongodb_client.close()
        _mongodb_client = None
        print("✅ MongoDB connection closed")

def create_app():
    app = FastAPI(
        title="BreezAPI",
        description="API for fetching air pollution data using OpenWeatherMap",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

    # Add startup and shutdown events for MongoDB
    @app.on_event("startup")
    async def startup_event():
        get_mongodb_client()
        print("🚀 Application started")

    @app.on_event("shutdown")
    async def shutdown_event():
        await close_mongodb_connection()
        print("👋 Application shutdown")

    return app