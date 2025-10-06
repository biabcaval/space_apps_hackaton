from fastapi import APIRouter, Query, Body
from typing import Optional, Dict, Any
from app.services import (
    fetch_pollution_data, 
    fetch_daily_forecast_data, 
    search_location, 
    fetch_weather_forecast,
    fetch_tempo_gas_volume,
    fetch_daymet_data,
    fetch_daymet_climate_summary,
    generate_health_advice,
    save_json_to_mongodb
)
from fastapi import APIRouter, Query, Body, Depends
from pydantic import BaseModel
from typing import Optional
from .services import get_health_params, HealthAdviceParams
from fastapi import HTTPException

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
            "daymet_weather": "/weather/daymet?lat={lat}&lon={lon}&variables={vars}&years={years}",
            "daymet_climate": "/weather/daymet/climate-summary?lat={lat}&lon={lon}&start_year={year}&end_year={year}",
            "health_advice": "POST /health/advice?aqi={aqi}&risk_group={group}&pm2_5={pm2_5}&pm10={pm10}&no2={no2}&o3={o3}",
            "store_data": "POST /data/store?collection={collection_name} (with JSON body)",
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


@router.get("/weather/daymet")
async def get_daymet_weather_data(
    lat: float = Query(..., description="Latitude (14.5°N to 52.0°N)", ge=14.5, le=52.0),
    lon: float = Query(..., description="Longitude (-131.0°W to -53.0°W)", ge=-131.0, le=-53.0),
    variables: str = Query("tmax,tmin,prcp", description="Comma-separated variables (tmax,tmin,prcp,srad,vp,swe,dayl)"),
    years: str = Query(None, description="Comma-separated years (e.g., '2020,2021,2022')"),
    start_date: str = Query(None, description="Start date (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str = Query(None, description="End date (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$")
):
    """
    Get daily weather/climate data from Daymet API for North America
    
    Daymet provides daily surface weather data for North America from 1980 onwards.
    Coverage area: 14.5°N to 52.0°N latitude, -131.0°W to -53.0°W longitude
    
    Available variables:
    - tmax: Maximum temperature (°C)
    - tmin: Minimum temperature (°C)  
    - prcp: Precipitation (mm/day)
    - srad: Shortwave radiation (W/m²)
    - vp: Vapor pressure (Pa)
    - swe: Snow-water equivalent (kg/m²)
    - dayl: Daylength (seconds)
    
    Time parameters (use one):
    - years: Specific years (e.g., "2020,2021,2022")
    - start_date & end_date: Date range (YYYY-MM-DD format)
    - If none provided: defaults to previous year
    """
    return await fetch_daymet_data(lat, lon, variables, years, start_date, end_date)


@router.get("/weather/daymet/climate-summary")
async def get_daymet_climate_summary(
    lat: float = Query(..., description="Latitude (14.5°N to 52.0°N)", ge=14.5, le=52.0),
    lon: float = Query(..., description="Longitude (-131.0°W to -53.0°W)", ge=-131.0, le=-53.0),
    start_year: int = Query(None, description="Start year (default: 10 years ago)", ge=1980),
    end_year: int = Query(None, description="End year (default: last year)", ge=1980)
):
    """
    Get multi-year climate summary from Daymet API
    
    Returns temperature and precipitation statistics over multiple years.
    Useful for understanding long-term climate patterns and trends.
    
    Default: 10-year climate summary (temperature and precipitation only)
    """
    return await fetch_daymet_climate_summary(lat, lon, start_year, end_year)

@router.post("/health/advice")
async def get_health_advice(
    params: HealthAdviceParams = Depends(get_health_params)
):
    """
    Generate personalized health advice using LLM for a specific risk group
    
    This endpoint accepts parameters either as query parameters or in the request body.
    
    Query parameters example:
    POST /health/advice?aqi=3&risk_group=Elderly&pm2_5=20
    
    Body example:
    POST /health/advice
    {
        "aqi": 3,
        "risk_group": "Elderly",
        "pm2_5": 20
    }
    
    Risk groups include:
    - General Population
    - Elderly (65+)
    - Children
    - People with Respiratory Conditions
    - People with Cardiovascular Conditions
    - Pregnant Women
    - Outdoor Workers
    """
    pollutants = {}
    if params.pm2_5 is not None:
        pollutants['pm2_5'] = params.pm2_5
    if params.pm10 is not None:
        pollutants['pm10'] = params.pm10
    if params.no2 is not None:
        pollutants['no2'] = params.no2
    if params.o3 is not None:
        pollutants['o3'] = params.o3
    
    return await generate_health_advice(
        params.aqi, 
        params.risk_group, 
        pollutants if pollutants else None
    )

@router.post("/data/store")
async def store_json_data(
    collection: str = Query(..., description="MongoDB collection name to store data in"),
    data: Dict[str, Any] = Body(..., description="JSON data to store")
):
    """
    Store JSON data to MongoDB
    
    This endpoint accepts any JSON data and stores it in the specified MongoDB collection.
    A timestamp will be automatically added if not present in the data.
    
    Parameters:
    - collection: Name of the MongoDB collection (e.g., 'notifications', 'user_data', 'sensor_readings')
    - data: JSON object containing the data to store
    
    Returns:
    - success: Boolean indicating if the operation was successful
    - collection: Name of the collection where data was stored
    - document_id: MongoDB ObjectId of the inserted document
    - timestamp: ISO timestamp of when the data was stored
    
    Example:
    ```
    POST /data/store?collection=notifications
    {
        "user_id": "12345",
        "message": "Air quality alert",
        "location": {"lat": 40.7128, "lon": -74.0060}
    }
    ```
    """
    return await save_json_to_mongodb(collection, data)