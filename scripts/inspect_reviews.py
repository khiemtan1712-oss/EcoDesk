import json
import urllib.request

with open('reviews.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Total products with reviews in reviews.json:', len(data))
all_revs = []
for pid, revs in data.items():
    print(f'Product {pid}: {len(revs)} reviews')
    for r in revs:
        all_revs.append((pid, r))
        print(f"  - id={r.get('id')} user={r.get('userId')}/{r.get('userName')}/{r.get('userEmail')} rating={r.get('rating')} orderId={r.get('orderId')} status={r.get('status')} verifiedPurchase={r.get('verifiedPurchase')}")

# Fetch all orders from backend
try:
    res = urllib.request.urlopen('http://localhost:8080/api/orders')
    orders = json.loads(res.read())
    print(f'\nTotal orders from backend: {len(orders)}')
    for o in orders:
        items = o.get('items') or []
        items_summary = [f"{it.get('productId') or it.get('id')}:{it.get('quantity')}" for it in items]
        print(f"Order #{o.get('id')} user={o.get('userId')}/{o.get('customerName')}/{o.get('customerEmail')} status={o.get('status')} items={items_summary}")
except Exception as e:
    print('Error fetching orders:', e)

