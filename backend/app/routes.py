from fastapi import APIRouter, Query
from app.services import fetch_pollution_data, fetch_daily_forecast_data, search_location

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
    limit: int = Query(5, description="Maximum number of results to return", ge=1, le=10)
):
    """
    Search for locations using OpenWeatherMap Geocoding API
    Returns a list of matching locations with coordinates
    """
    results = await search_location(q, limit)
    return {
        "success": True,
        "query": q,
        "count": len(results),
        "results": results
    }