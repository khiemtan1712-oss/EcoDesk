import subprocess

cmd = ['docker', 'exec', '-i', 'ecodesk-mysql', 'mysql', '-u', 'root', '-proot', 'ecodesk_db', '-e', 'SHOW TABLES;']
res = subprocess.run(cmd, capture_output=True, text=True)
print('Tables in ecodesk_db:')
print(res.stdout)

