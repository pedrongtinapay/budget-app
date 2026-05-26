import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).parent / 'budget.db'
_lock = threading.Lock()

def _get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize DB
with _lock:
    conn = _get_conn()
    c = conn.cursor()
    c.execute('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)')
    c.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, type TEXT, name TEXT, amount REAL, freq TEXT)')
    conn.commit()
    conn.close()

def get_data():
    conn = _get_conn()
    c = conn.cursor()
    c.execute("SELECT v FROM meta WHERE k = ?", ('income',))
    row = c.fetchone()
    income = float(row['v']) if row and row['v'] is not None else 0.0
    c.execute("SELECT id,name,amount,freq FROM items WHERE type = ?", ('fixed',))
    fixed = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id,name,amount,freq FROM items WHERE type = ?", ('variable',))
    variable = [dict(r) for r in c.fetchall()]
    conn.close()
    return {'income': income, 'fixed': fixed, 'variable': variable}

def save_data(data):
    income = data.get('income', 0)
    fixed = data.get('fixed', []) or []
    variable = data.get('variable', []) or []
    conn = _get_conn()
    c = conn.cursor()
    with _lock:
        c.execute("INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)", ('income', str(income)))
        c.execute("DELETE FROM items WHERE type = ?", ('fixed',))
        c.execute("DELETE FROM items WHERE type = ?", ('variable',))
        for f in fixed:
            c.execute("INSERT INTO items (type,name,amount,freq) VALUES (?,?,?,?)", ('fixed', str(f.get('name','')), float(f.get('amount') or 0), f.get('freq','weekly')))
        for v in variable:
            c.execute("INSERT INTO items (type,name,amount,freq) VALUES (?,?,?,?)", ('variable', str(v.get('name','')), float(v.get('amount') or 0), v.get('freq','weekly')))
        conn.commit()
    conn.close()

def _convert_to_weekly(amount, freq):
    if not amount:
        return 0.0
    WEEKS_PER_MONTH = 52.0/12.0
    WEEKS_PER_YEAR = 52.0
    if freq == 'weekly':
        return float(amount)
    if freq == 'monthly':
        return float(amount) / WEEKS_PER_MONTH
    if freq == 'yearly':
        return float(amount) / WEEKS_PER_YEAR
    return float(amount)

def calculate():
    data = get_data()
    income_weekly = (data.get('income', 0) or 0) / 2.0  # income stored as biweekly
    fixed_weekly = sum(_convert_to_weekly(i['amount'], i['freq']) for i in data.get('fixed', []))
    variable_weekly = sum(_convert_to_weekly(i['amount'], i['freq']) for i in data.get('variable', []))
    total = fixed_weekly + variable_weekly
    leftover = income_weekly - total
    return {
        'incomeWeekly': income_weekly,
        'fixedWeekly': fixed_weekly,
        'variableWeekly': variable_weekly,
        'total': total,
        'leftover': leftover
    }
