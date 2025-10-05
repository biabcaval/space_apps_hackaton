import requests
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import statistics
from typing import List, Dict, Any, Optional, Tuple
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd
import numpy as np
import os

from app.config import (
    OPENWEATHER_API_KEYS,
    NASA_EARTHDATA_USERNAME,
    NASA_EARTHDATA_PASSWORD,
    TEMPO_DATA_DIR
)

async def fetch_pollution_data(lat: float, lon: float, endpoint: str):
    """
    Fetch pollution data from OpenWeatherMap API with fallback support
    """
    last_error = None
    
    for i, api_key in enumerate(OPENWEATHER_API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution{endpoint}?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(OPENWEATHER_API_KEYS)} for pollution data...")
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
        detail=f"Unable to fetch air pollution data. All {len(OPENWEATHER_API_KEYS)} API keys failed. Last error: {last_error}"
    )

async def fetch_daily_forecast_data(lat: float, lon: float):
    """
    Fetch daily averaged air pollution forecast data from OpenWeatherMap API
    """
    last_error = None
    
    for i, api_key in enumerate(OPENWEATHER_API_KEYS, 1):
        try:
            url = f"https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(OPENWEATHER_API_KEYS)} for daily forecast data...")
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
        detail=f"Unable to fetch daily air pollution forecast. All {len(OPENWEATHER_API_KEYS)} API keys failed. Last error: {last_error}"
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
    
    for i, api_key in enumerate(OPENWEATHER_API_KEYS, 1):
        try:
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit={limit}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(OPENWEATHER_API_KEYS)} for geocoding search...")
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
        detail=f"Unable to search locations. All {len(OPENWEATHER_API_KEYS)} API keys failed. Last error: {last_error}"
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


# ============================================================================
# NASA TEMPO Satellite Data Functions
# ============================================================================

# Initialize earthaccess (lazy loading to avoid import errors if credentials not set)
_earthaccess_auth = None

def _init_earthaccess():
    """Initialize earthaccess authentication"""
    global _earthaccess_auth
    if _earthaccess_auth is None:
        try:
            import earthaccess
            if NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD:
                _earthaccess_auth = earthaccess.login(
                    strategy="environment",
                    persist=True
                )
                print("✅ NASA Earthaccess authenticated successfully")
            else:
                print("⚠️  NASA Earthdata credentials not found in environment")
                _earthaccess_auth = earthaccess.login(persist=True)  # Will use netrc or prompt
        except Exception as e:
            print(f"❌ Failed to authenticate with NASA Earthdata: {e}")
            raise HTTPException(
                status_code=503,
                detail="NASA Earthdata authentication failed. Please check credentials."
            )
    return _earthaccess_auth


def get_elevation(lat: float, lng: float) -> float:
    """Get elevation for a location using Open-Elevation API"""
    try:
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        elevation = data["results"][0]["elevation"]
        return float(elevation)
    except Exception as e:
        print(f"Warning: Could not fetch elevation, using default (100m): {e}")
        return 100.0  # Default elevation if API fails


def read_tempo_gas_l3(fn: str) -> Tuple:
    """Read TEMPO Level 3 gas data from NetCDF file"""
    try:
        import netCDF4 as nc
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="netCDF4 library not installed. Run: pip install netCDF4"
        )
    
    try:
        with nc.Dataset(fn) as ds:
            # Open the 'product' group
            prod = ds.groups["product"]
            
            # Read variable vertical_column_stratosphere from the product group
            var = prod.variables["vertical_column_stratosphere"]
            strat_gas_column = var[:]
            fv_strat_gas = var.getncattr("_FillValue")
            
            # Read variable 'vertical_column_troposphere' from the product group
            var = prod.variables["vertical_column_troposphere"]
            trop_gas_column = var[:]
            fv_trop_gas = var.getncattr("_FillValue")
            gas_unit = var.getncattr("units")
            
            # Read variable 'main_data_quality_flag' from the product group
            QF = prod.variables["main_data_quality_flag"][:]
            
            # Read latitude and longitude variables
            lat = ds.variables["latitude"][:]
            lon = ds.variables["longitude"][:]
        
        return lat, lon, strat_gas_column, fv_strat_gas, trop_gas_column, fv_trop_gas, gas_unit, QF
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reading TEMPO data file: {str(e)}"
        )


def find_gas_at_location(
    lat_target: float,
    lon_target: float,
    lat_data: np.ndarray,
    lon_data: np.ndarray,
    gas_data: np.ndarray,
    mask: np.ndarray
) -> float:
    """
    Find the gas value closest to a specific coordinate
    
    Parameters:
    lat_target: target latitude
    lon_target: target longitude
    lat_data: array of latitudes from data
    lon_data: array of longitudes from data
    gas_data: array of gas values (tropospheric column)
    mask: quality flag mask for valid data
    
    Returns:
    gas_quantity in m^2 (converted from cm^2)
    """
    # Apply mask to data
    lat_masked = lat_data[mask]
    lon_masked = lon_data[mask]
    gas_masked = gas_data[mask]
    
    if len(lat_masked) == 0:
        raise HTTPException(
            status_code=404,
            detail="No valid data points found for this location"
        )
    
    # Calculate distances (simple approximation)
    distances = np.sqrt((lat_masked - lat_target)**2 + (lon_masked - lon_target)**2)
    
    # Find closest point
    closest_idx = np.argmin(distances)
    
    # Return gas quantity in m^2 (convert from cm^2)
    gas_quantity = gas_masked[closest_idx] / 10000.0  # cm^2 to m^2
    
    return float(gas_quantity)


