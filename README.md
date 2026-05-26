# Weekly Budget Planner

Run the server and open http://localhost:5000 in your browser. The app now persists data to SQLite via a local Flask server.

Installation and run (Python)
1. From the budget-app folder create a venv and install dependencies:
   python -m venv venv
   venv\Scripts\activate  (Windows) or source venv/bin/activate (macOS/Linux)
   pip install -r requirements.txt
2. Start the server:
   python server.py
3. Open http://localhost:5000

Notes: the server persists data in budget-app/budget.db (SQLite).

Files:
- index.html — UI
- styles.css — simple styling
- app.js — app logic: add/remove costs, save to localStorage, convert frequencies to weekly, calculate totals, export CSV

Notes:
- Fixed and variable costs accept a frequency (weekly, monthly, yearly). Income input is biweekly; all amounts are converted to weekly equivalents when calculating (biweekly income is divided by 2).
- To run a local static server: `python -m http.server` from the budget-app folder (optional).
