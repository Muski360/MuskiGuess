from colorama import Fore, Style

class Termo:
    def __init__(self, word):
        self.word = word
        self.attempts = 0
        self.max_attempts = 6
        self.won = False

    def is_valid_guess(self, guess):
        return len(guess) == 5 and guess.isalpha()

    def check_guess(self, guess):
        self.attempts += 1
        feedback = []
        word_chars = list(self.word)
        guess_chars = list(guess)
        word_used = [False] * 5
        guess_used = [False] * 5

        # Primeiro: verde (letra e posição correta)
        for i in range(5):
            if guess_chars[i] == word_chars[i]:
                feedback.append(Fore.GREEN + guess_chars[i].upper() + Style.RESET_ALL)
                word_used[i] = True
                guess_used[i] = True
            else:
                feedback.append(None)

        # Segundo: amarelo (letra correta, posição errada)
        for i in range(5):
            if feedback[i] is None:
                found = False
                for j in range(5):
                    if not word_used[j] and guess_chars[i] == word_chars[j]:
                        found = True
                        word_used[j] = True
                        break
                if found:
                    feedback[i] = Fore.YELLOW + guess_chars[i].upper() + Style.RESET_ALL
                else:
                    feedback[i] = Fore.LIGHTBLACK_EX + guess_chars[i].upper() + Style.RESET_ALL

        if guess == self.word:
            self.won = True
        return "".join(feedback)

    def check_guess_statuses(self, guess):
        """Retorna uma lista de dicionários com letra (maiúscula) e status
        para cada posição do palpite: 'green' | 'yellow' | 'gray'.
        Não inclui códigos de cor e é adequada para UI web.
        """
        self.attempts += 1
        statuses = [None] * 5
        letters = [c.upper() for c in guess]
        word_chars = list(self.word)
        guess_chars = list(guess)
        word_used = [False] * 5
        # Primeiro: verdes
        for i in range(5):
            if guess_chars[i] == word_chars[i]:
                statuses[i] = 'green'
                word_used[i] = True
        # Segundo: amarelos e cinzas
        for i in range(5):
            if statuses[i] is None:
                found = False
                for j in range(5):
                    if not word_used[j] and guess_chars[i] == word_chars[j]:
                        found = True
                        word_used[j] = True
                        break
                statuses[i] = 'yellow' if found else 'gray'
        if guess == self.word:
            self.won = True
        return [{"letter": letters[i], "status": statuses[i]} for i in range(5)]

    def is_game_over(self):
        return self.attempts >= self.max_attempts or self.won

    def is_winner(self):
        return self.won