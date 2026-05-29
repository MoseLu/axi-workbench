import sqlite3
db = sqlite3.connect('E:/app/sop/backend/sop.db')
db.row_factory = sqlite3.Row
cur = db.cursor()
cur.execute('SELECT id, uuid, display_name, status, last_seen FROM devices ORDER BY last_seen DESC LIMIT 30')
for r in cur.fetchall():
    print(dict(r))
db.close()
