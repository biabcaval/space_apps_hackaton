# Environment Setup Instructions

## Create .env File

Create a file named `.env` in the `backend` directory with the following content:

```env
# MongoDB Configuration (Railway)
MONGO_URI=mongodb://mongo:qWFNXBgMtmzAqlSkbtHnmrNHLSUreLwA@centerbeam.proxy.rlwy.net:45179
MONGODB_DATABASE=air_quality_db

# OpenWeatherMap API Keys
OPENWEATHER_API_KEY_1=your_openweather_api_key_here
OPENWEATHER_API_KEY_2=
OPENWEATHER_API_KEY_3=

# NASA Earthdata Credentials (for TEMPO data)
EARTHDATA_USERNAME=
EARTHDATA_PASSWORD=

# Data directory for TEMPO downloads
TEMPO_DATA_DIR=data/

# OpenAI API Key (for health advice generation)
OPENAI_API_KEY=
```

## Quick Setup Command

Run this command in the `backend` directory to create the `.env` file:

```bash
cat > .env << 'EOF'
MONGO_URI=mongodb://mongo:qWFNXBgMtmzAqlSkbtHnmrNHLSUreLwA@centerbeam.proxy.rlwy.net:45179
MONGODB_DATABASE=air_quality_db
OPENWEATHER_API_KEY_1=your_openweather_api_key_here
TEMPO_DATA_DIR=data/
EOF
```

## Verify Connection

After creating the `.env` file, restart the backend server:

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
✅ Connected to MongoDB at mongodb://mongo:***@centerbeam.proxy.rlwy.net:45179
```

## Test the MongoDB Endpoint

```bash
curl -X POST "http://localhost:8000/data/store?collection=test" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Railway MongoDB!", "timestamp": "2024-01-01T00:00:00Z"}'
```

You should get a successful response with a `document_id`!
