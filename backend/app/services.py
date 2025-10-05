import requests
from fastapi import HTTPException
from datetime import datetime, timezone
from collections import defaultdict
import statistics
from .config import API_KEYS

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