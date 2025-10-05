import uvicorn 
import requests
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from collections import defaultdict
import statistics

# Load environment variables from .env file
load_dotenv()

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


@app.get("/air-pollution/current")
def get_current_air_pollution(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get current air pollution data for given coordinates using OpenWeatherMap API
    """
    last_error = None
    
    for i, api_key in enumerate(API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(API_KEYS)} for current pollution data...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            print(f"Success with API key {i}")
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "data": data,
                "source": "OpenWeatherMap API",
                "api_key_used": i  # Don't expose the actual key, just the number
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print(f"API key {i} unauthorized (401) - trying next key...")
                last_error = f"API key {i} unauthorized"
            elif e.response.status_code == 429:
                print(f"API key {i} rate limited (429) - trying next key...")
                last_error = f"API key {i} rate limited"
            else:
                print(f"API key {i} HTTP error {e.response.status_code} - trying next key...")
                last_error = f"API key {i} HTTP error {e.response.status_code}"
            continue
        except requests.exceptions.RequestException as e:
            print(f"API key {i} network error: {e} - trying next key...")
            last_error = f"API key {i} network error: {str(e)}"
            continue
    
    # If all API keys failed
    raise HTTPException(
        status_code=503, 
        detail=f"Unable to fetch air pollution data. All {len(API_KEYS)} API keys failed. Last error: {last_error}"
    )


@app.get("/air-pollution/forecast")
def get_air_pollution_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get air pollution forecast for given coordinates using OpenWeatherMap API
    """
    last_error = None
    
    for i, api_key in enumerate(API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(API_KEYS)} for forecast data...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            print(f"Success with API key {i}")
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "data": data,
                "source": "OpenWeatherMap API",
                "api_key_used": i  # Don't expose the actual key, just the number
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print(f"API key {i} unauthorized (401) - trying next key...")
                last_error = f"API key {i} unauthorized"
            elif e.response.status_code == 429:
                print(f"API key {i} rate limited (429) - trying next key...")
                last_error = f"API key {i} rate limited"
            else:
                print(f"API key {i} HTTP error {e.response.status_code} - trying next key...")
                last_error = f"API key {i} HTTP error {e.response.status_code}"
            continue
        except requests.exceptions.RequestException as e:
            print(f"API key {i} network error: {e} - trying next key...")
            last_error = f"API key {i} network error: {str(e)}"
            continue
    
    # If all API keys failed
    raise HTTPException(
        status_code=503, 
        detail=f"Unable to fetch air pollution forecast. All {len(API_KEYS)} API keys failed. Last error: {last_error}"
    )

@app.get("/air-pollution/forecast-daily")
def get_daily_air_pollution_forecast(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get daily averaged air pollution forecast for given coordinates using OpenWeatherMap API
    """
    last_error = None
    
    for i, api_key in enumerate(API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(API_KEYS)} for daily forecast data...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            raw_data = response.json()
            
            # Process data to calculate daily averages
            daily_averages = calculate_daily_averages(raw_data['list'])
            
            print(f"Success with API key {i} - calculated {len(daily_averages)} daily averages")
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "daily_forecast": daily_averages,
                "raw_data_points": len(raw_data['list']),
                "source": "OpenWeatherMap API (Daily Averaged)",
                "api_key_used": i
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print(f"API key {i} unauthorized (401) - trying next key...")
                last_error = f"API key {i} unauthorized"
            elif e.response.status_code == 429:
                print(f"API key {i} rate limited (429) - trying next key...")
                last_error = f"API key {i} rate limited"
            else:
                print(f" API key {i} HTTP error {e.response.status_code} - trying next key...")
                last_error = f"API key {i} HTTP error {e.response.status_code}"
            continue
        except requests.exceptions.RequestException as e:
            print(f" API key {i} network error: {e} - trying next key...")
            last_error = f"API key {i} network error: {str(e)}"
            continue
    
    # If all API keys failed
    raise HTTPException(
        status_code=503, 
        detail=f"Unable to fetch daily air pollution forecast. All {len(API_KEYS)} API keys failed. Last error: {last_error}"
    )


def calculate_daily_averages(forecast_list):
    """
    Calculate daily averages from hourly forecast data
    """
    # Group data by date
    daily_data = defaultdict(list)
    
    for item in forecast_list:
        # Convert timestamp to date
        dt = datetime.fromtimestamp(item['dt'], tz=timezone.utc)
        date_key = dt.strftime('%Y-%m-%d')
        daily_data[date_key].append(item)
    
    # Calculate averages for each day
    daily_averages = []
    
    for date, day_items in daily_data.items():
        if not day_items:  # Skip empty days
            continue
            
        # Calculate average AQI (round to nearest integer)
        aqi_values = [item['main']['aqi'] for item in day_items]
        avg_aqi = round(statistics.mean(aqi_values))
        
        # Calculate average pollutant concentrations
        pollutants = ['co', 'no', 'no2', 'o3', 'so2', 'pm2_5', 'pm10', 'nh3']
        avg_components = {}
        
        for pollutant in pollutants:
            values = [item['components'].get(pollutant, 0) for item in day_items]
            avg_components[pollutant] = round(statistics.mean(values), 2)
        
        # Get date info
        first_item_dt = datetime.fromtimestamp(day_items[0]['dt'], tz=timezone.utc)
        
        daily_average = {
            "date": date,
            "day_name": first_item_dt.strftime('%A'),
            "data_points": len(day_items),
            "aqi": avg_aqi,
            "components": avg_components,
            "min_aqi": min(aqi_values),
            "max_aqi": max(aqi_values),
            "timestamp_start": day_items[0]['dt'],
            "timestamp_end": day_items[-1]['dt']
        }
        
        daily_averages.append(daily_average)
    
    # Sort by date
    daily_averages.sort(key=lambda x: x['date'])
    
    return daily_averages


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)