import requests
import json

url = "https://assistente360-360un.vercel.app/api/auth/register"
payload = {
    "email": "test_final@example.com",
    "password": "password123",
    "name": "Test Final",
    "role": "student"
}
print(f"Testing: {url}")
try:
    resp = requests.post(url, json=payload, timeout=30)
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(f"success: {data.get('success')}")
    print(f"message: {data.get('message')}")
    print(f"error_type: {data.get('error_type')}")
    print(f"error_detail: {data.get('error_detail')}")
except Exception as e:
    print(f"Error: {e}")
