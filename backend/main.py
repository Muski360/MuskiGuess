# filepath: termo-game/src/main.py
import os
import random
from termo import Termo
from words import get_random_word
from colorama import init
init(autoreset=True)

def main():
    os.system("cls")
    print("Bem-vindo ao MuskiGuess!")
    
    word_to_guess = get_random_word()
    game = Termo(word_to_guess)
    
    while not game.is_game_over():
        guess = input("Digite sua tentativa (5 letras): ").strip().lower()
        
        if not game.is_valid_guess(guess):
            print("Tentativa inválida. Por favor, insira uma palavra de 5 letras.")
            continue
        
        feedback = game.check_guess(guess)
        print(feedback)
        
        if game.is_winner():
            print("Parabéns! Você adivinhou a palavra!")
            break
    else:
        print(f"A palavra era: {word_to_guess}")

if __name__ == "__main__":
    main()