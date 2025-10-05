#!/usr/bin/env python3
"""
Simple test script for the MongoDB data storage endpoint
This script demonstrates how to use the /data/store endpoint
"""

import requests
import json
from datetime import datetime

# API endpoint
BASE_URL = "http://localhost:8000"
ENDPOINT = f"{BASE_URL}/data/store"

def test_endpoint(collection_name: str, data: dict):
    """
    Test the MongoDB storage endpoint
    
    Args:
        collection_name: Name of the MongoDB collection
        data: Dictionary containing the data to store
    """
    print(f"\n{'='*70}")
    print(f"Testing: {collection_name}")
    print(f"{'='*70}")
    
    url = f"{ENDPOINT}?collection={collection_name}"
    
    print(f"📤 Sending data to: {url}")
    print(f"📦 Data: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=10)
        
        print(f"\n📊 Response Status: {response.status_code}")
        print(f"📄 Response Body:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
        else:
            print("❌ FAILED!")
            
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend server")
        print("   Make sure the backend is running on http://localhost:8000")
    except requests.exceptions.Timeout:
        print("❌ ERROR: Request timed out")
        print("   This might happen if MongoDB is not responding")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")


def main():
    """Run all tests"""
    
    print("\n" + "="*70)
    print("🧪 MongoDB Endpoint Test Suite")
    print("="*70)
    
    # Check if backend is running
    try:
        response = requests.get(BASE_URL, timeout=5)
        print(f"✅ Backend is running: {response.json()['message']}")
    except:
        print("❌ Backend is not running!")
        print("   Start it with: cd backend && python -m uvicorn main:app --reload")
        return
    
    # Test 1: Store notification preferences
    test_endpoint("notifications", {
        "user_id": "test_user_001",
        "name": "Test User",
        "phone": "+1234567890",
        "location": {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "address": "New York, NY"
        },
        "preferences": {
            "notify_when_aqi_above": 3,
            "notification_time": "09:00"
        }
    })
    
    # Test 2: Store sensor reading
    test_endpoint("sensor_readings", {
        "sensor_id": "sensor_test_001",
        "location": {
            "latitude": 34.0522,
            "longitude": -118.2437
        },
        "aqi": 3,
        "pollutants": {
            "pm2_5": 35.5,
            "pm10": 60.2,
            "no2": 85.3,
            "o3": 110.7
        },
        "weather": {
            "temperature": 22.5,
            "humidity": 65
        }
    })
    
    # Test 3: Store air quality alert
    test_endpoint("alerts", {
        "alert_type": "high_aqi",
        "severity": "warning",
        "aqi": 4,
        "location": "Test Location",
        "message": "Air quality is poor. Test alert.",
        "affected_groups": [
            "Elderly (65+)",
            "Children",
            "People with Respiratory Conditions"
        ]
    })
    
    # Test 4: Store simple data
    test_endpoint("test_collection", {
        "test": True,
        "message": "Hello MongoDB!",
        "number": 42,
        "array": [1, 2, 3],
        "nested": {
            "key": "value"
        }
    })
    
    print("\n" + "="*70)
    print("🏁 Test Suite Complete")
    print("="*70)
    print("\n📝 Notes:")
    print("   - If you see 'Connection refused' errors, MongoDB is not running")
    print("   - Start MongoDB with: brew services start mongodb-community (macOS)")
    print("   - Or use Docker: docker run -d -p 27017:27017 mongo:latest")
    print("   - View stored data: mongosh → use air_quality_db → db.notifications.find()")
    print("\n")


if __name__ == "__main__":
    main()
