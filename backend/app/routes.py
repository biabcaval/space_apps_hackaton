from fastapi import APIRouter, Query
from app.services import (
    fetch_pollution_data, 
    fetch_daily_forecast_data, 
    search_location, 
    fetch_weather_forecast,
    fetch_tempo_gas_volume
)

router = APIRouter()

@router.get("/")
async def read_root():
    return {
        "message": "Air Quality Monitor API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "current_pollution": "/air-pollution/current?lat={lat}&lon={lon}",
            "forecast_pollution": "/air-pollution/forecast?lat={lat}&lon={lon}",
            "daily_forecast": "/air-pollution/forecast-daily?lat={lat}&lon={lon}",
            "geocoding_search": "/geocoding/search?q={query}&limit={limit}",
            "weather_forecast": "/weather/forecast?lat={lat}&lon={lon}",
            "tempo_gas_data": "/air-pollution/tempo?gas={gas}&lat={lat}&lon={lon}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}",
            "docs": "/docs"
        }
    }

@router.get("/air-pollution/forecast")
async def get_air_pollution_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    return await fetch_pollution_data(lat, lon, "/forecast")

@router.get("/air-pollution/current")
async def get_current_air_pollution(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    return await fetch_pollution_data(lat, lon, "")

@router.get("/air-pollution/forecast-daily")
async def get_daily_air_pollution_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get daily averaged air pollution forecast for given coordinates using OpenWeatherMap API
    """
    return await fetch_daily_forecast_data(lat, lon)

@router.get("/geocoding/search")
async def search_locations(
    q: str = Query(..., description="Location query (city name, address, etc.)"),
    limit: int = Query(5, description="Maximum number of results to return", ge=1, le=10),
    country: str = Query(None, description="Country code filter (e.g., 'US')")
):
    """
    Search for locations using OpenWeatherMap Geocoding API
    Returns a list of matching locations with coordinates
    """
    results = await search_location(q, limit, country)
    return {
        "success": True,
        "query": q,
        "count": len(results),
        "results": results
    }

@router.get("/weather/forecast")
async def get_weather_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get weather forecast data for given coordinates using Open-Meteo API
    Returns hourly and daily weather forecasts including temperature, precipitation, wind, and humidity
    """
    return await fetch_weather_forecast(lat, lon)

@router.get("/air-pollution/tempo")
async def get_tempo_gas_data(
    gas: str = Query(..., description="Gas type (NO2, HCHO, O3PROF, O3TOT)"),
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate"),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$")
):
    """
    Get NASA TEMPO satellite gas measurement data for a specific location
    
    Supported gases:
    - NO2: Nitrogen Dioxide
    - HCHO: Formaldehyde  
    - O3PROF: Ozone Profile
    - O3TOT: Total Ozone
    
    Returns tropospheric column density and estimated gas volume based on elevation
    """
    return await fetch_tempo_gas_volume(gas, lat, lon, start_date, end_date)