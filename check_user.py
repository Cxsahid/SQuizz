import sqlite3
import os

db_path = 'squizz.db'
if not os.path.exists(db_path):
    print("DB NOT FOUND")
else:
    conn = sqlite3.connect(db_path)
    user = conn.execute("SELECT username FROM users WHERE username = 'sahid123'").fetchone()
    print(user[0] if user else 'NOT FOUND')
    conn.close()
