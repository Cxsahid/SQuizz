from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import os
import random
import string
import json
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__, static_url_path='', static_folder='.')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
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


def calculate_current_streak(username):
    conn = get_db_connection()
    logs = conn.execute(
        'SELECT timestamp FROM activity_logs WHERE username = ? ORDER BY timestamp DESC',
        (username,)
    ).fetchall()
    conn.close()

    if not logs:
        return 0

    unique_dates = set()
    for row in logs:
        dt = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
        unique_dates.add(dt.date())

    dates_played = sorted(list(unique_dates), reverse=True)
    current_date = datetime.now().date()

    if not dates_played:
        return 0

    if (current_date - dates_played[0]) > timedelta(days=1):
        return 0

    streak = 0
    expected_date = dates_played[0]

    for played_date in dates_played:
        if played_date == expected_date:
            streak += 1
            expected_date -= timedelta(days=1)
        else:
            break

    return streak


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
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS quiz_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            quiz_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            time_spent INTEGER DEFAULT 0,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        conn.execute('ALTER TABLE quiz_results ADD COLUMN time_spent INTEGER DEFAULT 0')
    except Exception:
        pass
    try:
        conn.execute('ALTER TABLE users ADD COLUMN avatar_path TEXT')
    except Exception:
        pass
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

    unique_dates = set()
    for row in logs:
        dt = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
        unique_dates.add(dt.date())

    dates_played = sorted(list(unique_dates), reverse=True)

    streak = 0
    current_date = datetime.now().date()

    if len(dates_played) > 0:
        if (current_date - dates_played[0]) > timedelta(days=1):
            streak = 0
        else:
            expected_date = dates_played[0]
            for d in dates_played:
                if d == expected_date:
                    streak += 1
                    expected_date -= timedelta(days=1)
                else:
                    break

    badges = []
    if streak >= 7:
        badges.append('7-Day Warrior')

    return jsonify({
        'streak': streak,
        'badges': badges,
        'last_played': dates_played[0].strftime('%Y-%m-%d') if dates_played else None
    })


@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long for security.'}), 400

    conn = get_db_connection()
    # Enforce Uniqueness
    existing = conn.execute('SELECT * FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Username or Email is already taken. Please choose another one.'}), 409

    hashed_password = generate_password_hash(password)

    conn.execute('''
        INSERT INTO users (username, email, password, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ''', (username, email, hashed_password))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'username': username,
        'email': email
    })

@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.json or {}
    identifier = (data.get('identifier') or '').strip()
    password = (data.get('password') or '').strip()

    if not identifier or not password:
        return jsonify({'error': 'Username/Email and password are required'}), 400

    conn = get_db_connection()
    user = conn.execute('''
        SELECT * FROM users 
        WHERE (username = ? OR email = ?)
    ''', (identifier, identifier)).fetchone()
    conn.close()

    # Verify cryptographic hash of the password
    if user and check_password_hash(user['password'], password):
        return jsonify({'success': True, 'username': user['username']})
    else:
        return jsonify({'error': 'Invalid credentials. Please try again.'}), 401


@app.route('/api/quiz-result', methods=['POST'])
def save_quiz_result():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    quiz_name = (data.get('quiz_name') or '').strip()
    score = data.get('score')
    total_questions = data.get('total_questions')
    time_spent = data.get('time_spent', 0)

    if not username or not quiz_name:
        return jsonify({'error': 'Username and quiz_name are required'}), 400

    try:
        score = int(score)
        total_questions = int(total_questions)
        time_spent = int(time_spent)
    except (TypeError, ValueError):
        return jsonify({'error': 'score, total_questions and time_spent must be integers'}), 400

    conn = get_db_connection()
    existing_user = conn.execute(
        'SELECT username FROM users WHERE username = ?',
        (username,)
    ).fetchone()

    if not existing_user:
        conn.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            (username, '', '')
        )

    conn.execute('''
        INSERT INTO quiz_results (username, quiz_name, score, total_questions, time_spent)
        VALUES (?, ?, ?, ?, ?)
    ''', (username, quiz_name, score, total_questions, time_spent))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/profile/<username>', methods=['GET'])
