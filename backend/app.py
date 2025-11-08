from eventlet import monkey_patch

monkey_patch()

import os
import random
import string
import time
from pathlib import Path
from uuid import uuid4

import eventlet
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room

from auth_routes import auth_bp
from database import db
from models import GameMode
from stats_routes import stats_bp
from stats_service import record_multiplayer_match, record_singleplayer_result
from termo import Termo
from words import get_random_word, get_word_list


# === 🧩 Caminhos corrigidos ===

# Caminho do arquivo atual (ex: /MuskiGuess/Backend/app.py)
BASE_DIR = Path(__file__).resolve().parent

# Caminho da raiz do projeto (sobe um nível: /MuskiGuess)
ROOT_DIR = BASE_DIR.parent

# Caminho da pasta "static" (fica na raiz)
STATIC_DIR = ROOT_DIR / "static"

# Caminho da pasta "data" (fica dentro de Backend)
DATA_DIR = BASE_DIR / "data"


# === ⚙️ Criação do app Flask ===
app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder=str(STATIC_DIR))

load_dotenv(ROOT_DIR / "db.env")
load_dotenv(ROOT_DIR / ".env")

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError(
        "DATABASE_URL não está definido. Configure db.env ou exporte a variável."
    )

app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "change-me-in-production"),
    SQLALCHEMY_DATABASE_URI=database_url,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE=os.environ.get("SESSION_COOKIE_SAMESITE", "Lax"),
)

db.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="*")

app.register_blueprint(auth_bp)
app.register_blueprint(stats_bp)

with app.app_context():
    db.create_all()

games = {}
next_game_id = 1
multiplayer_rooms = {}
player_room_index = {}
_room_gc_started = False

MAX_PLAYERS_PER_ROOM = 6
MIN_PLAYERS_PER_ROOM = 2
ROUND_ATTEMPTS = 6
ROOM_IDLE_TIMEOUT = 600  # seconds
ROOM_SWEEP_INTERVAL = 30  # seconds

BOT_SID_PREFIX = "bot:"
# Default delay acts as a fallback whenever a preset is missing.
BOT_GUESS_DELAY_RANGE = (2.0, 4.0)
BOT_ROUND_START_GRACE_SECONDS = 3.2
DEFAULT_BOT_DIFFICULTY = "medium"
BOT_DIFFICULTY_PRESETS = {
    "easy": {
        "delay_range": (3.2, 5.0),
        "filter_accuracy": 0.55,
        "wild_guess_chance": 0.15,
    },
    "medium": {
        "delay_range": (2.0, 4.0),
        "filter_accuracy": 0.8,
        "wild_guess_chance": 0.05,
    },
    "hard": {
        "delay_range": (1.6, 3.0),
        "filter_accuracy": 1.0,
        "wild_guess_chance": 0.0,
    },
}
BOT_NAME_POOL = [
    "BOT Atlas",
    "BOT Sigma",
    "BOT Nexo",
    "BOT Orion",
    "BOT Vega",
    "BOT Titan",
]


import os

# Caminho base do projeto (mesmo diretório deste arquivo app.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Pasta onde ficam os arquivos de dados
DATA_DIR = os.path.join(BASE_DIR, "data")

