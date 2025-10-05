from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# API Configuration
API_KEYS = ["039e0e90eb64a66b02f4a8c6eb85dc37"]

# CORS configuration
ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://biabcaval.github.io"
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