from flask import Flask, jsonify, request

from termo import Termo
from words import get_random_word
import os

app = Flask(__name__, static_folder="static", template_folder="static")

games = {}
next_game_id = 1

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

# Rota para o front-end
@app.route("/")
def index():
    return app.send_static_file("index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
