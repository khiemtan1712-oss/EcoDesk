import urllib.request
import json

res = urllib.request.urlopen('http://localhost:8080/api/products')
prods = json.loads(res.read())
for p in prods:
    print(f"ID: {p.get('id')} | Rating: {p.get('rating')} | Sold: {p.get('sold')} | Name: {p.get('name')}")

