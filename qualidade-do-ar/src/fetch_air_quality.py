import sys
import json
import requests

def get_air_quality(lat, lon, token):
    try:
        response = requests.get(f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={token}")
        return json.dumps(response.json())
    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    lat, lon, token = sys.argv[1:4]
    print(get_air_quality(lat, lon, token))