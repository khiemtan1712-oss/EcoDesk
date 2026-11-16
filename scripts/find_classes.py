import re

with open('js/admin-product-modal.js', 'r', encoding='utf-8') as f:
    text = f.read()

cls = set(re.findall(r'class=["\']([^"\']+)["\']', text))
res = set()
for c in cls:
    for p in c.split():
        res.add(p)

print("Classes in admin-product-modal.js:")
for r in sorted(res):
    print(r)

