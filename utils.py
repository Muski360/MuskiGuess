def format_letter(letter, status):
    from colorama import Fore

    if status == 'gray':
        return f"{Fore.LIGHTBLACK_EX}{letter}{Fore.RESET}"
    elif status == 'yellow':
        return f"{Fore.LIGHTYELLOW_EX}{letter}{Fore.RESET}"
    elif status == 'green':
        return f"{Fore.LIGHTGREEN_EX}{letter}{Fore.RESET}"
    else:
        return letter

def display_feedback(guess, correct_word):
    feedback = []
    for i, letter in enumerate(guess):
        if letter == correct_word[i]:
            feedback.append(format_letter(letter, 'green'))
        elif letter in correct_word:
            feedback.append(format_letter(letter, 'yellow'))
        else:
            feedback.append(format_letter(letter, 'gray'))
    return ' '.join(feedback)