def get_profile(username):
    conn = get_db_connection()

    user = conn.execute(
        'SELECT username, avatar_path FROM users WHERE username = ?',
        (username,)
    ).fetchone()

    summary = conn.execute('''
        SELECT
            COUNT(*) AS total_quizzes_played,
            COALESCE(SUM(score), 0) AS total_correct_answers,
            COALESCE(SUM(total_questions), 0) AS total_questions_answered
        FROM quiz_results
        WHERE username = ?
    ''', (username,)).fetchone()

    history_rows = conn.execute('''
        SELECT quiz_name, score, total_questions, time_spent, completed_at
        FROM quiz_results
        WHERE username = ?
        ORDER BY completed_at DESC, id DESC
        LIMIT 5
    ''', (username,)).fetchall()

    total_time_row = conn.execute('''
        SELECT SUM(time_spent) as total_time
        FROM quiz_results
        WHERE username = ?
    ''', (username,)).fetchone()
    total_time_spent = total_time_row['total_time'] if total_time_row and total_time_row['total_time'] else 0

    conn.close()

    total_correct_answers = summary['total_correct_answers'] or 0
    total_questions_answered = summary['total_questions_answered'] or 0
    total_quizzes_played = summary['total_quizzes_played'] or 0

    xp = total_correct_answers * 100
    level = (xp // 500) + 1
    accuracy_percentage = 0

    if total_questions_answered > 0:
        accuracy_percentage = round((total_correct_answers / total_questions_answered) * 100)

    quiz_history = []
    for row in history_rows:
        quiz_history.append({
            'quiz_name': row['quiz_name'],
            'score': f"{row['score']}/{row['total_questions']}",
            'time_spent': row['time_spent'] or 0,
            'completed_at': row['completed_at']
        })

    return jsonify({
        'username': user['username'] if user else username,
        'avatar_url': f"/uploads/{user['avatar_path']}" if user and user['avatar_path'] else None,
        'level': level,
        'xp': xp,
        'current_streak': calculate_current_streak(username),
        'total_quizzes_played': total_quizzes_played,
        'accuracy_percentage': accuracy_percentage,
        'total_time_spent': total_time_spent,
        'quiz_history': quiz_history
    })


@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/update-avatar', methods=['POST'])
def update_avatar():
    username = request.form.get('username')
    if not username:
        return jsonify({'error': 'Username required'}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    if 'avatar' not in request.files:
        conn.close()
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['avatar']
    if not file or not file.filename:
        conn.close()
        return jsonify({'error': 'Invalid file'}), 400

    avatar_filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], avatar_filename))

    try:
        conn.execute('UPDATE users SET avatar_path = ? WHERE username = ?', (avatar_filename, username))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': 'Database Error'}), 500

    conn.close()
    return jsonify({'success': True, 'avatar_url': f"/uploads/{avatar_filename}"})

@app.route('/api/quiz/trending', methods=['GET'])
def get_trending_quizzes():
    trending = [
        {"id": "js_advanced", "title": "Advanced JavaScript", "description": "Master closures, promises, and the event loop.", "level": 7, "difficulty": "Hard", "totalQuestions": 20},
        {"id": "python_basics", "title": "Python Basics", "description": "Strengthen your core foundation in Python data structures.", "level": 3, "difficulty": "Medium", "totalQuestions": 15},
        {"id": "react_hooks", "title": "React Architecture", "description": "Deep dive into component lifecycle and advanced states.", "level": 6, "difficulty": "Hard", "totalQuestions": 18}
    ]
    return jsonify(trending)

@app.route('/api/user/progress/<username>', methods=['GET'])
def get_all_user_progress(username):
    conn = get_db_connection()
    results = conn.execute('''
        SELECT quiz_name, MAX(score) as max_score, MAX(total_questions) as tot_q, SUM(time_spent) as tot_t, COUNT(id) as attempts
        FROM quiz_results
        WHERE username = ?
        GROUP BY quiz_name
    ''', (username,)).fetchall()
    conn.close()

    progress_map = {}
    for r in results:
        tot_q = r['tot_q']
        if tot_q > 0:
            percentage = int((r['max_score'] / tot_q) * 100)
            accuracy = int((r['max_score'] / tot_q) * 100)
        else:
            percentage = 0
            accuracy = 0
        avg_time = int(r['tot_t'] / r['attempts']) if r['attempts'] > 0 else 0
        
        progress_map[r['quiz_name']] = {
            "completedQuestions": r['max_score'],
            "percentage": percentage,
            "accuracy": accuracy,
            "avgTime": f"{avg_time}s",
            "xp": r['max_score'] * 100
        }
    return jsonify(progress_map)

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
        pass

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
    if not room:
        return

    conn.execute('UPDATE multiplayer_rooms SET state = "playing", current_q_index = 0 WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()

    emit('game_started', {'categoryId': room['category_id']}, room=room_id)
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
        conn.close()
        return

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