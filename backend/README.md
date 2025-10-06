# BreezAPI - Backend

FastAPI backend for fetching air quality, weather, and NASA TEMPO satellite data.

## Features

- 🌍 **OpenWeatherMap Integration**: Current air pollution, forecasts, and geocoding
- 🌦️ **Open-Meteo Weather**: Hourly and daily weather forecasts
- 🛰️ **NASA TEMPO Satellite**: Gas measurements from space (NO2, HCHO, O3)

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# OpenWeatherMap API Keys (required)
# Get yours at: https://openweathermap.org/api
OPENWEATHER_API_KEY_1=your_openweather_api_key_here
OPENWEATHER_API_KEY_2=optional_second_key
OPENWEATHER_API_KEY_3=optional_third_key

# Alternative: comma-separated keys
# OPENWEATHER_API_KEYS=key1,key2,key3

# NASA Earthdata Credentials (required for TEMPO endpoint)
# Register at: https://urs.earthdata.nasa.gov/
EARTHDATA_USERNAME=your_nasa_username
EARTHDATA_PASSWORD=your_nasa_password

# Data directory for TEMPO downloads (optional)
TEMPO_DATA_DIR=data/
```

### 3. Run the Server

```bash
# Development mode with auto-reload
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using the start script
./start.sh
```

## API Endpoints

### Air Pollution (OpenWeatherMap)

- `GET /air-pollution/current?lat={lat}&lon={lon}` - Current air quality
- `GET /air-pollution/forecast?lat={lat}&lon={lon}` - Hourly forecast
- `GET /air-pollution/forecast-daily?lat={lat}&lon={lon}` - Daily averaged forecast

### Weather (Open-Meteo)

- `GET /weather/forecast?lat={lat}&lon={lon}` - Weather forecast

### Geocoding (OpenWeatherMap)

- `GET /geocoding/search?q={query}&limit={limit}` - Search locations

### NASA TEMPO Satellite Data

- `GET /air-pollution/tempo?gas={gas}&lat={lat}&lon={lon}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}` - Gas measurements from space

Supported gases:
- `NO2` - Nitrogen Dioxide
- `HCHO` - Formaldehyde
- `O3PROF` - Ozone Profile
- `O3TOT` - Total Ozone

## API Key Fallback

The system supports multiple OpenWeatherMap API keys for automatic fallback if one is rate-limited or fails. Configure multiple keys using:

1. Numbered keys: `OPENWEATHER_API_KEY_1`, `OPENWEATHER_API_KEY_2`, etc.
2. Comma-separated: `OPENWEATHER_API_KEYS=key1,key2,key3`

## Documentation

Interactive API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Deployment

### Railway / Heroku

The app includes a `Procfile` for easy deployment:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set environment variables in your platform's dashboard.

## NASA Earthdata Authentication

For TEMPO satellite data, you need NASA Earthdata credentials. The system will:
1. Use credentials from environment variables (if set)
2. Fall back to `.netrc` file authentication
3. Prompt for credentials if not found

To set up `.netrc` authentication:

```bash
echo "machine urs.earthdata.nasa.gov login YOUR_USERNAME password YOUR_PASSWORD" >> ~/.netrc
chmod 600 ~/.netrc
```

## Development

The codebase is organized as follows:

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py      # Configuration and API keys
│   ├── routes.py      # API endpoints
│   └── services.py    # Business logic
├── main.py            # FastAPI application
├── requirements.txt   # Python dependencies
└── README.md
```

## License

Part of NASA Space Apps 2025 Hackathon project.
