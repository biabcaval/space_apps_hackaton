import requests
from fastapi import HTTPException
from .config import API_KEYS

async def fetch_pollution_data(lat: float, lon: float, endpoint: str):
    """
    Fetch pollution data from OpenWeatherMap API
    """
    for api_key in API_KEYS:
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution{endpoint}?lat={lat}&lon={lon}&appid={api_key}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            return {
                "success": True,
                "coordinates": {"lat": lat, "lon": lon},
                "data": response.json(),
                "source": "OpenWeatherMap API"
            }
            
        except requests.exceptions.RequestException as e:
            print(f"Error with API key {api_key}: {e}")
            continue
    
    raise HTTPException(
        status_code=503,
        detail="Unable to fetch air pollution data. All API keys failed or service unavailable."
    )