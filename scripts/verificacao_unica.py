from collections import Counter
from pathlib import Path
import re
import unicodedata

# ==============================
# 🔠 LISTA DE PALAVRAS A TESTAR
# ==============================
words = [
    "apple", "trade", "chair", "house", "water", "blaze", "doors", "happy", "green", "smile",
    "light", "trial", "tiger", "pizza", "beach", "cloud", "dance", "drink", "fruit", "games",
    "birch", "troop", "stone", "heart", "above", "blind", "stars", "sleep", "dream", "money",
    "blink", "smell", "clean", "sweet", "angel", "watch", "story", "snake", "truck", "bunny",
    "clear", "shirt", "pants", "shoes", "brown", "black", "white", "lemon", "honey", "chess",
    "climb", "pearl", "bread", "flame", "candy", "minor", "drain", "rainy", "storm", "adapt",
    "field", "grass", "river", "table", "below", "couch", "phone", "mouse", "towel", "clock",
    "plant", "piano", "teeth", "socks", "skirt", "movie", "block", "learn", "paint", "skies",
    "title", "think", "stand", "laugh", "touch", "today", "spoon", "plate", "quest", "slash",
    "brush", "music", "arise", "flour", "start", "torch", "zebra", "eagle", "sheep", "goose",
    "horse", "kitty", "puppy", "queue", "slimy", "grape", "peach", "sneak", "berry", "melon",
    "onion", "toast", "sugar", "juice", "cream", "paper", "books", "penal", "queen", "under",
    "toxic", "motel", "angry", "tired", "quiet", "ready", "sunny", "recap", "proof", "windy",
    "north", "south", "rogue", "gross", "waste", "ocean", "world", "earth", "space", "witch",
    "hello", "peace", "magic", "brain", "video", "check", "words", "lines", "piece", "shape",
    "share", "thing", "sound", "logic", "quick", "break", "crack", "place", "write", "speak",
    "beard", "chase", "cross", "taste", "flare", "split", "study", "brave", "loose", "tight",
    "grace", "grind", "spice", "cider", "cabin", "camel", "cater", "crown", "draft", "final",
    "focus", "force", "front", "giant", "glove", "grain", "group", "guide", "guest", "human",
    "image", "judge", "month", "never", "night", "noise", "point", "press", "raise", "reach",
    "reply", "score", "serve", "short", "small", "stage", "teach", "thank", "total", "truth",
    "value", "voice", "whole", "young", "after", "other", "which", "their", "there", "first",
    "would", "these", "click", "price", "state", "email", "items", "hotel", "store", "terms",
    "right", "local", "forum", "based", "index", "being", "women", "pages", "found", "photo",
    "agree", "alert", "align", "allow", "apron", "beast", "blend", "bliss", "bloom", "brisk",
    "charm", "claim", "clerk", "close", "craft", "crane", "crash", "creek", "crisp", "curve",
    "diner", "drive", "dwarf", "faith", "fancy", "flood", "frame", "frost", "ghost", "glass",
    "glory", "great", "hobby", "leads", "liver", "lodge", "lucky", "lunch", "mango", "meant",
    "mimic", "mount", "noble", "novel", "nurse", "oasis", "olive", "order", "party", "pilot",
    "pound", "quote", "rapid", "raven", "rider", "rough", "round", "route", "rugby", "rural",
    "saint", "scale", "shift", "shine", "shock", "smart", "smoke", "solar", "sport", "steel",
    "super", "sweat", "tough", "tower", "track", "train", "treat", "upper", "vapor", "vital",
    "vivid", "whale", "wheel", "whirl", "wings", "witty", "yield", "acorn", "admit", "adopt",
    "adore", "ahead", "alarm", "amber", "amend", "amuse", "anger", "apart", "arena", "argue",
    "ashes", "asset", "attic", "award", "bacon", "badge", "bagel", "baker", "baldy", "banjo",
    "basil", "basin", "batch", "beech", "beefy", "birth", "blast", "bleed", "blond", "blues",
    "board", "boost", "bound", "broad", "broom", "buddy", "buggy", "built", "bunch", "burns",
    "burst", "bushy", "buyer", "belly", "bench", "cable", "canal", "carve", "catch", "cease",
    "chili", "choir", "choke", "civic", "clash", "cling", "clown", "coach", "coast", "coral",
    "craze", "bingo", "drama", "creep", "crime", "cubic", "curse", "cycle", "daddy", "daily",
    "daisy", "dealt", "debut", "delay", "delta", "demon", "drawn", "dread", "dress", "drift",
    "drill", "drove", "dusty", "eager", "early", "elbow", "elite", "empty", "enjoy", "entry",
    "equal", "error", "event", "every", "armor", "array", "exact", "exist", "extra", "fable",
    "faint", "fairy", "false", "fatal", "favor", "feast", "fence", "fetch", "fiber", "fifth",
    "fifty", "fight", "arrow", "groan", "flock", "flora", "flush", "flute", "forth", "fresh",
    "funny", "given", "glare", "grant", "graph", "greed", "grill", "imply", "inner", "input",
    "guard", "guess", "habit", "handy", "harsh", "haste", "hatch", "haunt", "heavy", "hinge",
    "honor", "hover", "humor", "ideal", "irony", "issue", "jelly", "jolly", "karma", "kneel",
    "knife", "label", "labor", "large", "laser", "later", "layer", "leash", "level", "limit",
    "linen", "loyal", "lunar", "lyric", "maker", "maple", "march", "match", "mayor", "medal",
    "mercy", "metal", "might", "model", "moral", "mossy", "motor", "mover", "naked", "nerve",
    "newly", "ninth", "nylon", "offer", "opera", "orbit", "organ", "otter", "outer", "owner",
    "panda", "panel", "panic", "paste", "patch", "pause", "pedal", "penny", "perch", "phase",
    "pitch", "plain", "plead", "plush", "polar", "porch", "pride", "prime", "print", "prize",
    "probe", "proud", "punch", "radio", "ranch", "range", "realm", "rebel", "refer", "relax",
    "ridge", "risky", "rival", "robot", "ruler", "sable", "sauce", "scene", "scout", "screw",
    "sense", "shade", "shaft", "shake", "shame", "sharp", "shelf", "shoot", "shore", "shout",
    "silly", "skill", "slice", "slide", "slope", "snack", "solid", "spark", "spend", "spine",
    "spite", "spray", "squad", "stack", "stain", "stark", "steam", "stick", "stiff", "still",
    "stony", "strap", "straw", "strip", "stuck", "stuff", "swear", "swing", "sword", "tango",
    "tease", "theme", "thick", "third", "thorn", "those", "three", "threw", "throw", "token",
    "tonic", "topic", "trace", "trail", "trend", "tribe", "trick", "truly", "trunk", "tulip",
    "tuned", "twice", "uncle", "unite", "urban", "usage", "verse", "voter", "wagon", "weary",
    "weird", "wheat", "where", "while", "woman", "worry", "wound", "wreck", "wrong", "youth",
    "zones", "disco", "donor"
]

