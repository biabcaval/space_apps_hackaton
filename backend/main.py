import uvicorn 
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


# Initialize FastAPI app
app = FastAPI(
    title="Air Quality Monitor API",
    description="API for fetching air pollution data using OpenWeatherMap",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",  # Frontend development server
    "http://localhost:5173",  # Vite default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# API Configuration
API_KEYS = ["039e0e90eb64a66b02f4a8c6eb85dc37"]  # OpenWeatherMap API keys


@app.get("/")
def read_root():
    """
    Root endpoint - API health check
    """
    return {
        "message": "Air Quality Monitor API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "current_pollution": "/air-pollution/current?lat={lat}&lon={lon}",
            "forecast_pollution": "/air-pollution/forecast?lat={lat}&lon={lon}",
            "docs": "/docs"
        }
    }


@app.get("/air-pollution/forecast")
def get_air_pollution_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get air pollution forecast for given coordinates using OpenWeatherMap API
    """
    for api_key in API_KEYS:
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={api_key}"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
            
            data = response.json()
            
            # Add some metadata to the response
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "data": data,
                "source": "OpenWeatherMap API"
            }
            
        except requests.exceptions.RequestException as e:
            print(f"Error with API key {api_key}: {e}")
            continue
    
    # If all API keys failed
    raise HTTPException(
        status_code=503, 
        detail="Unable to fetch air pollution data. All API keys failed or service unavailable."
    )


@app.get("/air-pollution/current")
def get_current_air_pollution(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get current air pollution data for given coordinates using OpenWeatherMap API
    """
    for api_key in API_KEYS:
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={api_key}"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
            
            data = response.json()
            
            # Add some metadata to the response
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "data": data,
                "source": "OpenWeatherMap API"
            }
            
        except requests.exceptions.RequestException as e:
            print(f"Error with API key {api_key}: {e}")
            continue
    
    # If all API keys failed
    raise HTTPException(
        status_code=503, 
        detail="Unable to fetch air pollution data. All API keys failed or service unavailable."
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)