# Carregar palavras portuguesas
portuguese_words = set()
try:
    file_path_pt = os.path.join(DATA_DIR, 'palavras_5letras.txt')
    with open(file_path_pt, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if len(word) == 5:
                portuguese_words.add(word)
    print(f"Carregadas {len(portuguese_words)} portuguesas")
except FileNotFoundError:
    print(f"Arquivo {file_path_pt} não encontrado")
except Exception as e:
    print(f"Erro ao carregar palavras portuguesas: {e}")

# Carregar palavras inglesas
english_words = set()
try:
    file_path_en = os.path.join(DATA_DIR, 'words_5letters.txt')
    with open(file_path_en, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if len(word) == 5:
                english_words.add(word)
    print(f"Carregadas {len(english_words)} inglesas")
except FileNotFoundError:
    print(f"Arquivo {file_path_en} não encontrado")
except Exception as e:
    print(f"Erro ao carregar palavras inglesas: {e}")

def _word_exists_in_lang(word: str, lang: str) -> bool:
    if lang == "pt":
        return word in portuguese_words
    if lang == "en":
        return word in english_words
    return word in portuguese_words or word in english_words

def _check_guess_statuses_for_word(word: str, guess: str):
    """Return list of {letter, status} for a single word vs guess, Wordle rules."""
    letters = [c.upper() for c in guess]
    statuses = [None] * 5
    word_chars = list(word)
    guess_chars = list(guess)
    word_used = [False] * 5
    # Greens first
    for i in range(5):
        if guess_chars[i] == word_chars[i]:
            statuses[i] = 'green'
            word_used[i] = True
    # Yellows/Grays
    for i in range(5):
        if statuses[i] is None:
            found = False
            for j in range(5):
                if not word_used[j] and guess_chars[i] == word_chars[j]:
                    found = True
                    word_used[j] = True
                    break
            statuses[i] = 'yellow' if found else 'gray'
    return [{"letter": letters[i], "status": statuses[i]} for i in range(5)]


def _generate_room_code(length: int = 5) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choice(alphabet) for _ in range(length))
        if code not in multiplayer_rooms:
            return code


def _resolve_stats_mode(mode: str, word_count: int) -> GameMode:
    normalized = (mode or "").lower()
    if normalized in {"duet", "dupleto"} or word_count == 2:
        return GameMode.DUPLETO
    if normalized in {"quaplet", "quapleto"} or word_count >= 4:
        return GameMode.QUAPLETO
    return GameMode.CLASSIC


def _game_meta(game):
    if isinstance(game, Termo):
        meta = getattr(game, "meta", None)
        if meta is None:
            meta = {}
            setattr(game, "meta", meta)
        meta.setdefault("cheat_used", False)
        return meta
    if isinstance(game, dict):
        meta = game.get("meta")
        if meta is None:
            meta = {}
            game["meta"] = meta
        meta.setdefault("cheat_used", False)
        return meta
    return {}


def _record_singleplayer_stats_if_needed(game, won: bool):
    meta = _game_meta(game)
    if not meta or meta.get("stats_recorded"):
        return
    if meta.get("cheat_used") and won:
        meta["stats_recorded"] = True
        return
    user_id = meta.get("user_id")
    mode = meta.get("mode")
    if user_id and isinstance(mode, GameMode):
        record_singleplayer_result(user_id, mode, bool(won))
    meta["stats_recorded"] = True


def _sanitize_player_name(name: str) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        cleaned = "Jogador"
    return cleaned[:20]


def _require_multiplayer_login(sid: str | None = None) -> bool:
    if session.get("user_id"):
        return True
    target = sid or request.sid
    emit(
        "room_error",
        {"error": "Faça login para jogar o multiplayer."},
        to=target,
    )
    return False


def _scoreboard_snapshot(room: dict) -> list:
    players = []
    for sid, player in room["players"].items():
        players.append({
            "playerId": player["id"],
            "name": player["name"],
            "score": player["score"],
            "isHost": sid == room.get("host_sid"),
            "isBot": bool(player.get("is_bot")),
        })
    players.sort(key=lambda item: (-item["score"], item["name"].lower()))
    return players


def _is_bot_sid(sid: str | None) -> bool:
    return isinstance(sid, str) and sid.startswith(BOT_SID_PREFIX)


def _generate_bot_name(room: dict) -> str:
    counter = room.setdefault("bot_counter", 0) + 1
    room["bot_counter"] = counter
    base = random.choice(BOT_NAME_POOL)
    if counter <= len(BOT_NAME_POOL):
        return base
    return f"{base} #{counter}"


def _bot_word_pool(lang: str) -> list:
    return list(get_word_list(lang))


def _normalize_bot_difficulty(value: str | None) -> str:
    if not value:
        return DEFAULT_BOT_DIFFICULTY
    normalized = value.lower()
    if normalized in BOT_DIFFICULTY_PRESETS:
        return normalized
    return DEFAULT_BOT_DIFFICULTY


def _bot_preset_for(meta: dict | None = None, room: dict | None = None) -> dict:
    difficulty = DEFAULT_BOT_DIFFICULTY
    if meta and meta.get("difficulty"):
        difficulty = _normalize_bot_difficulty(meta["difficulty"])
    elif room:
        difficulty = _normalize_bot_difficulty(room.get("bot_difficulty"))
    return BOT_DIFFICULTY_PRESETS.get(difficulty, BOT_DIFFICULTY_PRESETS[DEFAULT_BOT_DIFFICULTY])


def _stop_bot_task(room: dict, bot_sid: str):
    bots = room.get("bots")
    if not bots:
        return
    meta = bots.get(bot_sid)
    if not meta:
        return
    task = meta.get("task")
    if task:
        try:
            task.kill()
        except Exception:
            pass
        meta["task"] = None


def _clear_all_bots(room: dict):
    bots = room.get("bots")
    if not bots:
        return
    for bot_sid in list(bots.keys()):
        _stop_bot_task(room, bot_sid)
        room["players"].pop(bot_sid, None)
        bots.pop(bot_sid, None)


def _add_bot_player(room: dict) -> dict:
    bot_sid = f"{BOT_SID_PREFIX}{uuid4().hex}"
    player_id = uuid4().hex
    bot_name = _generate_bot_name(room)
    player = {
        "id": player_id,
        "name": bot_name,
        "score": 0,
        "attempts": 0,
        "joined_at": time.time(),
        "user_id": None,
        "is_bot": True,
    }
    room["players"][bot_sid] = player
    room.setdefault("bots", {})[bot_sid] = {
        "sid": bot_sid,
        "name": bot_name,
        "task": None,
        "candidates": [],
        "used": set(),
        "lang": room.get("lang", "pt"),
        "difficulty": _normalize_bot_difficulty(room.get("bot_difficulty")),
        "round_grace_until": None,
    }
    return bot_sid, player


def _launch_bots_for_round(room: dict):
    bots = room.get("bots")
    if not bots:
        return
    lang = room.get("lang", "pt")
    for bot_sid, meta in list(bots.items()):
        if bot_sid not in room["players"]:
            continue
        meta["lang"] = lang
        meta["candidates"] = _bot_word_pool(lang)
        meta["used"] = set()
        meta["difficulty"] = _normalize_bot_difficulty(room.get("bot_difficulty"))
        meta["round_grace_until"] = room.get("bot_round_grace_until")
        _stop_bot_task(room, bot_sid)
        meta["task"] = socketio.start_background_task(_bot_worker, room["code"], bot_sid)


def _bot_worker(room_code: str, bot_sid: str):
    while True:
        room = multiplayer_rooms.get(room_code)
        if not room or room.get("status") != "playing" or room.get("round_complete"):
            return
        meta = room.get("bots", {}).get(bot_sid)
        preset = _bot_preset_for(meta, room)
        delay_range = preset.get("delay_range") or BOT_GUESS_DELAY_RANGE
        min_delay, max_delay = delay_range
        if max_delay < min_delay:
            min_delay, max_delay = max_delay, min_delay
        eventlet.sleep(random.uniform(min_delay, max_delay))
        room = multiplayer_rooms.get(room_code)
        if not room or room.get("status") != "playing" or room.get("round_complete"):
            return
        meta = room.get("bots", {}).get(bot_sid)
        preset = _bot_preset_for(meta, room)
        if not meta:
            return
        grace_until = max(
            room.get("bot_round_grace_until") or 0.0,
            meta.get("round_grace_until") or 0.0,
        )
        if grace_until:
            now = time.time()
            if now < grace_until:
                eventlet.sleep(grace_until - now)
                room = multiplayer_rooms.get(room_code)
                if not room or room.get("status") != "playing" or room.get("round_complete"):
                    return
                meta = room.get("bots", {}).get(bot_sid)
                if not meta:
                    return
        if bot_sid not in room["players"]:
            return
        player = room["players"][bot_sid]
        if player["attempts"] >= room.get("max_attempts", ROUND_ATTEMPTS):
            return
        guess = _select_bot_guess(room, bot_sid)
        if not guess:
            return
        success, feedback = _execute_guess(room, bot_sid, guess, result_target=None)
        if not success:
            return
        _refine_bot_candidates(room, bot_sid, guess, feedback, preset=preset)
        if room.get("round_complete"):
            return


def _select_bot_guess(room: dict, bot_sid: str) -> str | None:
    meta = room.get("bots", {}).get(bot_sid)
    if not meta:
        return None
    lang = meta.get("lang") or room.get("lang", "pt")
    candidates = meta.get("candidates")
    if not candidates:
        candidates = _bot_word_pool(lang)
    used = meta.setdefault("used", set())
    preset = _bot_preset_for(meta, room)
    pool = candidates
    wild_chance = max(0.0, min(1.0, preset.get("wild_guess_chance", 0.0)))
    if random.random() < wild_chance:
        pool = _bot_word_pool(lang)
    pool = [word for word in pool if word not in used]
    if not pool:
        pool = _bot_word_pool(lang)
        used.clear()
        pool = [word for word in pool if word not in used] or pool
    if not pool:
        return None
    guess = random.choice(pool)
    used.add(guess)
    return guess


def _refine_bot_candidates(
    room: dict,
    bot_sid: str,
    guess: str,
    feedback: list[dict],
    *,
    preset: dict | None = None,
):
    meta = room.get("bots", {}).get(bot_sid)
    if not meta:
        return
    candidates = meta.get("candidates") or _bot_word_pool(room.get("lang", "pt"))
    filtered = _filter_candidates_by_feedback(candidates, guess, feedback)
    preset = preset or _bot_preset_for(meta, room)
    accuracy = preset.get("filter_accuracy", 1.0)
    accuracy = max(0.1, min(1.0, accuracy))
    next_candidates = filtered[:]
    if next_candidates:
        random.shuffle(next_candidates)
        keep_count = max(1, int(len(next_candidates) * accuracy))
        if keep_count < len(next_candidates):
            next_candidates = next_candidates[:keep_count]
    noise_ratio = max(0.0, 1.0 - accuracy)
    if noise_ratio > 0 and candidates:
        pool = [word for word in candidates if word not in next_candidates]
        if pool:
            random.shuffle(pool)
            base_size = len(next_candidates) or len(candidates)
            extra_count = int(base_size * noise_ratio)
            if extra_count <= 0:
                extra_count = 1 if len(pool) > 0 else 0
            next_candidates.extend(pool[:extra_count])
    if not next_candidates:
        next_candidates = candidates
    meta["candidates"] = next_candidates


def _filter_candidates_by_feedback(candidates: list[str], guess: str, feedback: list[dict]) -> list[str]:
    filtered = []
    guess_lower = guess.lower()
    target_statuses = [item["status"] for item in feedback]
    for word in candidates:
        statuses = _check_guess_statuses_for_word(word, guess_lower)
        if all(statuses[i]["status"] == target_statuses[i] for i in range(5)):
            filtered.append(word)
    return filtered or candidates


def _room_payload(room: dict) -> dict:
    return {
        "code": room["code"],
        "status": room["status"],
        "roundNumber": room.get("round_index", 0),
        "roundsTarget": room.get("rounds_target"),
        "roundsCompleted": room.get("standard_rounds_completed", 0),
        "tiebreakerActive": room.get("tiebreaker_active", False),
        "players": _scoreboard_snapshot(room),
        "maxAttempts": room.get("max_attempts", ROUND_ATTEMPTS),
        "canStart": room["status"] == "lobby" and len(room["players"]) >= MIN_PLAYERS_PER_ROOM,
        "canPlayAgain": room["status"] == "finished",
        "hostId": room.get("host_player_id"),
        "language": room.get("lang", "pt"),
        "botDifficulty": room.get("bot_difficulty", DEFAULT_BOT_DIFFICULTY),
    }


def _broadcast_room_state(room: dict):
    socketio.emit("room_update", _room_payload(room), to=room["code"])


def _touch_room(room: dict):
    if not room:
        return
    room["last_activity"] = time.time()


def _ensure_host(room: dict):
    if not room["players"]:
        room["host_sid"] = None
        room["host_player_id"] = None
        return
    current_host_sid = room.get("host_sid")
    if current_host_sid in room["players"] and not room["players"][current_host_sid].get("is_bot"):
        return
    sorted_players = sorted(
        room["players"].items(),
        key=lambda item: item[1].get("joined_at", time.time())
    )
    chosen_sid = None
    chosen_player = None
    for candidate_sid, candidate in sorted_players:
        if not candidate.get("is_bot"):
            chosen_sid = candidate_sid
            chosen_player = candidate
            break
    if not chosen_player and sorted_players:
        chosen_sid, chosen_player = sorted_players[0]
    if not chosen_player:
        room["host_sid"] = None
        room["host_player_id"] = None
        return
    if room.get("host_sid") == chosen_sid:
        return
    room["host_sid"] = chosen_sid
    room["host_player_id"] = chosen_player["id"]
    socketio.emit("host_change", {"playerId": chosen_player["id"]}, to=room["code"])


def _determine_leaders(room: dict) -> list:
    if not room["players"]:
        return []
    max_score = max(player["score"] for player in room["players"].values())
    return [player for player in room["players"].values() if player["score"] == max_score]


def _all_attempts_spent(room: dict) -> bool:
    if not room["players"]:
        return False
    return all(player["attempts"] >= room["max_attempts"] for player in room["players"].values())


def _execute_guess(room: dict, sid: str, guess: str, *, result_target: str | None = None):
    player = room["players"].get(sid)
    if not player:
        return False, "Jogador inválido."
    if player["attempts"] >= room["max_attempts"]:
        return False, "Você já usou todas as tentativas."
    guess_lc = guess.lower()
    player["attempts"] += 1
    feedback = _check_guess_statuses_for_word(room["current_word"], guess_lc)
    result_payload = {
        "playerId": player["id"],
        "guess": guess.upper(),
        "feedback": feedback,
        "attempt": player["attempts"],
        "maxAttempts": room["max_attempts"],
        "roundNumber": room.get("round_index", 0),
    }
    if result_target:
        socketio.emit("guess_result", result_payload, to=result_target)
    peer_payload = {
        "playerId": player["id"],
        "attempt": player["attempts"],
        "feedback": [item["status"] for item in feedback],
        "roundNumber": room.get("round_index", 0),
    }
    emit_kwargs = {"to": room["code"]}
    if result_target:
        emit_kwargs["skip_sid"] = result_target
    socketio.emit("peer_guess", peer_payload, **emit_kwargs)
    if all(item["status"] == "green" for item in feedback):
        room["round_winner_sid"] = sid
        player["score"] += 1
        _broadcast_room_state(room)
        _finalize_round(room, winner_sid=sid, was_draw=False)
        return True, feedback
    if _all_attempts_spent(room):
        _broadcast_room_state(room)
        _finalize_round(room, winner_sid=None, was_draw=True)
    else:
        _broadcast_room_state(room)
    return True, feedback


def _queue_round_transition(code: str, action: str, delay: float = 3.0):
    def _runner():
        socketio.sleep(delay)
        room = multiplayer_rooms.get(code)
        if not room or room["status"] != "playing":
            return
        if action == "standard":
            _start_new_round(room, is_tiebreaker=False)
        elif action == "tiebreaker":
            _start_new_round(room, is_tiebreaker=True)

    socketio.start_background_task(_runner)


def _room_gc_worker():
    while True:
        socketio.sleep(ROOM_SWEEP_INTERVAL)
        now = time.time()
        for code, room in list(multiplayer_rooms.items()):
            if not room:
                continue
            if room.get("players"):
                continue
            last_activity = room.get("last_activity") or now
            if now - last_activity >= ROOM_IDLE_TIMEOUT:
                multiplayer_rooms.pop(code, None)


if not _room_gc_started:
    _room_gc_started = True
    socketio.start_background_task(_room_gc_worker)


def _start_new_round(room: dict, *, is_tiebreaker: bool = False):
    if room["status"] != "playing":
        return
    if len(room["players"]) < MIN_PLAYERS_PER_ROOM:
        _finish_match(room, cancelled=True)
        return
    _touch_room(room)
    room["round_index"] = room.get("round_index", 0) + 1
    room["current_round_tiebreaker"] = is_tiebreaker
    room["round_complete"] = False
    room["round_draw"] = False
    room["round_winner_sid"] = None
    room["current_word"] = get_random_word(room.get("lang", "pt"))
    room["round_started_at"] = time.time()
    room["bot_round_grace_until"] = room["round_started_at"] + BOT_ROUND_START_GRACE_SECONDS
    for player in room["players"].values():
        player["attempts"] = 0
    socketio.emit(
        "round_started",
        {
            "roundNumber": room["round_index"],
            "isTiebreaker": is_tiebreaker,
            "maxAttempts": room["max_attempts"],
            "scoreboard": _scoreboard_snapshot(room),
            "roundsTarget": room["rounds_target"],
            "standardRoundsCompleted": room.get("standard_rounds_completed", 0),
        },
        to=room["code"],
    )
    _broadcast_room_state(room)
    _launch_bots_for_round(room)


def _finish_match(room: dict, *, winner_ids=None, cancelled: bool = False):
    if winner_ids is None:
        winner_ids = []
    _touch_room(room)
    room["status"] = "finished"
    room["current_word"] = None
    room["round_winner_sid"] = None
    room["round_draw"] = False
    room["round_complete"] = True
    room["tiebreaker_active"] = False
    room["current_round_tiebreaker"] = False
    room["bot_round_grace_until"] = None
    winners_payload = []
    if winner_ids:
        allowed = set(winner_ids)
        for player in room["players"].values():
            if player["id"] in allowed:
                winners_payload.append(
                    {
                        "playerId": player["id"],
                        "name": player["name"],
                        "score": player["score"],
                    }
                )
    scoreboard_snapshot = _scoreboard_snapshot(room)
    socketio.emit(
        "match_over",
        {
            "scoreboard": scoreboard_snapshot,
            "winners": winners_payload,
            "cancelled": cancelled,
        },
        to=room["code"],
    )
    if not cancelled and not room.get("stats_recorded"):
        winner_set = set(winner_ids or [])
        participants = []
        for player in room.get("players", {}).values():
            user_id = player.get("user_id")
            if not user_id:
                continue
            participants.append((int(user_id), player["id"] in winner_set))
        if participants:
            record_multiplayer_match(participants)
            room["stats_recorded"] = True
    _clear_all_bots(room)
    _broadcast_room_state(room)


def _finalize_round(room: dict, *, winner_sid=None, was_draw: bool = False):
    if room.get("round_complete"):
        return
    _touch_room(room)
    room["round_complete"] = True
    room["rounds_completed"] = room.get("rounds_completed", 0) + 1
    is_tiebreaker = room.get("current_round_tiebreaker", False)
    if not is_tiebreaker:
        room["standard_rounds_completed"] = room.get("standard_rounds_completed", 0) + 1
    winner_payload = None
    if winner_sid and winner_sid in room["players"]:
        player = room["players"][winner_sid]
        winner_payload = {
            "playerId": player["id"],
            "name": player["name"],
            "score": player["score"],
        }
    room.setdefault("match_history", []).append(
        {
            "round": room.get("round_index", 0),
            "winner": winner_payload["playerId"] if winner_payload else None,
            "draw": was_draw,
            "word": room["current_word"].upper() if room.get("current_word") else "",
            "isTiebreaker": is_tiebreaker,
        }
    )
    socketio.emit(
        "round_result",
        {
            "roundNumber": room.get("round_index", 0),
            "winner": winner_payload,
            "draw": was_draw,
            "isTiebreaker": is_tiebreaker,
            "correctWord": room["current_word"].upper() if room.get("current_word") else "",
            "scoreboard": _scoreboard_snapshot(room),
        },
        to=room["code"],
    )
    leaders = _determine_leaders(room)
    if room.get("tiebreaker_active"):
        if len(leaders) == 1:
            _finish_match(room, winner_ids=[leaders[0]["id"]])
        else:
            socketio.emit(
                "tiebreaker_pending",
                {
                    "leaders": [
                        {
                            "playerId": player["id"],
                            "name": player["name"],
                            "score": player["score"],
                        }
                        for player in leaders
                    ]
                },
                to=room["code"],
            )
            _queue_round_transition(room["code"], action="tiebreaker")
        return
    if room.get("standard_rounds_completed", 0) >= room.get("rounds_target", 0):
        if len(leaders) == 1:
            _finish_match(room, winner_ids=[leaders[0]["id"]])
            return
        room["tiebreaker_active"] = True
        socketio.emit(
            "tiebreaker_start",
            {
                "leaders": [
                    {
                        "playerId": player["id"],
                        "name": player["name"],
                        "score": player["score"],
                    }
                    for player in leaders
                ]
            },
            to=room["code"],
        )
        _queue_round_transition(room["code"], action="tiebreaker")
        return
    _queue_round_transition(room["code"], action="standard")


def _remove_player_from_room(code: str, sid: str, *, notify: bool = True):
    room = multiplayer_rooms.get(code)
    player_room_index.pop(sid, None)
    if not room:
        return
    player = room["players"].pop(sid, None)
    if not player:
        return
    was_bot = bool(player.get("is_bot"))
    if was_bot:
        _stop_bot_task(room, sid)
        room.get("bots", {}).pop(sid, None)
    else:
        leave_room(code)
    if notify:
        socketio.emit(
            "player_left",
            {"playerId": player["id"], "name": player["name"], "bot": was_bot},
            to=code,
        )
    _touch_room(room)
    if not room["players"]:
        room["host_sid"] = None
        room["host_player_id"] = None
        room["empty_since"] = time.time()
        room["status"] = "lobby"
        room["current_word"] = None
        room["round_complete"] = True
        room["round_draw"] = False
        room["round_started_at"] = None
        room["tiebreaker_active"] = False
        room["current_round_tiebreaker"] = False
        room["stats_recorded"] = False
        return
    if not any(not pl.get("is_bot") for pl in room["players"].values()):
        _clear_all_bots(room)
        room["host_sid"] = None
        room["host_player_id"] = None
        room["empty_since"] = time.time()
        room["status"] = "lobby"
        room["current_word"] = None
        room["round_complete"] = True
        room["round_draw"] = False
        room["round_started_at"] = None
        room["tiebreaker_active"] = False
        room["current_round_tiebreaker"] = False
        room["stats_recorded"] = False
        _broadcast_room_state(room)
        return
    _ensure_host(room)
    if room["status"] == "playing" and len(room["players"]) < MIN_PLAYERS_PER_ROOM:
        _finish_match(room, cancelled=True)
        return
    _broadcast_room_state(room)


@socketio.on("create_room")
def handle_create_room(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    name = _sanitize_player_name(payload.get("name"))
    username = session.get("username")
    if username:
        name = username
    rounds = payload.get("rounds")
    if rounds not in {1, 3, 5, 10, 15}:
        rounds = 3
    lang = (payload.get("lang") or "pt").lower()
    if lang not in {"pt", "en"}:
        lang = "pt"
    code = _generate_room_code()
    join_room(code)
    player_id = uuid4().hex
    player_room_index[sid] = code
    user_id = session.get("user_id")
    player = {
        "id": player_id,
        "name": name,
        "score": 0,
        "attempts": 0,
        "joined_at": time.time(),
        "user_id": user_id,
        "is_bot": False,
    }
    multiplayer_rooms[code] = {
        "code": code,
        "host_sid": sid,
        "host_player_id": player_id,
        "status": "lobby",
        "lang": lang,
        "initial_rounds": rounds,
        "rounds_target": rounds,
        "round_index": 0,
        "rounds_completed": 0,
        "standard_rounds_completed": 0,
        "tiebreaker_active": False,
        "current_round_tiebreaker": False,
        "current_word": None,
        "round_winner_sid": None,
        "round_draw": False,
        "round_complete": True,
        "round_started_at": None,
        "bot_round_grace_until": None,
        "players": {sid: player},
        "max_attempts": ROUND_ATTEMPTS,
        "match_history": [],
        "last_activity": time.time(),
        "empty_since": None,
        "stats_recorded": False,
        "bots": {},
        "bot_counter": 0,
        "bot_difficulty": DEFAULT_BOT_DIFFICULTY,
    }
    _touch_room(multiplayer_rooms[code])
    emit(
        "room_created",
        {
            "code": code,
            "playerId": player_id,
            "host": True,
            "roundsTarget": rounds,
            "language": lang,
            "botDifficulty": DEFAULT_BOT_DIFFICULTY,
        },
        to=sid,
    )
    _broadcast_room_state(multiplayer_rooms[code])


@socketio.on("join_room")
def handle_join_room_event(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get("code") or "").strip().upper()
    name = _sanitize_player_name(payload.get("name"))
    username = session.get("username")
    if username:
        name = username
    resume_requested = bool(payload.get("resume"))
    if not code or code not in multiplayer_rooms:
        emit("room_error", {"error": "Sala n�o encontrada."}, to=sid)
        return
    room = multiplayer_rooms[code]
    if room["status"] == "playing" and not resume_requested:
        emit("room_error", {"error": "A partida jǭ come�ou."}, to=sid)
        return
    if len(room["players"]) >= MAX_PLAYERS_PER_ROOM:
        emit("room_error", {"error": "Sala cheia."}, to=sid)
        return
    if sid in room["players"]:
        emit("room_joined", {"code": code, "playerId": room["players"][sid]["id"]}, to=sid)
        return
    join_room(code)
    player_id = uuid4().hex
    player_room_index[sid] = code
    user_id = session.get("user_id")
    player = {
        "id": player_id,
        "name": name,
        "score": 0,
        "attempts": 0,
        "joined_at": time.time(),
        "user_id": user_id,
        "is_bot": False,
    }
    room["players"][sid] = player
    _touch_room(room)
    room["empty_since"] = None
    emit(
        "room_joined",
        {
            "code": code,
            "playerId": player_id,
            "host": False,
            "language": room.get("lang", "pt"),
            "roundsTarget": room.get("rounds_target"),
            "botDifficulty": room.get("bot_difficulty", DEFAULT_BOT_DIFFICULTY),
        },
        to=sid,
    )
    socketio.emit(
        "player_joined",
        {"playerId": player_id, "name": name, "bot": False},
        to=code,
        skip_sid=sid,
    )
    _broadcast_room_state(room)


@socketio.on("update_settings")
def handle_update_settings(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get("code") or "").strip().upper()
    room = multiplayer_rooms.get(code)
    if not room or sid != room.get("host_sid"):
        emit("room_error", {"error": "Apenas o criador pode alterar as configura��es."}, to=sid)
        return
    if room["status"] != "lobby":
        emit("room_error", {"error": "N�o Ǹ poss�vel alterar durante a partida."}, to=sid)
        return
    updated = False
    rounds = payload.get("rounds")
    if rounds in {1, 3, 5, 10, 15}:
        room["rounds_target"] = rounds
        room["initial_rounds"] = rounds
        updated = True
    lang = payload.get("lang")
    if isinstance(lang, str):
        lang_code = lang.lower()
        if lang_code in {"pt", "en"}:
            room["lang"] = lang_code
            updated = True
    difficulty = payload.get("difficulty")
    if isinstance(difficulty, str):
        normalized = _normalize_bot_difficulty(difficulty)
        if normalized != room.get("bot_difficulty"):
            room["bot_difficulty"] = normalized
            bots = room.get("bots") or {}
            for meta in bots.values():
                meta["difficulty"] = normalized
            updated = True
    if updated:
        _touch_room(room)
        emit(
            "settings_updated",
            {
                "roundsTarget": room["rounds_target"],
                "language": room["lang"],
                "botDifficulty": room["bot_difficulty"],
            },
            to=sid,
        )
        _broadcast_room_state(room)


@socketio.on("add_bot")
def handle_add_bot(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get("code") or "").strip().upper()
    room = multiplayer_rooms.get(code)
    if not room:
        emit("room_error", {"error": "Sala não encontrada."}, to=sid)
        return
    if room["status"] != "lobby":
        emit("room_error", {"error": "Adicione bots apenas no lobby."}, to=sid)
        return
    if sid != room.get("host_sid"):
        emit("room_error", {"error": "Apenas o criador pode adicionar bots."}, to=sid)
        return
    if len(room["players"]) >= MAX_PLAYERS_PER_ROOM:
        emit("room_error", {"error": "Sala cheia."}, to=sid)
        return
    bot_sid, bot_player = _add_bot_player(room)
    room["empty_since"] = None
    _touch_room(room)
    socketio.emit(
        "player_joined",
        {"playerId": bot_player["id"], "name": bot_player["name"], "bot": True},
        to=room["code"],
    )
    _broadcast_room_state(room)


@socketio.on("start_game")
def handle_start_game(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get("code") or "").strip().upper()
    room = multiplayer_rooms.get(code)
    if not room:
        emit("room_error", {"error": "Sala n�o encontrada."}, to=sid)
        return
    if sid != room.get("host_sid"):
        emit("room_error", {"error": "Apenas o criador pode iniciar a partida."}, to=sid)
        return
    if room["status"] == "playing":
        emit("room_error", {"error": "A partida jǭ estǭ em andamento."}, to=sid)
        return
    if len(room["players"]) < MIN_PLAYERS_PER_ROOM:
        emit("room_error", {"error": "S�o necessǭrios pelo menos dois jogadores."}, to=sid)
        return
    rounds = payload.get("rounds")
    if rounds in {1, 3, 5, 10, 15}:
        room["rounds_target"] = rounds
        room["initial_rounds"] = rounds
    lang = (payload.get("lang") or room["lang"]).lower()
    if lang in {"pt", "en"}:
        room["lang"] = lang
    room["status"] = "playing"
    room["round_index"] = 0
    room["rounds_completed"] = 0
    room["standard_rounds_completed"] = 0
    room["tiebreaker_active"] = False
    room["current_round_tiebreaker"] = False
    room["match_history"] = []
    room["stats_recorded"] = False
    for player in room["players"].values():
        player["score"] = 0
        player["attempts"] = 0
    room["empty_since"] = None
    _touch_room(room)
    socketio.emit(
        "match_started",
        {
            "roundsTarget": room["rounds_target"],
            "language": room["lang"],
        },
        to=code,
    )
    _broadcast_room_state(room)
    _start_new_round(room, is_tiebreaker=False)


@socketio.on("submit_guess")
def handle_submit_guess(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get('code') or '').strip().upper()
    guess = (payload.get('guess') or '').strip().lower()
    room = multiplayer_rooms.get(code)
    if not room or sid not in room['players']:
        emit('guess_error', {'error': 'Sala ou jogador inválido.'}, to=sid)
        return
    if room['status'] != 'playing' or not room.get('current_word'):
        emit('guess_error', {'error': 'A rodada ainda não está ativa.'}, to=sid)
        return
    if room.get('round_complete'):
        emit('guess_error', {'error': 'Aguardando próxima rodada.'}, to=sid)
        return
    if len(guess) != 5 or not guess.isalpha():
        emit('guess_error', {'error': 'Informe uma palavra de 5 letras.'}, to=sid)
        return
    lang = room.get('lang', 'pt')
    if not _word_exists_in_lang(guess, lang):
        emit('guess_error', {'error': 'Palavra não reconhecida na lista selecionada.'}, to=sid)
        return
    _touch_room(room)
    success, result = _execute_guess(room, sid, guess, result_target=sid)
    if not success:
        emit('guess_error', {'error': result}, to=sid)


@socketio.on("leave_room")
def handle_leave_room_event(data):
    code = None
    if isinstance(data, dict):
        code = (data.get("code") or "").strip().upper()
    if not code:
        code = player_room_index.get(request.sid)
    if code:
        _remove_player_from_room(code, request.sid)
    emit("left_room", {"code": code}, to=request.sid)


@socketio.on("play_again")
def handle_play_again(data):
    payload = data or {}
    sid = request.sid
    if not _require_multiplayer_login(sid):
        return
    code = (payload.get("code") or "").strip().upper()
    room = multiplayer_rooms.get(code)
    if not room:
        emit("room_error", {"error": "Sala n�o encontrada."}, to=sid)
        return
    if sid != room.get("host_sid"):
        emit("room_error", {"error": "Apenas o criador pode reiniciar."}, to=sid)
        return
    if room["status"] != "finished":
        emit("room_error", {"error": "A partida ainda n�o terminou."}, to=sid)
        return
    rounds = payload.get("rounds")
    if rounds in {1, 3, 5, 10, 15}:
        room["rounds_target"] = rounds
        room["initial_rounds"] = rounds
    _touch_room(room)
    _clear_all_bots(room)
    room["bots"] = room.get("bots") or {}
    room["empty_since"] = None
    room["status"] = "lobby"
    room["round_index"] = 0
    room["rounds_completed"] = 0
    room["standard_rounds_completed"] = 0
    room["tiebreaker_active"] = False
    room["current_round_tiebreaker"] = False
    room["current_word"] = None
    room["round_complete"] = True
    room["round_draw"] = False
    room["match_history"] = []
    room["stats_recorded"] = False
    for player in room["players"].values():
        player["score"] = 0
        player["attempts"] = 0
    socketio.emit(
        "match_reset",
        {
            "roundsTarget": room["rounds_target"],
            "language": room["lang"],
        },
        to=code,
    )
    _broadcast_room_state(room)


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    code = player_room_index.get(sid)
    if code:
        _remove_player_from_room(code, sid, notify=True)


@app.post("/api/new-game")
def new_game():
    global next_game_id
    data = request.get_json(silent=True) or {}
    lang = (data.get("lang") or 'pt').lower()
    mode = (data.get("mode") or 'single').lower()
    word_count = int(data.get("wordCount") or (1 if mode == 'single' else 2))
    # default attempts: 6 for single, 7 for multi
    max_attempts = int(data.get("maxAttempts") or (6 if word_count == 1 else 7))
    stats_mode = _resolve_stats_mode(mode, word_count)
    user_id = session.get("user_id")

    game_id = str(next_game_id)
    next_game_id += 1

    if word_count == 1:
        # Keep existing Termo behavior for backward compatibility
        word = get_random_word(lang)
        game = Termo(word)
        game.max_attempts = max_attempts
        meta = _game_meta(game)
        meta.update(
            {
                "mode": stats_mode,
                "user_id": user_id,
                "stats_recorded": False,
                "cheat_used": False,
            }
        )
        games[game_id] = game
        return jsonify({
            "gameId": game_id,
            "maxAttempts": game.max_attempts,
            "lang": lang,
            "wordCount": 1,
            "maskedWords": ["-----"],
        })

    # Multi-word game stored as a dict to avoid changing Termo
    words = [get_random_word(lang) for _ in range(word_count)]
    games[game_id] = {
        "type": "multi",
        "lang": lang,
        "words": words,  # list of lowercase strings
        "attempts": 0,
        "max_attempts": max_attempts,
        "won_mask": [False] * word_count,
        "startedAt": None,
        "meta": {
            "mode": stats_mode,
            "user_id": user_id,
            "stats_recorded": False,
            "cheat_used": False,
        },
    }
    return jsonify({
        "gameId": game_id,
        "wordCount": word_count,
        "maxAttempts": max_attempts,
        "maskedWords": ["-----" for _ in range(word_count)],
        "lang": lang,
    })

@app.post("/api/guess")
def make_guess():
    data = request.get_json(silent=True) or {}
    game_id = data.get("gameId")
    guess = (data.get("guess") or "").strip().lower()
    if not game_id or game_id not in games:
        return jsonify({"error": "Jogo não encontrado"}), 404
    game = games[game_id]

    # Multi-word game path
    if isinstance(game, dict) and game.get("type") == "multi":
        if len(guess) != 5 or not guess.isalpha():
            return jsonify({"error": "Palpite inválido. Informe 5 letras."}), 400
        if game["attempts"] >= game["max_attempts"]:
            return jsonify({"error": "Sem tentativas restantes."}), 400

        feedback_list = []
        won_all = True
        correct_words_upper = []
        for idx, word in enumerate(game["words"]):
            fb = _check_guess_statuses_for_word(word, guess)
            feedback_list.append(fb)
            # Determine if this word is solved (all greens)
            solved = all(item["status"] == 'green' for item in fb)
            if solved:
                game["won_mask"][idx] = True
            if not game["won_mask"][idx]:
                won_all = False
            correct_words_upper.append(word.upper())

        game["attempts"] += 1
        game_over = game["attempts"] >= game["max_attempts"] or won_all
        response = {
            "feedback": feedback_list,
            "attempts": game["attempts"],
            "maxAttempts": game["max_attempts"],
            "won": won_all,
            "gameOver": game_over,
        }
        if game_over:
            response["correctWords"] = correct_words_upper
            _record_singleplayer_stats_if_needed(game, won_all)
        return jsonify(response)

    # Single game path (Termo)
    if not game.is_valid_guess(guess):
        return jsonify({"error": "Palpite inválido. Informe 5 letras."}), 400
    feedback = game.check_guess_statuses(guess)
    won = game.is_winner()
    game_over = game.is_game_over()
    response = {
        "feedback": feedback,
        "attempts": game.attempts,
        "maxAttempts": game.max_attempts,
        "won": won,
        "gameOver": game_over,
    }
    if won or game_over:
        response["correctWord"] = game.word.upper()
    if game_over:
        _record_singleplayer_stats_if_needed(game, won)
    return jsonify(response)

@app.get("/api/peek")
def peek_correct_word():
    game_id = request.args.get("gameId", type=str)
    if not game_id or game_id not in games:
        return jsonify({"error": "Jogo não encontrado"}), 404
    game = games[game_id]
    meta = _game_meta(game)
    meta["cheat_used"] = True
    if isinstance(game, dict) and game.get("type") == "multi":
        return jsonify({"correctWords": [w.upper() for w in game["words"]]})
    return jsonify({"correctWord": game.word.upper()})

@app.get("/api/check-word")
def check_word():
    word = request.args.get("word", "").strip().lower()
    lang = request.args.get("lang", "pt").lower()
    
    if len(word) != 5:
        return jsonify({"exists": False, "error": "Palavra deve ter 5 letras"})
    
    if lang == "pt":
        exists = word in portuguese_words
        return jsonify({"exists": exists})
    elif lang == "en":
        exists = word in english_words
        return jsonify({"exists": exists})
    else:
        # Para outros idiomas, assumir que todas as palavras de 5 letras são válidas
        return jsonify({"exists": True})

# Rota para o front-end
@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/duplet")
@app.route("/duet")
@app.route("/quaplet")
@app.route("/classic")
@app.route("/single")
def index_modes():
    # Serve the same SPA for mode-specific paths so direct navigation works
    return app.send_static_file("index.html")

@app.route("/multiplayer")
def multiplayer_page():
    if not session.get("user_id"):
        return redirect("/?auth=multiplayer")
    return app.send_static_file("multiplayer.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)
