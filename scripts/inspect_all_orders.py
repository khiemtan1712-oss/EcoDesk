import urllib.request
import json

res = urllib.request.urlopen('http://localhost:8080/api/orders')
orders = json.loads(res.read())

print(f"Total orders: {len(orders)}")
for o in orders:
    items_raw = o.get('itemsJson') or "[]"
    try:
        items = json.loads(items_raw)
    except:
        items = []
    prod_ids = [it.get('productId') or it.get('id') for it in items]
    print(f"ID: {o.get('id')} | UserID: {o.get('userId')} | Email: {o.get('customerEmail')} | Status: {o.get('status')} | Products: {prod_ids}")

# Also check users
res_u = urllib.request.urlopen('http://localhost:8080/api/users')
users = json.loads(res_u.read())
print(f"\nTotal users: {len(users)}")
for u in users:
    print(f"User ID: {u.get('id')} | Email: {u.get('email')} | Name: {u.get('name')} | Role: {u.get('role')}")

