from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import os
import random
import string
import json

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Load questions securely into backend RAM for multiplayer syncing
QUESTIONS_DATA = []
try:
    with open('data/questions.json', 'r', encoding='utf-8') as f:
        QUESTIONS_DATA = json.load(f).get('categories', [])
except Exception as e:
    print("Warning: Multiplayer questions data failed to load:", e)

DB_NAME = 'squizz.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS multiplayer_rooms (
            room_id TEXT PRIMARY KEY,
            host TEXT,
            state TEXT,
            category_id TEXT,
            current_q_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS multiplayer_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            username TEXT,
            score INTEGER DEFAULT 0,
            is_ready BOOLEAN DEFAULT 0,
            UNIQUE(room_id, username)
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/api/activity', methods=['POST'])
def log_activity():
    data = request.json
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    conn = get_db_connection()
    # Log today's activity with exact timestamp string
    conn.execute(
        'INSERT INTO activity_logs (username, timestamp) VALUES (?, ?)', 
        (username, datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/user/<username>', methods=['GET'])
def get_user_status(username):
    conn = get_db_connection()
    logs = conn.execute(
        'SELECT timestamp FROM activity_logs WHERE username = ? ORDER BY timestamp DESC', 
        (username,)
    ).fetchall()
    conn.close()

    if not logs:
        return jsonify({'streak': 0, 'badges': []})

    # Extract strictly unique dates from timestamps
    # This prevents multiple plays on same day from breaking the streak logic
    unique_dates = set()
    for row in logs:
        # Parse 'YYYY-MM-DD HH:MM:SS' string into datetime objects then strip to Date
        dt = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
        unique_dates.add(dt.date())

    dates_played = sorted(list(unique_dates), reverse=True)
    
    streak = 0
    current_date = datetime.now().date()
    
    if len(dates_played) > 0:
        # If the most recent play was older than yesterday, the streak is lost (0)
        # Note: missing a 24-hour window practically means missing a calendar day in standard streak logic
        if (current_date - dates_played[0]) > timedelta(days=1):
            streak = 0
        else:
            # We have a valid streak to count backward
            # It starts from either today or yesterday
            expected_date = dates_played[0]
            for d in dates_played:
                if d == expected_date:
                    streak += 1
                    expected_date -= timedelta(days=1)
                else:
                    break
    
    # Achievements logic: 7-Day Warrior
    badges = []
    if streak >= 7:
        badges.append('7-Day Warrior')
        
    return jsonify({
        'streak': streak,
        'badges': badges,
        'last_played': dates_played[0].strftime('%Y-%m-%d') if dates_played else None
    })

# --- PHASE 14 MULTIPLAYER SOCKETS ---

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@socketio.on('create_room')
def handle_create_room(data):
    username = data.get('username')
    category_id = data.get('categoryId')
    room_id = generate_room_code()
    
    conn = get_db_connection()
    conn.execute('INSERT INTO multiplayer_rooms (room_id, host, state, category_id) VALUES (?, ?, ?, ?)',
                 (room_id, username, 'waiting', category_id))
    conn.execute('INSERT INTO multiplayer_players (room_id, username, score) VALUES (?, ?, 0)',
                 (room_id, username))
    conn.commit()
    conn.close()
    
    join_room(room_id)
    emit('room_created', {'roomId': room_id, 'host': username, 'categoryId': category_id})
    emit('player_joined', {'players': [{'username': username, 'score': 0}]}, room=room_id)

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('roomId', '').upper()
    username = data.get('username')
    
    conn = get_db_connection()
    room = conn.execute('SELECT * FROM multiplayer_rooms WHERE room_id = ?', (room_id,)).fetchone()
    
    if not room:
        emit('error', {'msg': 'Room not found'})
        return
    if room['state'] != 'waiting':
        emit('error', {'msg': 'Game already in progress'})
        return
        
    try:
        conn.execute('INSERT INTO multiplayer_players (room_id, username, score) VALUES (?, ?, 0)', (room_id, username))
        conn.commit()
    except sqlite3.IntegrityError:
        pass # Already joined
    
    players = conn.execute('SELECT username, score FROM multiplayer_players WHERE room_id = ?', (room_id,)).fetchall()
    conn.close()
    
    join_room(room_id)
    player_list = [{'username': p['username'], 'score': p['score']} for p in players]
    emit('player_joined', {'players': player_list}, room=room_id)

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data.get('roomId')
    conn = get_db_connection()
    room = conn.execute('SELECT * FROM multiplayer_rooms WHERE room_id = ?', (room_id,)).fetchone()
    if not room: return
    
    conn.execute('UPDATE multiplayer_rooms SET state = "playing", current_q_index = 0 WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()
    
    # Broadcast game start
    emit('game_started', {'categoryId': room['category_id']}, room=room_id)
    # Send first question slightly delayed
    socketio.sleep(2)
    send_question(room_id, 0)

def send_question(room_id, q_index):
    conn = get_db_connection()
    room = conn.execute('SELECT category_id FROM multiplayer_rooms WHERE room_id = ?', (room_id,)).fetchone()
    players = conn.execute('SELECT username, score FROM multiplayer_players WHERE room_id = ?', (room_id,)).fetchall()
    
    category = next((c for c in QUESTIONS_DATA if c['id'] == room['category_id']), None)
    
    if not category or q_index >= min(10, len(category['questions'])):
        conn.execute('UPDATE multiplayer_rooms SET state = "finished" WHERE room_id = ?', (room_id,))
        conn.commit()
        conn.close()
        sorted_players = sorted([{'username': p['username'], 'score': p['score']} for p in players], key=lambda x: x['score'], reverse=True)
        socketio.emit('game_over', {'leaderboard': sorted_players}, room=room_id)
        return
        
    conn.execute('UPDATE multiplayer_rooms SET current_q_index = ? WHERE room_id = ?', (q_index, room_id))
    conn.execute('UPDATE multiplayer_players SET is_ready = 0 WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()
    
    q_data = category['questions'][q_index]
    secure_q = {
        'q': q_data['q'],
        'options': q_data['options'],
        'timeLimit': category.get('timeLimit', 15),
        'index': q_index,
        'total': min(10, len(category['questions']))
    }
    
    leaderboard = [{'username': p['username'], 'score': p['score']} for p in players]
    leaderboard.sort(key=lambda x: x['score'], reverse=True)
    socketio.emit('next_question', {'question': secure_q, 'leaderboard': leaderboard}, room=room_id)
    
@socketio.on('submit_answer')
def handle_submit_answer(data):
    room_id = data.get('roomId')
    username = data.get('username')
    answer_idx = data.get('answerIdx')
    time_left = data.get('timeLeft')
    
    conn = get_db_connection()
    room = conn.execute('SELECT category_id, current_q_index FROM multiplayer_rooms WHERE room_id = ?', (room_id,)).fetchone()
    player = conn.execute('SELECT * FROM multiplayer_players WHERE room_id = ? AND username = ?', (room_id, username)).fetchone()
    
    if player['is_ready']:
        conn.close(); return
        
    category = next((c for c in QUESTIONS_DATA if c['id'] == room['category_id']), None)
    correct_idx = category['questions'][room['current_q_index']]['answer']
    
    points_earned = 0
    if answer_idx == correct_idx:
        points_earned = 10 + time_left
        
    conn.execute('UPDATE multiplayer_players SET score = score + ?, is_ready = 1 WHERE id = ?', (points_earned, player['id']))
    
    players = conn.execute('SELECT * FROM multiplayer_players WHERE room_id = ?', (room_id,)).fetchall()
    all_ready = all(p['is_ready'] for p in players)
    
    conn.commit()
    conn.close()
    
    leaderboard = [{'username': p['username'], 'score': p['score']} for p in players]
    leaderboard.sort(key=lambda x: x['score'], reverse=True)
    socketio.emit('update_leaderboard', {'leaderboard': leaderboard}, room=room_id)
    
    if all_ready:
        socketio.emit('round_ended', {'correctAnswer': correct_idx}, room=room_id)
        socketio.sleep(3)
        send_question(room_id, room['current_q_index'] + 1)

if __name__ == '__main__':
    init_db()
    print("Starting SQuizz Multiplayer Socket API Engine...")
    socketio.run(app, port=8082, debug=True)
