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

@app.post("/api/new-game")
def new_game():
    global next_game_id
    data = request.get_json(silent=True) or {}
    lang = (data.get("lang") or 'pt').lower()
    word = get_random_word(lang)
    game = Termo(word)
    game_id = str(next_game_id)
    next_game_id += 1
    games[game_id] = game
    return jsonify({"gameId": game_id, "maxAttempts": game.max_attempts, "lang": lang})

@app.post("/api/guess")
def make_guess():
    data = request.get_json(silent=True) or {}
    game_id = data.get("gameId")
    guess = (data.get("guess") or "").strip().lower()
    if not game_id or game_id not in games:
        return jsonify({"error": "Jogo não encontrado"}), 404
    game = games[game_id]
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
