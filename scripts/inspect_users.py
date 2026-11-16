import urllib.request
import json

req_u = urllib.request.Request('http://localhost:8080/api/users', headers={'X-EcoDesk-User-Id': 'U_ADMIN'})
res_u = urllib.request.urlopen(req_u)
users = json.loads(res_u.read())
print(f"Total users: {len(users)}")
for u in users:
    print(f"User ID: {u.get('id')} | Email: {u.get('email')} | Name: {u.get('name')} | Role: {u.get('role')}")

