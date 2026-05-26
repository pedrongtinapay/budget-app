from flask import Flask, request, jsonify, send_from_directory
import os
from db import get_data, save_data, calculate as db_calculate

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/data', methods=['GET'])
def api_get_data():
    return jsonify(get_data())

@app.route('/api/data', methods=['POST'])
def api_save_data():
    payload = request.get_json() or {}
    app.logger.info('POST /api/data payload: %s', payload)
    save_data(payload)
    saved = get_data()
    app.logger.info('Saved data snapshot: %s', saved)
    # return the saved data so client can confirm what was persisted
    return jsonify(saved)

@app.route('/api/debug', methods=['GET'])
def api_debug():
    # return db file information to help debug persistence
    from pathlib import Path
    p = Path(__file__).parent / 'budget.db'
    info = { 'db_path': str(p), 'exists': p.exists() }
    if p.exists():
        info.update({ 'size': p.stat().st_size, 'modified': p.stat().st_mtime })
    return jsonify(info)

@app.route('/api/calculate', methods=['GET'])
def api_calculate():
    return jsonify(db_calculate())

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
