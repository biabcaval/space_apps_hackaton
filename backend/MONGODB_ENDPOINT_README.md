# MongoDB Data Storage Endpoint

## Overview

A new FastAPI endpoint has been added to store any JSON data to MongoDB. This endpoint provides a flexible way to save structured data to MongoDB collections.

## Endpoint Details

**URL:** `POST /data/store`

**Query Parameter:**
- `collection` (required): Name of the MongoDB collection to store data in

**Request Body:**
- Any valid JSON object

**Response:**
```json
{
  "success": true,
  "collection": "collection_name",
  "document_id": "507f1f77bcf86cd799439011",
  "timestamp": "2024-01-15T12:30:45.123456+00:00",
  "message": "Data saved successfully to MongoDB"
}
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

New packages added:
- `motor` - Async MongoDB driver for Python
- `pymongo` - MongoDB Python driver

### 2. Configure MongoDB

Add these environment variables to your `.env` file:

```env
# MongoDB Configuration
MONGO_URI=mongodb://mongo:qWFNXBgMtmzAqlSkbtHnmrNHLSUreLwA@centerbeam.proxy.rlwy.net:45179
MONGODB_DATABASE=air_quality_db
```

**Default values:**
- URI: Railway MongoDB connection (default: `mongodb://localhost:27017` if not set)
- Database: `air_quality_db`

### 3. Start MongoDB

Make sure MongoDB is running on your system:

**macOS (with Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Start the Backend

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Usage Examples

### Example 1: Store User Notification Preferences

```bash
curl -X POST "http://localhost:8000/data/store?collection=notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "name": "John Doe",
    "phone": "+1234567890",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "preferences": {
      "notify_when_aqi_above": 3
    }
  }'
```

### Example 2: Store Sensor Data

```bash
curl -X POST "http://localhost:8000/data/store?collection=sensor_readings" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "sensor001",
    "aqi": 3,
    "pollutants": {
      "pm2_5": 35.5,
      "pm10": 60.2,
      "no2": 85.3,
      "o3": 110.7
    }
  }'
```

### Example 3: Store Air Quality Alert

```bash
curl -X POST "http://localhost:8000/data/store?collection=alerts" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "high_aqi",
    "severity": "warning",
    "aqi": 4,
    "location": "Los Angeles, CA",
    "message": "Air quality is poor"
  }'
```

## Features

### Automatic Timestamp

If your JSON data doesn't include a `timestamp` field, one will be automatically added with the current UTC time in ISO format.

**Example:**
```json
{
  "user_id": "123",
  "data": "some data"
}
```

Becomes:
```json
{
  "user_id": "123",
  "data": "some data",
  "timestamp": "2024-01-15T12:30:45.123456+00:00"
}
```

### Flexible Collections

You can store data in any collection name. Collections are created automatically if they don't exist.

**Common collection names:**
- `notifications` - User notification preferences
- `sensor_readings` - Air quality sensor data
- `alerts` - Air quality alerts
- `feedback` - User feedback
- `search_history` - Location search history
- `comparisons` - Air quality comparison data

### Nested Data Support

The endpoint supports complex nested JSON structures:

```json
{
  "project": "air_quality",
  "data": {
    "measurements": [
      {"time": "09:00", "aqi": 2},
      {"time": "12:00", "aqi": 3}
    ],
    "statistics": {
      "average_aqi": 2.5,
      "location": "Station Alpha"
    }
  }
}
```

## Integration Examples

### Frontend Integration (TypeScript/JavaScript)

```typescript
// Save notification preferences
async function saveNotificationPreferences(data: any) {
  const response = await fetch('http://localhost:8000/data/store?collection=notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  console.log('Saved:', result.document_id);
  return result;
}

// Usage
saveNotificationPreferences({
  name: "John Doe",
  phone: "+1234567890",
  location: { lat: 40.7128, lon: -74.0060 }
});
```

### Python Integration

```python
import requests

def save_to_mongodb(collection: str, data: dict):
    url = f"http://localhost:8000/data/store?collection={collection}"
    response = requests.post(url, json=data)
    return response.json()

# Usage
result = save_to_mongodb('sensor_readings', {
    'sensor_id': 'sensor001',
    'aqi': 3,
    'pollutants': {
        'pm2_5': 35.5,
        'pm10': 60.2
    }
})

print(f"Document ID: {result['document_id']}")
```

## API Documentation

Once the server is running, you can access:

- **Interactive API Docs:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

The `/data/store` endpoint will be documented there with a "Try it out" feature.

## MongoDB Operations

### View Stored Data

Using MongoDB shell:
```bash
mongosh

use air_quality_db
db.notifications.find().pretty()
db.sensor_readings.find().pretty()
```

Using Python:
```python
from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['air_quality_db']

# View all notifications
for doc in db.notifications.find():
    print(doc)
```

## Error Handling

The endpoint will return appropriate HTTP status codes:

- `200 OK` - Data saved successfully
- `500 Internal Server Error` - MongoDB connection error or data save failure

Error response example:
```json
{
  "detail": "Failed to save data to MongoDB: Connection refused"
}
```

## Security Considerations

### Production Deployment

For production environments:

1. **Use authentication:**
   ```env
   MONGODB_URL=mongodb://username:password@host:27017/database?authSource=admin
   ```

2. **Use MongoDB Atlas (cloud):**
   ```env
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

3. **Enable SSL/TLS:**
   ```env
   MONGODB_URL=mongodb://host:27017/database?ssl=true
   ```

4. **Add request validation** to the endpoint to ensure data integrity

## Testing

Use the provided test file:
```bash
# Backend test file
backend/test_mongodb_endpoint.http
```

You can use VS Code REST Client extension or any HTTP client to run these tests.

## Troubleshooting

### MongoDB not running
**Error:** `Failed to save data to MongoDB: Connection refused`

**Solution:** Start MongoDB service
```bash
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Connection timeout
**Error:** `ServerSelectionTimeoutError`

**Solution:** Check if MongoDB is accessible at the configured URL and port

### Permission denied
**Error:** `Authentication failed`

**Solution:** Verify MongoDB credentials in the `.env` file

## Support

For more information:
- FastAPI Docs: https://fastapi.tiangolo.com/
- Motor Docs: https://motor.readthedocs.io/
- MongoDB Docs: https://www.mongodb.com/docs/
