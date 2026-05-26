import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).parent / 'budget.db'
_lock = threading.Lock()

def _get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize DB and ensure columns
with _lock:
    conn = _get_conn()
    c = conn.cursor()
    # Create tables if missing
    c.execute('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)')
    # items includes optional min_amount and max_amount for variable items
    c.execute('''CREATE TABLE IF NOT EXISTS items (
                 id INTEGER PRIMARY KEY,
                 type TEXT,
                 name TEXT,
                 amount REAL,
                 min_amount REAL,
                 max_amount REAL,
                 freq TEXT
                 )''')
    # Ensure columns exist for older schemas (add if absent)
    c.execute("PRAGMA table_info(items)")
    cols = [r[1] for r in c.fetchall()]
    if 'min_amount' not in cols:
        try:
            c.execute('ALTER TABLE items ADD COLUMN min_amount REAL')
        except Exception:
            pass
    if 'max_amount' not in cols:
        try:
            c.execute('ALTER TABLE items ADD COLUMN max_amount REAL')
        except Exception:
            pass
    conn.commit()
    conn.close()

def get_data():
    conn = _get_conn()
    c = conn.cursor()
    c.execute("SELECT v FROM meta WHERE k = ?", ('income',))
    row = c.fetchone()
    income = float(row['v']) if row and row['v'] is not None else 0.0
    c.execute("SELECT id,name,amount,min_amount,max_amount,freq FROM items WHERE type = ?", ('fixed',))
    fixed = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id,name,amount,min_amount,max_amount,freq FROM items WHERE type = ?", ('variable',))
    variable = [dict(r) for r in c.fetchall()]
    conn.close()
    return {'income': income, 'fixed': fixed, 'variable': variable}

def save_data(data):
    # Only update income if provided (not None). This avoids accidental overwrites when clients send null/omitted income.
    income_provided = 'income' in data and data.get('income') is not None and data.get('income') != ''
    fixed = data.get('fixed', []) or []
    variable = data.get('variable', []) or []
    conn = _get_conn()
    c = conn.cursor()
    with _lock:
        if income_provided:
            # coerce to float when possible
            try:
                income_val = float(data.get('income'))
            except Exception:
                income_val = 0.0
            c.execute("INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)", ('income', str(income_val)))
        # replace items fully
        c.execute("DELETE FROM items WHERE type = ?", ('fixed',))
        c.execute("DELETE FROM items WHERE type = ?", ('variable',))
        for f in fixed:
            # fixed uses 'amount'
            amt = float(f.get('amount') or 0)
            c.execute("INSERT INTO items (type,name,amount,min_amount,max_amount,freq) VALUES (?,?,?,?,?,?)",
                      ('fixed', str(f.get('name','')), amt, None, None, f.get('freq','weekly')))
        for v in variable:
            # variable prefers min/max; fallback to amount if provided
            try:
                min_a = None if v.get('min') in (None,'') else float(v.get('min'))
            except Exception:
                min_a = None
            try:
                max_a = None if v.get('max') in (None,'') else float(v.get('max'))
            except Exception:
                max_a = None
            # also allow legacy 'amount' field
            amt = None
            try:
                amt = None if v.get('amount') in (None,'') else float(v.get('amount'))
            except Exception:
                amt = None
            c.execute("INSERT INTO items (type,name,amount,min_amount,max_amount,freq) VALUES (?,?,?,?,?,?)",
                      ('variable', str(v.get('name','')), amt, min_a, max_a, v.get('freq','weekly')))
        conn.commit()
    conn.close()

def _convert_to_weekly(amount, freq):
    if amount is None:
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
    # fixed: amount field
    fixed_weekly = sum(_convert_to_weekly(i.get('amount') or 0, i.get('freq') or 'weekly') for i in data.get('fixed', []))
    # variable: compute average of min/max if present, else use amount
    variable_weekly = 0.0
    for i in data.get('variable', []):
        min_a = i.get('min_amount')
        max_a = i.get('max_amount')
        amt = i.get('amount')
        avg = None
        if min_a is not None and max_a is not None:
            avg = (min_a + max_a) / 2.0
        elif amt is not None:
            avg = amt
        elif min_a is not None:
            avg = min_a
        elif max_a is not None:
            avg = max_a
        else:
            avg = 0.0
        variable_weekly += _convert_to_weekly(avg, i.get('freq') or 'weekly')
    total = fixed_weekly + variable_weekly
    leftover = income_weekly - total
    return {
        'incomeWeekly': income_weekly,
        'fixedWeekly': fixed_weekly,
        'variableWeekly': variable_weekly,
        'total': total,
        'leftover': leftover
    }
