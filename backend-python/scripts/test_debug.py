import requests

url = "https://ativa-ia-9rkb.vercel.app/debug"
print(f"Testing: {url}")
try:
    resp = requests.get(url, timeout=15)
    data = resp.json()
    print(f"flask_env: {data.get('flask_env')}")
    print(f"database_url_configured: {data.get('database_url_configured')}")
    print(f"database_url_preview: {data.get('database_url_preview')}")
    print(f"sqlalchemy_uri_set: {data.get('sqlalchemy_uri_set')}")
    print(f"debug_mode: {data.get('debug_mode')}")
except Exception as e:
    print(f"Error: {e}")
