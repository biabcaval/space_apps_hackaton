import requests
from fastapi import HTTPException
from datetime import datetime, timezone
from collections import defaultdict
import statistics
from typing import List, Dict, Any
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd
from app.config import API_KEYS

async def fetch_pollution_data(lat: float, lon: float, endpoint: str):
    """
    Fetch pollution data from OpenWeatherMap API with fallback support
    """
    last_error = None
    
    for i, api_key in enumerate(API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution{endpoint}?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(API_KEYS)} for pollution data...")
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

async def fetch_daily_forecast_data(lat: float, lon: float):
    """
    Fetch daily averaged air pollution forecast data from OpenWeatherMap API
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

async def search_location(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for locations using OpenWeatherMap Geocoding API with fallback support
    """
    last_error = None
    
    for i, api_key in enumerate(API_KEYS, 1):
        try:
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit={limit}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(API_KEYS)} for geocoding search...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            locations = response.json()
            
            # Format the response to include all relevant information
            formatted_locations = []
            for location in locations:
                formatted_location = {
                    "name": location.get("name", ""),
                    "lat": location.get("lat"),
                    "lon": location.get("lon"),
                    "country": location.get("country", ""),
                    "state": location.get("state", ""),
                    "formatted": format_location_name(location)
                }
                formatted_locations.append(formatted_location)
            
            print(f"Success with API key {i} - found {len(formatted_locations)} locations")
            return formatted_locations
            
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
        detail=f"Unable to search locations. All {len(API_KEYS)} API keys failed. Last error: {last_error}"
    )

def format_location_name(location: Dict[str, Any]) -> str:
    """
    Format location data into a readable string
    """
    parts = []
    
    if location.get("name"):
        parts.append(location["name"])
    
    if location.get("state"):
        parts.append(location["state"])
    
    if location.get("country"):
        parts.append(location["country"])
    
    return ", ".join(parts)

async def fetch_weather_forecast(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch weather forecast data from Open-Meteo API
    """
    try:
        # Setup the Open-Meteo API client with cache and retry on error
        cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
        retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
        openmeteo = openmeteo_requests.Client(session=retry_session)

        # API parameters
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
            "timezone": "auto"
        }

        print(f"Fetching weather forecast for coordinates: {lat}, {lon}")
        responses = openmeteo.weather_api(url, params=params)
        
        # Process first location
        response = responses[0]
        
        # Process hourly data
        hourly = response.Hourly()
        hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
        hourly_precipitation = hourly.Variables(1).ValuesAsNumpy()
        hourly_wind_speed = hourly.Variables(2).ValuesAsNumpy()
        hourly_wind_direction = hourly.Variables(3).ValuesAsNumpy()
        hourly_humidity = hourly.Variables(4).ValuesAsNumpy()

        # Create date range for hourly data
        hourly_dates = pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        )

        # Process daily data
        daily = response.Daily()
        daily_temperature_max = daily.Variables(0).ValuesAsNumpy()
        daily_temperature_min = daily.Variables(1).ValuesAsNumpy()
        daily_precipitation_sum = daily.Variables(2).ValuesAsNumpy()
        daily_wind_speed_max = daily.Variables(3).ValuesAsNumpy()

        # Create date range for daily data
        daily_dates = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )

        # Format hourly data
        hourly_data = []
        for i, date in enumerate(hourly_dates):
            if i < len(hourly_temperature_2m):
                hourly_data.append({
                    "datetime": date.isoformat(),
                    "temperature": float(hourly_temperature_2m[i]) if not pd.isna(hourly_temperature_2m[i]) else None,
                    "precipitation": float(hourly_precipitation[i]) if not pd.isna(hourly_precipitation[i]) else None,
                    "wind_speed": float(hourly_wind_speed[i]) if not pd.isna(hourly_wind_speed[i]) else None,
                    "wind_direction": float(hourly_wind_direction[i]) if not pd.isna(hourly_wind_direction[i]) else None,
                    "humidity": float(hourly_humidity[i]) if not pd.isna(hourly_humidity[i]) else None
                })

        # Format daily data
        daily_data = []
        for i, date in enumerate(daily_dates):
            if i < len(daily_temperature_max):
                daily_data.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "temperature_max": float(daily_temperature_max[i]) if not pd.isna(daily_temperature_max[i]) else None,
                    "temperature_min": float(daily_temperature_min[i]) if not pd.isna(daily_temperature_min[i]) else None,
                    "precipitation_sum": float(daily_precipitation_sum[i]) if not pd.isna(daily_precipitation_sum[i]) else None,
                    "wind_speed_max": float(daily_wind_speed_max[i]) if not pd.isna(daily_wind_speed_max[i]) else None
                })

        print(f"Successfully fetched weather data - {len(hourly_data)} hourly points, {len(daily_data)} daily points")
        
        return {
            "success": True,
            "coordinates": {
                "latitude": response.Latitude(),
                "longitude": response.Longitude()
            },
            "elevation": response.Elevation(),
            "timezone": response.Timezone(),
            "utc_offset_seconds": response.UtcOffsetSeconds(),
            "hourly_forecast": hourly_data[:48],  # Limit to next 48 hours
            "daily_forecast": daily_data[:7],     # Limit to next 7 days
            "source": "Open-Meteo API"
        }
        
    except Exception as e:
        print(f"Error fetching weather forecast: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Unable to fetch weather forecast data: {str(e)}"
        )