# Normaliza e limpa a lista
words_clean = [w.strip().lower() for w in words if w.strip()]

# Remove duplicadas mantendo a ordem
words_unicas = list(dict.fromkeys(words_clean))

# 1️⃣ Verificar palavras repetidas (antes da remoção)
contagem = Counter(words_clean)
repetidas = [palavra for palavra, qtd in contagem.items() if qtd > 1]

# 2️⃣ Palavras com acento/caractere especial
def tem_caractere_especial(palavra):
    return bool(re.search(r'[^a-z]', unicodedata.normalize('NFD', palavra)
                          .encode('ascii', 'ignore').decode('utf-8')))

com_acentos = [p for p in words_unicas if re.search(r'[çáàãâéèêíìîóòõôúùû]', p)]

# 3️⃣ Tamanho diferente de 5
tamanho_errado = [p for p in words_unicas if len(p) != 5]

# Remove automaticamente as palavras com tamanho != 5
words_filtradas = [p for p in words_unicas if len(p) == 5]

# ==============================
# 📚 VERIFICAÇÃO NO DICIONÁRIO
# ==============================
BASE_DIR = Path(__file__).resolve().parent.parent / "Backend" / "data"
file_path = BASE_DIR / "words_5letters.txt"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        dictionary_words = {line.strip().lower() for line in f if line.strip()}
except FileNotFoundError:
    print(f"Arquivo não encontrado: {file_path}")
    exit()

nao_encontradas = [w for w in words_filtradas if w not in dictionary_words]
encontradas = [w for w in words_filtradas if w in dictionary_words]

# ==============================
# 📋 RELATÓRIO FINAL
# ==============================
print("="*50)
print("📋 RELATÓRIO DE VERIFICAÇÃO COMPLETO")
print("="*50)
print(f"🔁 Repetidas removidas ({len(repetidas)}):", ", ".join(sorted(repetidas)) or "nenhuma")
print("⚠️ Com acento/especial:", ", ".join(sorted(set(com_acentos))) or "nenhuma")
print("🔢 Tamanho != 5:", ", ".join(sorted(set(tamanho_errado))) or "nenhuma")
print("❌ Não encontradas no dicionário:", ", ".join(sorted(nao_encontradas)) or "nenhuma")
print("="*50)

# ===== Saída formatada como lista Python =====
print("\nEntradas válidas (filtradas e existentes): [")
for i in range(0, len(encontradas), 10):
    bloco = ", ".join(f'"{w}"' for w in encontradas[i:i+10])
    is_last_block = (i + 10) >= len(encontradas)
    linha = f"    {bloco}" + ("," if not is_last_block else "")
    print(linha)
print("]")

# Estatísticas
print(f"\nTamanho original: {len(words)}")
print(f"Tamanho após filtro: {len(words_filtradas)}")
print(f"Tamanho após verificação no dicionário: {len(encontradas)}")
print("="*50)
