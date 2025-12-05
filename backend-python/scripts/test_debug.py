import requests

url = "https://assistente360-360un.vercel.app/debug"
print(f"Testing: {url}")
try:
    resp = requests.get(url, timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
except Exception as e:
    print(f"Error: {e}")
