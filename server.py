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
    save_data(payload)
    return jsonify({'ok': True})

@app.route('/api/calculate', methods=['GET'])
def api_calculate():
    return jsonify(db_calculate())

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
