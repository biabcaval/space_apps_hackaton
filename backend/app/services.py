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
    EARTHDATA_USERNAME,
    EARTHDATA_PASSWORD,
    TEMPO_DATA_DIR,
    get_mongodb_database
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

async def search_location(query: str, limit: int = 5, country: str = None) -> List[Dict[str, Any]]:
    """
    Search for locations using OpenWeatherMap Geocoding API with fallback support
    """
    last_error = None
    
    for i, api_key in enumerate(OPENWEATHER_API_KEYS, 1):
        try:
            # Build URL with optional country filter
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit={limit}&appid={api_key}"
            if country:
                # For US locations, append country code to query for better results
                url = f"http://api.openweathermap.org/geo/1.0/direct?q={query},{country}&limit={limit}&appid={api_key}"
            
            print(f"Trying API key {i}/{len(OPENWEATHER_API_KEYS)} for geocoding search...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            locations = response.json()
            
            # Format the response to include all relevant information
            formatted_locations = []
            for location in locations:
                # Use state abbreviations for US locations when country filter is applied
                use_abbreviations = country == "US"
                formatted_location = {
                    "name": location.get("name", ""),
                    "lat": location.get("lat"),
                    "lon": location.get("lon"),
                    "country": location.get("country", ""),
                    "state": location.get("state", ""),
                    "formatted": format_location_name(location, use_abbreviations)
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

def format_location_name(location: Dict[str, Any], use_state_abbreviations: bool = False) -> str:
    """
    Format location data into a readable string
    """
    # US State name to abbreviation mapping for better TEMPO API compatibility
    US_STATE_ABBREVIATIONS = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'District of Columbia': 'DC'
    }
    
    parts = []
    
    if location.get("name"):
        parts.append(location["name"])
    
    if location.get("state"):
        state = location["state"]
        # Use abbreviation for US locations if requested
        if use_state_abbreviations and location.get("country") == "US" and state in US_STATE_ABBREVIATIONS:
            parts.append(US_STATE_ABBREVIATIONS[state])
        else:
            parts.append(state)
    
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
            if EARTHDATA_USERNAME and EARTHDATA_PASSWORD:
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
    try:
        # Ensure arrays are properly shaped
        print(f"🔍 Array shapes - lat: {lat_data.shape}, lon: {lon_data.shape}, gas: {gas_data.shape}, mask: {mask.shape}")
        
        # Handle different array dimensions properly
        # TEMPO data typically has lat/lon as 2D grids and gas/mask as 2D or 3D
        
        # If gas_data is 3D, take the first time slice
        if len(gas_data.shape) == 3:
            gas_data = gas_data[0, :, :]  # Take first time slice
            print(f"🔄 Reduced gas data to 2D: {gas_data.shape}")
        
        # If mask is 3D, take the first time slice
        if len(mask.shape) == 3:
            mask = mask[0, :, :]  # Take first time slice
            print(f"🔄 Reduced mask to 2D: {mask.shape}")
        
        # Ensure all arrays have the same 2D shape
        if lat_data.shape != gas_data.shape:
            # If lat/lon are 1D, create 2D meshgrid
            if len(lat_data.shape) == 1 and len(lon_data.shape) == 1:
                lon_2d, lat_2d = np.meshgrid(lon_data, lat_data)
                lat_data = lat_2d
                lon_data = lon_2d
                print(f"🔄 Created 2D meshgrid: lat {lat_data.shape}, lon {lon_data.shape}")
        
        # Now flatten all arrays to 1D for processing
        lat_flat = lat_data.flatten()
        lon_flat = lon_data.flatten()
        gas_flat = gas_data.flatten()
        mask_flat = mask.flatten()
        
        print(f"🔍 Flattened shapes - lat: {lat_flat.shape}, lon: {lon_flat.shape}, gas: {gas_flat.shape}, mask: {mask_flat.shape}")
        
        # Ensure all flattened arrays have the same length
        min_length = min(len(lat_flat), len(lon_flat), len(gas_flat), len(mask_flat))
        lat_flat = lat_flat[:min_length]
        lon_flat = lon_flat[:min_length]
        gas_flat = gas_flat[:min_length]
        mask_flat = mask_flat[:min_length]
        
        print(f"🔄 Trimmed to common length: {min_length}")
        
        # Apply mask to flattened data (0 = good quality)
        valid_indices = mask_flat == 0
        
        if not np.any(valid_indices):
            # Try different quality flag values
            valid_indices = mask_flat <= 1  # Sometimes 1 is also acceptable
            if not np.any(valid_indices):
                raise HTTPException(
                    status_code=404,
                    detail="No valid data points found for this location"
                )
        
        lat_masked = lat_flat[valid_indices]
        lon_masked = lon_flat[valid_indices]
        gas_masked = gas_flat[valid_indices]
        
        # Remove fill values (typically very large negative numbers or NaN)
        valid_gas = ~np.isnan(gas_masked) & (gas_masked > -9e36) & (gas_masked != 0)
        
        if not np.any(valid_gas):
            raise HTTPException(
                status_code=404,
                detail="No valid gas measurements found for this location"
            )
        
        lat_valid = lat_masked[valid_gas]
        lon_valid = lon_masked[valid_gas]
        gas_valid = gas_masked[valid_gas]
        
        print(f"📊 Found {len(gas_valid)} valid measurements")
        
        # Calculate distances (simple approximation)
        distances = np.sqrt((lat_valid - lat_target)**2 + (lon_valid - lon_target)**2)
        
        # Find closest point
        closest_idx = np.argmin(distances)
        closest_distance = distances[closest_idx]
        
        print(f"📍 Found closest point at distance: {closest_distance:.6f} degrees")
        print(f"📊 Gas value: {gas_valid[closest_idx]}")
        
        # Return gas quantity (already in correct units from TEMPO)
        gas_quantity = float(gas_valid[closest_idx])
        
        return gas_quantity
        
    except Exception as e:
        print(f"❌ Error in find_gas_at_location: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing gas location data: {str(e)}"
        )


def get_poi_results(gas: str, date_start: str, date_end: str, POI_lat: float, POI_lon: float, version: str = "V03"):
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
    Search for available TEMPO data within the date range and backwards if needed
    
    Parameters:
    gas: Gas type (NO2, HCHO, O3PROF, O3TOT)
    start_date: Start date in format "YYYY-MM-DD"
    end_date: End date in format "YYYY-MM-DD"
    POI_lat: Point of interest latitude
    POI_lon: Point of interest longitude
    max_days: Maximum number of days to search backwards from end_date
    
    Returns:
    tuple: (date_found, POI_results) or (None, None) if not found
    """
    # Convert strings to datetime
    end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
    current_date = end_datetime
    
    print(f"🔍 Searching for TEMPO {gas} data near ({POI_lat:.4f}, {POI_lon:.4f})")
    print(f"   Searching up to {max_days} days backwards from {end_date}...")
    
    for day in range(max_days):
        # Format current date
        date_str = current_date.strftime("%Y-%m-%d")
        date_start_time = f"{date_str} 00:00:00"
        date_end_time = f"{date_str} 23:59:59"
        
        print(f"   Checking {date_str}...")
        
        # Search for data
        try:
            POI_results = get_poi_results(gas, date_start_time, date_end_time, POI_lat, POI_lon, version="V03")
            
            # If found data, return
            if len(POI_results) > 0:
                print(f"✅ Found {len(POI_results)} TEMPO data file(s) for {date_str}")
                return date_str, POI_results
        except Exception as e:
            print(f"   Error searching {date_str}: {str(e)}")
        
        # Decrement one day
        current_date -= timedelta(days=1)
    
    print(f"❌ No TEMPO data found in the last {max_days} days for this location")
    print(f"   Note: TEMPO satellite data may not be available for all US locations/dates")
    print(f"   TEMPO data is typically available 2-3 days after collection")
    return None, None


def estimate_aqi_from_gas_concentrations(no2: float = None, o3: float = None) -> Tuple[int, Dict[str, float]]:
    """
    Estimate AQI and pollutant concentrations from TEMPO gas measurements
    
    Parameters:
    no2: NO2 tropospheric column density (molecules/m²)
    o3: O3 tropospheric column density (molecules/m²)
    
    Returns:
    Tuple of (aqi, pollutants_dict)
    """
    pollutants = {}
    aqi_values = []
    
    # Convert NO2 from molecules/m² to μg/m³ (rough estimation)
    # NO2: 1e15 molecules/m² ≈ 40-80 μg/m³ (depends on atmospheric conditions)
    if no2 is not None:
        no2_ugm3 = (no2 / 1e15) * 60  # Scaling factor based on typical atmospheric conditions
        pollutants['no2'] = round(no2_ugm3, 2)
        
        # Estimate NO2 sub-index (EPA breakpoints)
        if no2_ugm3 <= 53:
            no2_aqi = 1  # Good
        elif no2_ugm3 <= 100:
            no2_aqi = 2  # Fair
        elif no2_ugm3 <= 360:
            no2_aqi = 3  # Moderate
        elif no2_ugm3 <= 649:
            no2_aqi = 4  # Poor
        else:
            no2_aqi = 5  # Very Poor
        aqi_values.append(no2_aqi)
    
    # Convert O3 from molecules/m² to μg/m³ (rough estimation)
    # O3: 1e15 molecules/m² ≈ 50-100 μg/m³
    if o3 is not None:
        o3_ugm3 = (o3 / 1e15) * 75  # Scaling factor
        pollutants['o3'] = round(o3_ugm3, 2)
        
        # Estimate O3 sub-index (EPA breakpoints for 8-hour average)
        if o3_ugm3 <= 54:
            o3_aqi = 1  # Good
        elif o3_ugm3 <= 70:
            o3_aqi = 2  # Fair
        elif o3_ugm3 <= 85:
            o3_aqi = 3  # Moderate
        elif o3_ugm3 <= 105:
            o3_aqi = 4  # Poor
        else:
            o3_aqi = 5  # Very Poor
        aqi_values.append(o3_aqi)
    
    # Overall AQI is the maximum of sub-indices
    aqi = max(aqi_values) if aqi_values else 3  # Default to moderate if no data
    
    # Add placeholder values for other pollutants
    pollutants.setdefault('pm2_5', 0)
    pollutants.setdefault('pm10', 0)
    pollutants.setdefault('co', 0)
    pollutants.setdefault('so2', 0)
    pollutants.setdefault('nh3', 0)
    
    return aqi, pollutants


async def fetch_tempo_multi_gas(
    POI_lat: float,
    POI_lon: float,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """
    Fetch multiple gas measurements from TEMPO and format as OpenWeather-compatible data
    
    Parameters:
    POI_lat: Point of interest latitude
    POI_lon: Point of interest longitude
    start_date: Start date in format "YYYY-MM-DD"
    end_date: End date in format "YYYY-MM-DD"
    
    Returns:
    Dictionary formatted like OpenWeather API response with AQI and pollutants
    """
    try:
        import earthaccess
        import netCDF4 as nc
        from datetime import datetime, timezone
        
        # Ensure data directory exists
        os.makedirs(TEMPO_DATA_DIR, exist_ok=True)
        
        gas_measurements = {}
        found_date = None
        
        # Try to fetch all available gases
        for gas in ["NO2", "HCHO", "O3PROF", "O3TOT"]:
            try:
                # Find available data
                date, POI_results = find_available_data(
                    gas, start_date, end_date, POI_lat, POI_lon, max_days=30
                )
                
                if date and POI_results:
                    if found_date is None:
                        found_date = date
                    
                    print(f"📊 Processing TEMPO {gas} data for: {date}")
                    
                    # Download the most recent granule
                    _init_earthaccess()
                    files = earthaccess.download(POI_results[-1], local_path=TEMPO_DATA_DIR)
                    
                    if files and len(files) > 0:
                        # Read the downloaded file
                        file_path = files[0]
                        lat, lon, strat_gas_column, fv_strat_gas, trop_gas_column, fv_trop_gas, gas_unit, QF = read_tempo_gas_l3(file_path)
                        
                        # Create quality mask
                        quality_mask = (QF == 0)
                        
                        # Find gas quantity at location
                        gas_quantity = find_gas_at_location(
                            POI_lat, POI_lon,
                            lat, lon,
                            trop_gas_column,
                            quality_mask
                        )
                        
                        gas_measurements[gas] = {
                            "value": gas_quantity,
                            "unit": gas_unit,
                            "scientific_notation": f"{gas_quantity:.2e}"
                        }
                        
                        print(f"✅ {gas}: {gas_quantity:.2e}")
                        
            except Exception as e:
                print(f"⚠️  Could not fetch {gas}: {str(e)}")
                continue
        
        if not gas_measurements:
            raise HTTPException(
                status_code=404,
                detail=f"No TEMPO data found for the specified date range and location. "
                       f"TEMPO satellite data is only available for US locations and has a 2-3 day processing delay."
            )
        
        # Get elevation for the location
        elevation = get_elevation(POI_lat, POI_lon)
        
        # Estimate AQI from gas concentrations
        no2_value = gas_measurements.get("NO2", {}).get("value")
        o3_value = gas_measurements.get("O3TOT", {}).get("value")
        aqi, pollutants = estimate_aqi_from_gas_concentrations(no2_value, o3_value)
        
        # Get current timestamp
        dt = datetime.now(timezone.utc)
        
        # Format response like OpenWeather API
        response = {
            "success": True,
            "source": "NASA TEMPO Satellite",
            "coordinates": {"lat": POI_lat, "lon": POI_lon},
            "data": {
                "list": [
                    {
                        "dt": int(dt.timestamp()),
                        "main": {
                            "aqi": aqi
                        },
                        "components": pollutants
                    }
                ]
            },
            "tempo_details": {
                "data_date": found_date,
                "elevation_m": elevation,
                "measurements": gas_measurements,
                "note": "AQI estimated from satellite gas measurements. Pollutant concentrations are rough conversions from tropospheric column density.",
                "metadata": {
                    "satellite": "TEMPO (Tropospheric Emissions: Monitoring of Pollution)",
                    "coverage_area": "Continental United States",
                    "temporal_resolution": "Hourly during daylight",
                    "spatial_resolution": "~2.1 km x 4.4 km"
                }
            }
        }
        
        print(f"✅ TEMPO multi-gas fetch complete - Estimated AQI: {aqi}")
        
        return response
        
    except HTTPException:
        raise
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Required library not installed: {str(e)}. Install with: pip install earthaccess netCDF4"
        )
    except Exception as e:
        print(f"❌ Error fetching TEMPO multi-gas data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing TEMPO data: {str(e)}"
        )


async def fetch_tempo_gas_volume(
    gas: str,
    POI_lat: float,
    POI_lon: float,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """
    Fetch TEMPO gas volume data for a specific location (single gas)
    
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
                detail=f"No TEMPO {gas} data found for the specified date range and location. "
                       f"TEMPO satellite data is only available for US locations and has a 2-3 day processing delay. "
                       f"Try selecting a location in the continental United States."
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
        
        # Format the response with better descriptions
        gas_descriptions = {
            "NO2": "Nitrogen Dioxide - primarily from vehicle exhaust and industrial emissions",
            "HCHO": "Formaldehyde - from industrial processes and vehicle emissions", 
            "O3PROF": "Ozone Profile - ground-level ozone concentration",
            "O3TOT": "Total Ozone - total atmospheric ozone column"
        }
        
        # Determine concentration level
        concentration_level = "Unknown"
        health_impact = "Data available for analysis"
        
        if gas == "NO2":
            if gas_quantity < 1e15:
                concentration_level = "Low"
                health_impact = "Minimal health impact expected"
            elif gas_quantity < 5e15:
                concentration_level = "Moderate" 
                health_impact = "Sensitive individuals may experience minor effects"
            else:
                concentration_level = "High"
                health_impact = "Increased risk of respiratory irritation"
        
        return {
            "success": True,
            "gas_type": gas,
            "gas_description": gas_descriptions.get(gas, f"{gas} - atmospheric gas measurement"),
            "location": {
                "latitude": POI_lat,
                "longitude": POI_lon,
                "elevation_m": elevation,
                "coordinates_formatted": f"{POI_lat:.4f}°N, {abs(POI_lon):.4f}°W"
            },
            "data_date": found_date,
            "measurements": {
                "tropospheric_column_density": {
                    "value": gas_quantity,
                    "unit": "molecules/m²",
                    "scientific_notation": f"{gas_quantity:.2e}",
                    "concentration_level": concentration_level
                },
                "estimated_volume": {
                    "value": gas_volume,
                    "unit": "molecules",
                    "scientific_notation": f"{gas_volume:.2e}"
                },
                "original_unit": gas_unit
            },
            "analysis": {
                "concentration_level": concentration_level,
                "health_impact": health_impact,
                "data_quality": "Good" if quality_mask.sum() > 100 else "Limited"
            },
            "metadata": {
                "source": "NASA TEMPO Level 3 Satellite Data",
                "satellite": "TEMPO (Tropospheric Emissions: Monitoring of Pollution)",
                "granule_count": len(POI_results),
                "quality_points_used": int(quality_mask.sum()),
                "processing_date": found_date,
                "coverage_area": "Continental United States",
                "temporal_resolution": "Hourly during daylight",
                "spatial_resolution": "~2.1 km x 4.4 km"
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


# ============================================================================
# Daymet API Functions
# ============================================================================

async def fetch_daymet_data(
    lat: float,
    lon: float,
    variables: str = "tmax,tmin,prcp,srad,vp,swe,dayl",
    years: str = None,
    start_date: str = None,
    end_date: str = None
) -> Dict[str, Any]:
    """
    Fetch daily weather/climate data from Daymet API
    
    Parameters:
    lat: Latitude (14.5°N to 52.0°N)
    lon: Longitude (-131.0°W to -53.0°W)
    variables: Comma-separated list of variables (tmax,tmin,prcp,srad,vp,swe,dayl)
    years: Comma-separated list of years (1980 to latest)
    start_date: Start date in YYYY-MM-DD format
    end_date: End date in YYYY-MM-DD format
    
    Returns:
    Dictionary with processed Daymet data
    """
    try:
        # Validate coordinates for North America coverage
        if not (14.5 <= lat <= 52.0):
            raise HTTPException(
                status_code=400,
                detail=f"Latitude {lat} is outside Daymet coverage area (14.5°N to 52.0°N)"
            )
        
        if not (-131.0 <= lon <= -53.0):
            raise HTTPException(
                status_code=400,
                detail=f"Longitude {lon} is outside Daymet coverage area (-131.0°W to -53.0°W)"
            )
        
        # Build API URL
        base_url = "https://daymet.ornl.gov/single-pixel/api/data"
        params = {
            "lat": lat,
            "lon": lon,
            "vars": variables
        }
        
        # Add time parameters
        if years:
            params["years"] = years
        elif start_date and end_date:
            params["start"] = start_date
            params["end"] = end_date
        else:
            # Default to current year
            current_year = datetime.now().year
            params["years"] = str(current_year - 1)  # Use previous year for complete data
        
        print(f"🌡️ Fetching Daymet data for coordinates: {lat}, {lon}")
        print(f"📊 Variables: {variables}")
        print(f"📅 Parameters: {params}")
        
        # Make request to Daymet API
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        
        # Parse CSV response
        csv_data = response.text
        lines = csv_data.strip().split('\n')
        
        if len(lines) < 8:
            raise HTTPException(
                status_code=404,
                detail="No data returned from Daymet API"
            )
        
        # Extract metadata (first 6 lines)
        metadata = {}
        for i, line in enumerate(lines[:6]):
            if ':' in line:
                key, value = line.split(':', 1)
                metadata[key.strip()] = value.strip()
        
        # Find the header line (contains column names with units)
        header_line_idx = 6  # Usually line 7 (index 6)
        header = lines[header_line_idx].split(',')
        
        # Parse data rows
        data_rows = []
        for line in lines[header_line_idx + 1:]:
            if line.strip():
                values = line.split(',')
                row_data = {}
                for i, value in enumerate(values):
                    if i < len(header):
                        try:
                            # Try to convert to float for numeric values
                            if value.replace('.', '').replace('-', '').replace('+', '').isdigit():
                                row_data[header[i]] = float(value)
                            else:
                                row_data[header[i]] = value
                        except (ValueError, AttributeError):
                            row_data[header[i]] = value
                data_rows.append(row_data)
        
        # Calculate summary statistics
        summary_stats = {}
        numeric_columns = ['tmax (deg c)', 'tmin (deg c)', 'prcp (mm/day)', 'srad (W/m^2)', 'vp (Pa)', 'swe (kg/m^2)', 'dayl (s)']
        
        for col in numeric_columns:
            if col in header:
                values = [row[col] for row in data_rows if isinstance(row.get(col), (int, float))]
                if values:
                    summary_stats[col] = {
                        "mean": round(sum(values) / len(values), 2),
                        "min": min(values),
                        "max": max(values),
                        "count": len(values)
                    }
        
        print(f"✅ Successfully fetched {len(data_rows)} days of Daymet data")
        
        return {
            "success": True,
            "source": "Daymet ORNL",
            "location": {
                "latitude": lat,
                "longitude": lon
            },
            "metadata": metadata,
            "parameters": params,
            "data_count": len(data_rows),
            "summary_statistics": summary_stats,
            "daily_data": data_rows[:100],  # Limit to first 100 days for response size
            "raw_csv_sample": lines[:7]  # Include metadata and header
        }
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Daymet API request failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch data from Daymet API: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error processing Daymet data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing Daymet data: {str(e)}"
        )


async def fetch_daymet_climate_summary(
    lat: float,
    lon: float,
    start_year: int = None,
    end_year: int = None
) -> Dict[str, Any]:
    """
    Fetch multi-year climate summary from Daymet API
    
    Parameters:
    lat: Latitude
    lon: Longitude  
    start_year: Start year (default: 10 years ago)
    end_year: End year (default: last year)
    
    Returns:
    Dictionary with climate summary statistics
    """
    try:
        # Default to 10-year climate summary
        current_year = datetime.now().year
        if not start_year:
            start_year = current_year - 11
        if not end_year:
            end_year = current_year - 1
            
        # Generate years string
        years = ",".join(str(year) for year in range(start_year, end_year + 1))
        
        # Fetch temperature and precipitation data
        variables = "tmax,tmin,prcp"
        
        return await fetch_daymet_data(
            lat=lat,
            lon=lon,
            variables=variables,
            years=years
        )
        
    except Exception as e:
        print(f"❌ Error fetching Daymet climate summary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching climate summary: {str(e)}"
        )


# ============================================================================
# LLM Advice Generation Functions
# ============================================================================

def build_air_state_description(aqi: int, aqi_level: str, pollutants: Optional[Dict[str, float]]) -> str:
    """
    Build detailed description of current air quality state with health impact context
    """
    description = f"═══ AIR QUALITY INDEX (AQI): {aqi} - {aqi_level} ═══\n"
    
    # AQI impact description with health context
    aqi_impacts = {
        1: "GOOD (1): Air is clean. Safe for all outdoor activities. No health precautions needed.",
        2: "FAIR (2): Air quality acceptable. Unusually sensitive individuals may experience minor symptoms. Most people unaffected.",
        3: "MODERATE (3): Sensitive groups (elderly, children, respiratory/cardiac patients) will experience effects. Healthy adults typically unaffected.",
        4: "POOR (4): UNHEALTHY - Everyone begins experiencing effects. Sensitive groups face serious health impacts. Limit prolonged outdoor exposure.",
        5: "VERY POOR (5): HAZARDOUS - Health emergency. Entire population affected. Avoid all outdoor activities."
    }
    description += f"{aqi_impacts.get(aqi, 'Air quality status uncertain.')}\n"
    
    # Detailed pollutant information with specific health impacts
    if pollutants:
        description += "\n═══ DETAILED POLLUTANT ANALYSIS ═══\n"
        
        if pollutants.get('pm2_5'):
            pm25 = pollutants['pm2_5']
            description += f"\n🔴 PM2.5: {pm25:.1f} μg/m³\n"
            description += "   - Microscopic particles that bypass nose/throat and lodge deep in lungs and bloodstream\n"
            description += "   - Major concern for: Respiratory patients (triggers asthma attacks), cardiovascular patients (increases blood pressure & heart rate)\n"
            if pm25 <= 12:
                description += "   - STATUS: SAFE - Below WHO guideline\n"
            elif pm25 <= 35:
                description += "   - STATUS: MODERATE - Sensitive groups should reduce prolonged outdoor exertion\n"
            elif pm25 <= 55:
                description += "   - STATUS: UNHEALTHY FOR SENSITIVE GROUPS - Elderly, children, respiratory/cardiac patients: stay indoors\n"
            else:
                description += "   - STATUS: UNHEALTHY FOR ALL - Everyone should minimize outdoor exposure\n"
        
        if pollutants.get('pm10'):
            pm10 = pollutants['pm10']
            description += f"\n🟠 PM10: {pm10:.1f} μg/m³\n"
            description += "   - Larger inhalable particles that irritate eyes, nose, throat, and airways\n"
            description += "   - Major concern for: Respiratory patients (causes coughing, wheezing), outdoor workers\n"
            if pm10 <= 50:
                description += "   - STATUS: ACCEPTABLE\n"
            else:
                description += "   - STATUS: ELEVATED - Increased respiratory irritation, especially with exertion\n"
        
        if pollutants.get('no2'):
            no2 = pollutants['no2']
            description += f"\n🟡 NO2: {no2:.1f} μg/m³\n"
            description += "   - Nitrogen dioxide from vehicle exhaust and industrial emissions\n"
            description += "   - Major concern for: Asthma sufferers (inflames airways), children (impairs lung development)\n"
            if no2 <= 40:
                description += "   - STATUS: LOW RISK\n"
            elif no2 <= 100:
                description += "   - STATUS: MODERATE - Sensitive individuals may notice airway irritation\n"
            else:
                description += "   - STATUS: HIGH - Significant airway inflammation risk, especially near traffic\n"
        
        if pollutants.get('o3'):
            o3 = pollutants['o3']
            description += f"\n🔵 O3: {o3:.1f} μg/m³\n"
            description += "   - Ground-level ozone (smog) - peaks in afternoon heat, worse on sunny days\n"
            description += "   - Major concern for: Athletes (reduces lung function), respiratory patients (triggers attacks), outdoor workers\n"
            if o3 <= 100:
                description += "   - STATUS: ACCEPTABLE\n"
            elif o3 <= 160:
                description += "   - STATUS: MODERATE - Reduces lung function by 5-10% during exercise\n"
            else:
                description += "   - STATUS: UNHEALTHY - Can cause chest pain, coughing, throat irritation even at rest\n"
    else:
        description += "\n(Specific pollutant data not available - using AQI only)\n"
    
    return description


def get_group_specific_questions(risk_group: str, aqi_level: str) -> str:
    """
    Get specific questions/concerns to address for each risk group
    """
    questions_map = {
        "General Population": f"""
1. What outdoor activities are safe today with {aqi_level} air quality?
2. Should I adjust my exercise routine or workout schedule?
3. Do I need to keep windows closed or can I air out my home?
4. What symptoms should I watch for that mean I should go indoors?
""",
        
        "Elderly (65+)": f"""
1. Is it safe for me to take my usual daily walk with {aqi_level} air?
2. Should I adjust my medication schedule or dosages today?
3. What specific symptoms should prompt me to call my doctor?
4. If I have both heart and lung issues, what's most important to avoid?
5. Can I do light gardening or should I stay inside?
""",
        
        "Children": f"""
1. Should my children play outside at recess or during sports practice today?
2. What symptoms in my child mean they should stop playing immediately?
3. Are indoor vs outdoor sports equally risky in {aqi_level} air?
4. If my child has mild asthma, should I keep them home from school?
5. How do I explain to my kids why they can't play outside today?
""",
        
        "People with Respiratory Conditions": f"""
1. Should I use my rescue inhaler preventively before going outside?
2. Do I need to adjust my controller medication dosage for {aqi_level} air?
3. What early warning signs mean my condition is being affected?
4. Is it safe to do breathing exercises or should I avoid them?
5. Should I cancel my doctor appointment if it means going outside?
6. When should I go to the emergency room vs. just use my inhaler?
""",
        
        "People with Cardiovascular Conditions": f"""
1. Will this air quality trigger a heart attack or stroke in vulnerable people?
2. Should I check my blood pressure more frequently today?
3. What chest symptoms require immediate emergency care vs. monitoring?
4. Can I take my usual walk or is any exertion dangerous in {aqi_level} air?
5. Should I adjust my blood pressure or heart medications today?
""",
        
        "Pregnant Women": f"""
1. How does {aqi_level} air quality affect my developing baby?
2. Is it safe to continue my prenatal exercise routine today?
3. Should I avoid certain activities or areas (like traffic) more than usual?
4. What symptoms might indicate the air is affecting me or my baby?
5. Are there any supplements or precautions specific to pregnancy I should take?
6. Can I still take walks or should I stay completely indoors?
""",
        
        "Outdoor Workers": f"""
1. Should I request to work indoors today or is outdoor work manageable?
2. What protective equipment (masks, etc.) should I demand from my employer?
3. How often should I take breaks in clean air during my shift?
4. What are my rights if I feel the air is too dangerous to work in?
5. Should I modify my work pace or technique to breathe less heavily?
6. What symptoms mean I should stop working immediately?
""",
        
        "Athletes": f"""
1. Should I cancel my training session or race scheduled for today?
2. Can I train indoors instead, or should I take a complete rest day?
3. How much should I reduce my training intensity in {aqi_level} air?
4. Will training in this air cause permanent lung damage?
5. What performance impacts should I expect if I train anyway?
6. Are certain types of training (intervals vs. steady) safer than others?
"""
    }
    
    return questions_map.get(risk_group, questions_map["General Population"])


def get_risk_group_context(risk_group: str) -> str:
    """
    Get specific health context and vulnerabilities for each risk group
    """
    contexts = {
        "General Population": """
- Healthy adults with no pre-existing conditions
- Baseline respiratory and cardiovascular function
- Can tolerate moderate air pollution with minimal effects
- Should still avoid prolonged exposure during poor air quality
        """,
        
        "Elderly (65+)": """
- Reduced lung capacity and weakened immune systems
- Higher risk of cardiovascular complications from air pollution
- May have multiple chronic conditions (diabetes, hypertension)
- Slower recovery from respiratory irritation
- PM2.5 and ozone particularly dangerous - can trigger heart attacks or strokes
- Need more time indoors during poor air quality
        """,
        
        "Children": """
- Developing lungs and respiratory systems still growing
- Breathe more rapidly, inhaling more pollutants per body weight
- Spend more time outdoors playing and being active
- Higher risk of developing asthma from repeated exposure
- More vulnerable to PM2.5, ozone, and NO2
- Need parental supervision to limit exposure during poor air quality
        """,
        
        "People with Respiratory Conditions": """
- Asthma, COPD, chronic bronchitis, or emphysema
- Airways already inflamed and hypersensitive
- Pollution triggers bronchoconstriction and attacks
- Emergency inhaler must be always accessible
- PM2.5, ozone, and NO2 are major triggers
- May need to adjust medication during poor air quality days
- Should have action plan for worsening symptoms
        """,
        
        "People with Cardiovascular Conditions": """
- Heart disease, arrhythmias, history of heart attack or stroke
- Air pollution increases blood pressure and heart rate
- PM2.5 can trigger irregular heartbeats and heart attacks
- Reduced exercise tolerance during pollution episodes
- May need to avoid any physical exertion outdoors
- Should monitor blood pressure more frequently
- Chest pain or shortness of breath requires immediate medical attention
        """,
        
        "Pregnant Women": """
- Protecting both maternal and fetal health
- Pollution can affect fetal development and birth weight
- Increased blood volume makes heart work harder
- CO exposure particularly dangerous - reduces oxygen to baby
- PM2.5 linked to preterm birth and complications
- Should prioritize indoor activities with good air quality
- Need to balance exercise needs with air quality safety
        """,
        
        "Outdoor Workers": """
- Extended exposure times (8+ hours daily)
- Physical exertion increases inhalation of pollutants
- May not have option to work indoors
- Construction, landscaping, delivery workers at highest risk
- Need employer support for protective equipment
- Should take frequent breaks in clean air spaces
- May need schedule adjustments during severe pollution episodes
        """,
        
        "Athletes": """
- High breathing rates during training (10-20x normal)
- Inhale much larger volumes of polluted air
- Ozone causes airway inflammation reducing performance
- Indoor training options should be utilized
- Morning workouts better (before ozone peaks)
- Performance suffers even in moderate air quality
- Need to balance training goals with long-term lung health
        """
    }
    
    # Return specific context or general one
    return contexts.get(risk_group, contexts["General Population"])


def post_process_llm_advice(advice: str, risk_group: str) -> str:
    """
    Post-process LLM-generated advice to make it more user-friendly and natural.
    Removes repetitive patterns, excessive quotes, and AI-like formatting.
    """
    import re
    
    # Remove repetitive risk group name from the start of bullet points
    # e.g., "- People with Respiratory Conditions: Use your inhaler" -> "- Use your inhaler"
    patterns_to_remove = [
        rf'^[-•]\s*{re.escape(risk_group)}:\s*',
        rf'^[-•]\s*{re.escape(risk_group)}\s*[-:]\s*',
        rf'^\d+\.\s*{re.escape(risk_group)}:\s*',
        rf'^\d+\.\s*{re.escape(risk_group)}\s*[-:]\s*',
    ]
    
    lines = advice.split('\n')
    cleaned_lines = []
    
    for line in lines:
        cleaned_line = line
        
        # Remove risk group prefix from bullets
        for pattern in patterns_to_remove:
            cleaned_line = re.sub(pattern, '• ', cleaned_line, flags=re.IGNORECASE)
        
        # Remove excessive quotes around sentences
        cleaned_line = re.sub(r'^[-•]\s*"(.+)"$', r'• \1', cleaned_line)
        cleaned_line = re.sub(r'^\d+\.\s*"(.+)"$', r'• \1', cleaned_line)
        
        # Normalize bullet points (use • consistently)
        cleaned_line = re.sub(r'^[-*]\s+', '• ', cleaned_line)
        cleaned_line = re.sub(r'^\d+\.\s+', '• ', cleaned_line)
        
        # Remove empty bullet points
        if cleaned_line.strip() in ['•', '-', '*', '']:
            continue
            
        cleaned_lines.append(cleaned_line)
    
    # Join lines and clean up multiple blank lines
    result = '\n'.join(cleaned_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    # Remove AI-like meta phrases at the start of sentences
    ai_phrases = [
        r'^As an? AI,?\s*',
        r'^I apologize,?\s*',
        r'^Here (are|is) (some|the)\s+',
        r'^Based on (the|this) (information|data),?\s*',
        r'^Remember:?\s*',
        r'^Please note:?\s*',
        r'^Note:?\s*',
    ]
    
    for phrase in ai_phrases:
        result = re.sub(phrase, '', result, flags=re.IGNORECASE | re.MULTILINE)
    
    # Clean up spacing
    result = re.sub(r'  +', ' ', result)  # Multiple spaces to single
    result = re.sub(r'•\s+', '• ', result)  # Normalize bullet spacing
    result = '\n'.join(line.strip() for line in result.split('\n') if line.strip())  # Remove empty lines
    
    return result.strip()


async def generate_health_advice(
    aqi: int,
    risk_group: str,
    pollutants: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Generate personalized health advice for a specific risk group based on air quality
    
    Parameters:
    aqi: Air Quality Index (1-5)
    risk_group: Name of the risk group (e.g., "General Population", "Elderly", etc.)
    pollutants: Dictionary of pollutant concentrations (optional)
    
    Returns:
    Dictionary with generated advice
    """
    try:
        from openai import OpenAI
        import os
        
        # Get OpenAI API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # Return fallback advice if no API key
            return {
                "success": True,
                "risk_group": risk_group,
                "advice": get_fallback_advice(aqi, risk_group),
                "source": "Fallback (No API Key)"
            }
        
        client = OpenAI(api_key=api_key)
        
        # Map AQI to quality level
        aqi_levels = {
            1: "Good",
            2: "Fair",
            3: "Moderate",
            4: "Poor",
            5: "Very Poor"
        }
        aqi_level = aqi_levels.get(aqi, "Unknown")
        
        # Build pollutants summary if provided
        pollutants_text = ""
        if pollutants:
            pollutants_text = "\n\nCurrent pollutant levels:"
            if pollutants.get('pm2_5'):
                pollutants_text += f"\n- PM2.5: {pollutants['pm2_5']} μg/m³"
            if pollutants.get('pm10'):
                pollutants_text += f"\n- PM10: {pollutants['pm10']} μg/m³"
            if pollutants.get('no2'):
                pollutants_text += f"\n- NO2: {pollutants['no2']} μg/m³"
            if pollutants.get('o3'):
                pollutants_text += f"\n- O3: {pollutants['o3']} μg/m³"
        
        # Create risk-group-specific prompt context
        group_context = get_risk_group_context(risk_group)
        group_specific_questions = get_group_specific_questions(risk_group, aqi_level)
        
        # Build detailed air quality state description
        air_state_description = build_air_state_description(aqi, aqi_level, pollutants)
        
        # Create prompt for the LLM with STRONG emphasis on uniqueness
        prompt = f"""You are generating health advice for {risk_group} ONLY. This advice MUST be completely different from advice for other groups.

═══════════════════════════════════════════════════
CURRENT AIR QUALITY DATA:
═══════════════════════════════════════════════════
{air_state_description}

═══════════════════════════════════════════════════
SPECIFIC VULNERABILITIES OF {risk_group}:
═══════════════════════════════════════════════════
{group_context}

═══════════════════════════════════════════════════
KEY QUESTIONS THIS GROUP IS ASKING YOU:
═══════════════════════════════════════════════════
{group_specific_questions}

═══════════════════════════════════════════════════
YOUR TASK - GENERATE UNIQUE ADVICE FOR THIS GROUP:
═══════════════════════════════════════════════════

Write 4-6 HIGHLY SPECIFIC recommendations that ONLY make sense for {risk_group}.

Each bullet point MUST:
1. Reference SPECIFIC health equipment, medications, or activities unique to this group
2. Address the EXACT pollutants that affect this group most (from the data above)
3. Include ACTIONABLE steps with numbers, times, or measurements
4. Use language and terminology specific to this group's lifestyle

MANDATORY GROUP-SPECIFIC ELEMENTS TO INCLUDE:
- For Elderly: Mention specific medications (blood pressure pills, heart meds), risk of falls, confusion, emergency contacts, blood pressure monitoring
- For Children: Mention school activities, recess, sports practice, parents watching for symptoms, growth concerns, keeping them engaged indoors
- For Respiratory: Mention rescue inhalers, nebulizers, peak flow meters, action plans, specific breathing symptoms (wheezing, shortness of breath)
- For Cardiovascular: Mention chest pain, palpitations, blood pressure checks, exertion limits, stress management, emergency warning signs
- For Pregnant: Mention fetal movement monitoring, prenatal vitamins, reduced oxygen to baby, prenatal exercises, avoiding certain positions
- For Outdoor Workers: Mention N95 masks, employer OSHA requirements, work breaks, hydration, workers compensation, pay protection
- For Athletes: Mention training zones, heart rate monitoring, workout modifications, performance impacts, recovery time

❌ NEVER USE THESE GENERIC PHRASES:
- "Stay indoors"
- "Limit outdoor activities"  
- "Monitor your health"
- "Consult your doctor"
- "Reduce exposure"
- "Be careful"

✅ INSTEAD USE GROUP-SPECIFIC INSTRUCTIONS LIKE:
- Elderly: "Take your blood pressure medication 30 minutes before going outside, and keep your emergency contact list in your pocket"
- Children: "Parents should watch for coughing during sleep tonight - PM2.5 at {pollutants.get('pm2_5', 'N/A')} μg/m³ can irritate developing lungs"
- Respiratory: "Use your rescue inhaler prophylactically BEFORE symptoms start - with O3 at {pollutants.get('o3', 'N/A')} μg/m³, waiting is dangerous"
- Cardiovascular: "Check your pulse before and after any stairs or walking - PM2.5 at {pollutants.get('pm2_5', 'N/A')} μg/m³ increases heart strain by 15-20%"

CRITICAL: Each sentence should make it OBVIOUS which group this is for. Someone reading this should immediately know "{risk_group}" without being told."""

        print(f"🤖 Generating LLM advice for {risk_group} with AQI {aqi}...")
        
        # Create group-specific system message with examples
        system_message = f"""You are a specialist medical advisor who EXCLUSIVELY works with {risk_group}.

CONTEXT: You are being asked to generate advice specifically for {risk_group}. Other specialists are generating DIFFERENT advice for OTHER groups. Your advice MUST be UNIQUE to {risk_group}.

YOUR SPECIALIZATION:
- You understand how air pollution uniquely affects {risk_group} in ways different from other groups
- You know their specific medications, equipment, daily routines, and vulnerabilities
- You provide recommendations that would be irrelevant, inappropriate, or even harmful for other groups

EXAMPLES OF GROUP-SPECIFIC ADVICE:
- Elderly (65+): "Check your blood pressure 2-3 times today since PM2.5 can spike it. Keep your nitroglycerin tablets handy if you have heart issues."
- Children: "Parents: Watch your kids for coughing fits tonight. Keep them engaged with indoor games - try board games or video calls with friends."
- Respiratory Patients: "Test your peak flow meter now (before symptoms). If below 80% of your personal best, use your rescue inhaler immediately."
- Cardiovascular Patients: "Monitor for chest tightness or unusual fatigue. Take your stairs breaks - go one floor, rest 5 minutes, continue."
- Pregnant Women: "Count fetal movements - you should feel 10 kicks in 2 hours. If fewer, call your OB immediately as reduced oxygen affects the baby."
- Outdoor Workers: "You have OSHA rights to N95 masks and 15-min breaks every 2 hours. Your employer must provide these during AQI > 100."

YOUR WRITING MUST:
1. Reference SPECIFIC tools/medications this group uses (inhalers, blood pressure cuffs, heart rate monitors, etc.)
2. Cite the EXACT pollutant levels from the data and explain why they matter to THIS group
3. Give PRECISE instructions with numbers (how many times, how long, what threshold)
4. Use terminology and language unique to this group's daily life

THE TEST: If I removed the group name from your advice, a reader should STILL be able to identify which group it's for based on the content alone."""
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,  # Increased for more detailed, group-specific responses
            temperature=0.9,  # Higher temperature for maximum variation between groups
            presence_penalty=0.6,  # Encourage diverse content
            frequency_penalty=0.3  # Reduce repetition across different group responses
        )
        
        advice_text = response.choices[0].message.content.strip()
        
        # Post-process to make it more user-friendly and less AI-like
        advice_text = post_process_llm_advice(advice_text, risk_group)
        
        print(f"✅ Successfully generated advice for {risk_group}")
        
        return {
            "success": True,
            "risk_group": risk_group,
            "aqi": aqi,
            "aqi_level": aqi_level,
            "advice": advice_text,
            "source": "OpenAI GPT-3.5"
        }
        
    except ImportError:
        print("⚠️  OpenAI library not installed")
        return {
            "success": True,
            "risk_group": risk_group,
            "advice": get_fallback_advice(aqi, risk_group),
            "source": "Fallback (Library Not Installed)"
        }
    except Exception as e:
        print(f"❌ Error generating LLM advice: {str(e)}")
        # Return fallback advice on error
        return {
            "success": True,
            "risk_group": risk_group,
            "advice": get_fallback_advice(aqi, risk_group),
            "source": f"Fallback (Error: {str(e)[:50]})"
        }


def get_fallback_advice(aqi: int, risk_group: str) -> str:
    """
    Provide fallback advice when LLM is not available
    Tailored to specific risk groups
    """
    
    # Get base advice for AQI level
    base_advice = {
        1: "Air quality is excellent today",
        2: "Air quality is acceptable",
        3: "Air quality is moderate - sensitive groups should take precautions",
        4: "Air quality is poor - health effects possible for everyone",
        5: "Air quality is very poor - health alert conditions"
    }
    
    # Group-specific advice by AQI level
    group_advice = {
        "General Population": {
            1: "• Perfect day for all outdoor activities!\n• No restrictions needed\n• Enjoy time outside",
            2: "• Safe for outdoor activities\n• If unusually sensitive, monitor how you feel\n• Generally no concerns",
            3: "• Continue normal activities with awareness\n• Reduce prolonged intense outdoor exercise\n• Watch for any unusual symptoms",
            4: "• Limit prolonged outdoor exertion\n• Choose less strenuous activities\n• Keep windows closed\n• Consider N95 mask for extended time outside",
            5: "• Avoid outdoor activities\n• Stay indoors\n• Use air purifiers if available\n• Wear N95 mask if you must go outside"
        },
        "Elderly (65+)": {
            1: "• Great day for walks and gentle outdoor activities!\n• Ensure medications are up to date",
            2: "• Safe for usual activities\n• Keep rescue medications accessible\n• Stay hydrated",
            3: "• Limit time outdoors, especially during afternoon\n• Avoid heavy traffic areas\n• Monitor for shortness of breath or fatigue",
            4: "• Stay indoors as much as possible\n• Wear N95 mask if you must go out\n• Avoid any strenuous activity\n• Contact doctor if breathing difficulties arise",
            5: "• Do not go outside\n• Keep all medications readily available\n• Use air purifiers\n• Seek immediate medical help if experiencing chest pain or severe shortness of breath"
        },
        "Children": {
            1: "• Perfect for outdoor play and sports!\n• Run, play, and have fun outside\n• Stay hydrated",
            2: "• Safe for all activities\n• Parents: watch for coughing during intense play\n• Take water breaks",
            3: "• Reduce prolonged outdoor play time\n• Consider indoor activities during afternoon\n• Parents: monitor for coughing or wheezing",
            4: "• Move activities indoors\n• Avoid outdoor sports and recess if possible\n• Watch for breathing difficulties\n• Keep windows closed at school and home",
            5: "• No outdoor activities\n• Stay indoors with windows closed\n• Avoid physical exertion even indoors\n• Parents: seek medical care if child has difficulty breathing"
        },
        "People with Respiratory Conditions": {
            1: "• Enjoy outdoor activities with normal precautions\n• Medications should be accessible but not likely needed",
            2: "• Generally safe, but keep rescue inhaler nearby\n• Limit intense exercise to morning hours\n• Watch for early warning signs",
            3: "• Reduce outdoor time significantly\n• Keep rescue inhaler always accessible\n• Avoid areas with heavy traffic\n• May need to increase controller medication - consult doctor",
            4: "• Stay indoors\n• Follow your asthma action plan\n• Use rescue inhaler as prescribed\n• Wear N95 mask if you must go outside\n• Contact doctor if symptoms worsen",
            5: "• Emergency precautions - do not go outside\n• Follow emergency asthma action plan\n• Keep rescue medications at hand\n• Go to ER if using rescue inhaler more than every 4 hours"
        },
        "People with Cardiovascular Conditions": {
            1: "• Safe for light to moderate exercise\n• Enjoy outdoor activities\n• Continue medications as prescribed",
            2: "• Generally safe\n• Avoid intense exertion\n• Monitor heart rate and blood pressure",
            3: "• Limit outdoor activities\n• No strenuous exercise outdoors\n• Monitor blood pressure more frequently\n• Watch for chest discomfort or irregular heartbeat",
            4: "• Stay indoors and rest\n• Avoid all physical exertion\n• Take medications as prescribed\n• Call doctor if experiencing chest pain, shortness of breath, or palpitations",
            5: "• Do not go outside\n• Complete rest indoors\n• Keep medications accessible\n• Seek immediate medical attention for any chest pain, severe shortness of breath, or dizziness"
        },
        "Pregnant Women": {
            1: "• Safe for normal pregnancy activities and exercise\n• Enjoy time outdoors\n• Stay hydrated",
            2: "• Continue usual activities\n• Limit intense exercise to morning\n• Stay in well-ventilated areas",
            3: "• Reduce outdoor time\n• Avoid traffic congestion areas (CO exposure)\n• Move exercise indoors\n• Ensure good indoor air quality",
            4: "• Minimize outdoor exposure\n• Stay indoors with good air quality\n• No outdoor exercise\n• Wear N95 mask if you must go outside",
            5: "• Do not go outside\n• Stay indoors with air purifier if possible\n• Complete rest\n• Contact doctor if experiencing any discomfort or reduced fetal movement"
        },
        "Outdoor Workers": {
            1: "• Work safely with normal precautions\n• Stay hydrated\n• Take regular breaks",
            2: "• Continue work with awareness\n• Take breaks in shaded areas\n• Monitor how you feel",
            3: "• Request reduced work hours if possible\n• Take frequent breaks indoors\n• Wear N95 mask during heavy exertion\n• Stay very hydrated",
            4: "• Wear N95 mask throughout shift\n• Request indoor duties if possible\n• Take frequent breaks in clean air\n• Employer should provide protective equipment",
            5: "• Request day off or indoor assignment\n• If must work: wear N95 mask, take breaks every 30 min\n• Employer required to provide protection\n• Know your right to refuse unsafe work"
        },
        "Athletes": {
            1: "• Perfect conditions for training!\n• No restrictions on outdoor workouts\n• Perform at your best",
            2: "• Train normally but consider morning hours\n• Monitor performance for any decline\n• Stay hydrated",
            3: "• Reduce training intensity by 20-30%\n• Move workouts indoors if possible\n• Avoid afternoon training (peak ozone)\n• Performance will be impacted",
            4: "• Move all training indoors\n• Or reduce outdoor intensity by 50%+\n• No interval training or races outdoors\n• Your lungs need protection",
            5: "• 100% indoor training only\n• Or take rest day\n• Do not train outdoors - serious health risk\n• Even elite athletes should not train in these conditions"
        }
    }
    
    # Get specific advice or use default
    advice = group_advice.get(risk_group, group_advice["General Population"]).get(
        aqi, 
        "Monitor air quality and adjust activities accordingly"
    )
    
    return f"{base_advice.get(aqi, 'Air quality information')}\n\n{advice}"


# ============================================================================
# MongoDB Data Storage Functions
# ============================================================================

async def save_json_to_mongodb(
    collection_name: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Save JSON data to MongoDB
    
    Parameters:
    collection_name: Name of the MongoDB collection to save to
    data: JSON data to save (dictionary)
    
    Returns:
    Dictionary with success status and inserted document ID
    """
    try:
        # Get MongoDB database
        db = get_mongodb_database()
        collection = db[collection_name]
        
        # Add timestamp if not present
        from datetime import datetime, timezone
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        # Insert document
        result = await collection.insert_one(data)
        
        print(f"✅ Successfully saved document to MongoDB collection '{collection_name}'")
        print(f"   Document ID: {result.inserted_id}")
        
        return {
            "success": True,
            "collection": collection_name,
            "document_id": str(result.inserted_id),
            "timestamp": data.get('timestamp'),
            "message": "Data saved successfully to MongoDB"
        }
        
    except Exception as e:
        print(f"❌ Error saving to MongoDB: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save data to MongoDB: {str(e)}"
        )