def get_poi_results(gas: str, date_start: str, date_end: str, POI_lat: float, POI_lon: float, version: str = "V3"):
    """
    Search for TEMPO data products
    
    Parameters:
    gas: Gas type (NO2, HCHO, O3PROF, O3TOT)
    date_start: Start datetime string
    date_end: End datetime string
    POI_lat: Point of interest latitude
    POI_lon: Point of interest longitude
    version: TEMPO product version
    """
    try:
        import earthaccess
        _init_earthaccess()
        
        POI_results = earthaccess.search_data(
            short_name=f"TEMPO_{gas}_L3",
            version=version,
            temporal=(date_start, date_end),
            point=(POI_lon, POI_lat),  # Note: earthaccess uses (lon, lat)
        )
        return POI_results
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error searching TEMPO data: {str(e)}"
        )


def find_available_data(
    gas: str,
    start_date: str,
    end_date: str,
    POI_lat: float,
    POI_lon: float,
    max_days: int = 30
) -> Tuple[Optional[str], Optional[list]]:
    """
    Search for available TEMPO data by incrementing days backwards
    
    Parameters:
    gas: Gas type (NO2, HCHO, O3PROF, O3TOT)
    start_date: Start date in format "YYYY-MM-DD"
    end_date: End date in format "YYYY-MM-DD"
    POI_lat: Point of interest latitude
    POI_lon: Point of interest longitude
    max_days: Maximum number of days to search backwards
    
    Returns:
    tuple: (date_found, POI_results) or (None, None) if not found
    """
    # Convert string to datetime
    current_date = datetime.strptime(start_date, "%Y-%m-%d")
    
    for day in range(max_days):
        # Format current date
        date_str = current_date.strftime("%Y-%m-%d")
        date_start_time = f"{date_str} 00:00:00"
        date_end_time = f"{date_str} 23:59:59"
        
        print(f"🔍 Searching TEMPO data for: {date_str}")
        
        # Search for data
        POI_results = get_poi_results(gas, date_start_time, date_end_time, POI_lat, POI_lon, version="V3")
        
        print(f"  Found {len(POI_results)} results")
        
        # If found data, return
        if len(POI_results) > 0:
            print(f"✅ TEMPO data found for {date_str}!")
            return date_str, POI_results
        
        # Decrement one day
        current_date -= timedelta(days=1)
    
    print(f"❌ No TEMPO data found in the last {max_days} days")
    return None, None


async def fetch_tempo_gas_volume(
    gas: str,
    POI_lat: float,
    POI_lon: float,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """
    Fetch TEMPO gas volume data for a specific location
    
    Parameters:
    gas: Gas type (NO2, HCHO, O3PROF, O3TOT)
    POI_lat: Point of interest latitude
    POI_lon: Point of interest longitude
    start_date: Start date in format "YYYY-MM-DD"
    end_date: End date in format "YYYY-MM-DD"
    
    Returns:
    Dictionary with gas volume and metadata
    """
    try:
        import earthaccess
        import netCDF4 as nc
        
        # Ensure data directory exists
        os.makedirs(TEMPO_DATA_DIR, exist_ok=True)
        
        # Find available data
        found_date, POI_results = find_available_data(
            gas, start_date, end_date, POI_lat, POI_lon, max_days=30
        )
        
        if not found_date or not POI_results:
            raise HTTPException(
                status_code=404,
                detail=f"No TEMPO {gas} data found for the specified date range and location"
            )
        
        print(f"📊 Processing TEMPO data for: {found_date}")
        print(f"📦 Total results: {len(POI_results)}")
        
        # Download the most recent granule
        _init_earthaccess()
        files = earthaccess.download(POI_results[-1], local_path=TEMPO_DATA_DIR)
        
        if not files or len(files) == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to download TEMPO data file"
            )
        
        # Read the downloaded file
        file_path = files[0]
        lat, lon, strat_gas_column, fv_strat_gas, trop_gas_column, fv_trop_gas, gas_unit, QF = read_tempo_gas_l3(file_path)
        
        # Get elevation for the location
        elevation = get_elevation(POI_lat, POI_lon)
        
        # Create quality mask (assuming QF == 0 is good quality)
        quality_mask = (QF == 0)
        
        # Find gas quantity at location
        gas_quantity = find_gas_at_location(
            POI_lat, POI_lon,
            lat, lon,
            trop_gas_column,
            quality_mask
        )
        
        # Calculate gas volume (quantity * elevation)
        gas_volume = gas_quantity * elevation
        
        return {
            "success": True,
            "gas_type": gas,
            "location": {
                "latitude": POI_lat,
                "longitude": POI_lon,
                "elevation_m": elevation
            },
            "data_date": found_date,
            "measurements": {
                "tropospheric_column_density_m2": gas_quantity,
                "estimated_volume_m3": gas_volume,
                "unit": gas_unit
            },
            "metadata": {
                "source": "NASA TEMPO Level 3",
                "granule_count": len(POI_results),
                "quality_points_used": int(quality_mask.sum())
            }
        }
        
    except HTTPException:
        raise
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Required library not installed: {str(e)}. Install with: pip install earthaccess netCDF4"
        )
    except Exception as e:
        print(f"❌ Error fetching TEMPO data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing TEMPO data: {str(e)}"
        )