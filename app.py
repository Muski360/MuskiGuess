from flask import Flask, jsonify, request

from termo import Termo
from words import get_random_word
import os

app = Flask(__name__, static_folder="static", template_folder="static")

games = {}
next_game_id = 1

# Carregar palavras portuguesas
portuguese_words = set()
try:
    with open('palavras_5letras.txt', 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if len(word) == 5:
                portuguese_words.add(word)
    print(f"Carregadas {len(portuguese_words)} palavras portuguesas")
except FileNotFoundError:
    print("Arquivo palavras_5letras.txt não encontrado")
except Exception as e:
    print(f"Erro ao carregar palavras portuguesas: {e}")

# Carregar palavras inglesas
english_words = set()
try:
    with open('words_5letters.txt', 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if len(word) == 5:
                english_words.add(word)
    print(f"Carregadas {len(english_words)} palavras inglesas")
except FileNotFoundError:
    print("Arquivo words_5letters.txt não encontrado")
except Exception as e:
    print(f"Erro ao carregar palavras inglesas: {e}")

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


@app.post("/api/new-game")
def new_game():
    global next_game_id
    data = request.get_json(silent=True) or {}
    lang = (data.get("lang") or 'pt').lower()
    mode = (data.get("mode") or 'single').lower()
    word_count = int(data.get("wordCount") or (1 if mode == 'single' else 2))
    # default attempts: 6 for single, 7 for multi
    max_attempts = int(data.get("maxAttempts") or (6 if word_count == 1 else 7))

    game_id = str(next_game_id)
    next_game_id += 1

    if word_count == 1:
        # Keep existing Termo behavior for backward compatibility
        word = get_random_word(lang)
        game = Termo(word)
        game.max_attempts = max_attempts
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
    return jsonify(response)

@app.get("/api/peek")
def peek_correct_word():
    game_id = request.args.get("gameId", type=str)
    if not game_id or game_id not in games:
        return jsonify({"error": "Jogo não encontrado"}), 404
    game = games[game_id]
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
