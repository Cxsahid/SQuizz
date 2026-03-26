import sqlite3
from werkzeug.security import generate_password_hash

db_path = 'squizz.db'
conn = sqlite3.connect(db_path)
hashed_pw = generate_password_hash('sahid123')
conn.execute("UPDATE users SET password = ? WHERE username = 'sahid123'", (hashed_pw,))
conn.commit()
print("PASSWORD UPDATED FOR sahid123")
conn.close()
