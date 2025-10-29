from collections import Counter
import re
import unicodedata

# Lista de palavras
words = [
    "abaco", "bosta", "monte", "monge", "abate", "acima", "acido", "lacre", "porco", "afeto",
    "agora", "ajuda", "marca", "jatos", "aluno", "amigo", "anexo", "mijar", "apelo", "nicho",
    "aroma", "atual", "aviao", "banco", "visto", "bingo", "bolha", "telha", "bravo", "cacau",
    "raios", "canto", "carro", "casal", "certa", "cesto", "cinta", "claro", "cobre", "corte",
    "costa", "cravo", "dente", "dolar", "doido", "ducha", "jegue", "festa", "firme", "lindo",
    "gente", "gordo", "grito", "forca", "gelar", "hotel", "jogos", "jovem", "lagoa", "kiwis",
    "manga", "manto", "massa", "misto", "moeda", "mundo", "norte", "notas", "piano", "pinta",
    "plano", "ponto", "homem", "quero", "rango", "sabor", "santo", "sorte", "tampa", "tempo",
    "tigre", "tinta", "torta", "trigo", "vazio", "legal", "menta", "local", "trena", "honra",
    "afora", "agudo", "ainda", "areia", "axila", "barco", "baixo", "banho", "bazar", "bomba",
    "barro", "busto", "burro", "bossa", "breve", "brisa", "cabra", "carga", "clima", "cifra",
    "cerne", "ciclo", "coral", "corpo", "couro", "curto", "dorso", "deusa", "dengo", "dardo",
    "dueto", "exato", "exame", "folha", "fruta", "fenda", "fugar", "fugir", "fazer", "beber",
    "abrir", "andar", "comer", "dizer", "falar", "lutar", "viver", "estar", "gasto", "gabar",
    "galho", "gesto", "girar", "humor", "horto", "idoso", "idade", "irado", "itens", "jeito",
    "junco", "joias", "kilos", "carma", "livro", "lugar", "lento", "largo", "luzes", "moral",
    "morte", "media", "minha", "molho", "metro", "ninar", "navio", "noite", "natal", "nobre",
    "ninja", "otimo", "opaco", "outro", "pegar", "pular", "prato", "preto", "penca", "quase",
    "raiva", "risco", "rural", "remar", "repor", "ramal", "sinal", "salto", "senso", "sobra",
    "suave", "samba", "tarde", "tocha", "tarja", "trono", "vento", "tocar", "usado", "unido",
    "urgir", "vagar", "velho", "veloz", "pirar", "cenho", "zebra", "zarpa", "zumba", "junta",
    "otima", "pardo", "rolar", "temer", "mimar", "sagaz", "limpo", "termo", "negro", "exito",
    "mexer", "etica", "algoz", "plena", "tenue", "mutua", "sobre", "aquem", "visar", "poder",
    "vigor", "sutil", "porem", "ideia", "sanar", "audaz", "inato", "desde", "muito", "justo",
    "sonho", "torpe", "razao", "icone", "quilo", "etnia", "futil", "haver", "lapso", "entao",
    "expor", "bocal", "retro", "habil", "saber", "mutuo", "graca", "xibiu", "obice", "obito",
    "ardil", "pesar", "dever", "causa", "tenaz", "brado", "vetor", "crivo", "temor", "coser",
    "genro", "comum", "apice", "posse", "prole", "animo", "assar", "ceder", "volta", "pauta",
    "medos", "ansia", "culto", "atroz", "digno", "vulgo", "vicio", "gleba", "saude", "criar",
    "fonte", "todos", "reves", "pudor", "dogma", "denso", "nenem", "louco", "atras", "regra",
    "ordem", "limbo", "pedir", "clava", "feliz", "impor", "usura", "banal", "juizo", "levar",
    "olhar", "tomar", "visao", "genio", "ouvir", "caldo", "clara", "trair", "balde", "prova",
    "acaso", "adeus", "afiar", "amplo", "antes", "apito", "arcar", "ardor", "arroz", "astro",
    "balsa", "bater", "bicho", "bolar", "botar", "brava", "brejo", "bruto", "caber", "cacho",
    "caixa", "calar", "canal", "carne", "cerca", "cesta", "citar", "civil", "colar", "copia",
    "coxas", "cocar", "croca", "curar", "dados", "danar", "dedos", "dores", "drama", "densa",
    "errar", "etapa", "falha", "ferir", "feroz", "ferro", "ficar", "pinha", "arara", "fixar",
    "focar", "forno", "ganho", "garra", "golpe", "grato", "grave", "guiar", "haste", "horda",
    "imune", "laudo", "lavar", "leito", "ligar", "linha", "livre", "lixar", "lucro", "magro",
    "meigo", "meter", "mirar", "molar", "morar", "mover", "nasce", "nuvem", "odiar", "optar",
    "ornar", "outra", "parar", "passe", "peixe", "peido", "perna", "perto", "pinto", "pisar",
    "pleno", "podar", "puxar", "regar", "rente", "riram", "rival", "rolha", "rosto", "roubo",
    "rufar", "ruido", "sacar", "salve", "selar", "sirva", "somar", "sonar", "sopra", "sopro",
    "sugar", "sumir", "talar", "tenso", "terno", "torso", "turma", "turvo", "janta", "valer",
    "vasto", "vazar", "vedar", "velar", "venda", "vivar", "vocal", "robos", "zelar", "zunir",
    "aguar", "algar", "alcar", "ameno", "amuar", "arduo", "arfar", "aviar", "azedo", "babar",
    "bafar", "balar", "banir", "bicar", "bocar", "bufar", "cavar", "cegar", "chato", "circo",
    "coado", "cozer", "cruel", "galos", "curva", "datar", "depor", "ditar", "dobar", "donos",
    "praga", "duros", "ecoar", "feder", "feiar", "fitar", "fluir", "furar", "gerar", "golar",
    "jarro", "rifar", "mamar", "manar", "manso", "matar", "mofar", "nadar", "nevoa", "notar",
    "picar", "pobre", "rosea", "rosar", "rouca", "sabio", "safar", "sopar", "tirar", "torar",
    "tosar", "verde", "motor", "amora", "ptose", "polar", "cagar", "mitos", "fitas", "mudar",
    "mudas", "aulas", "aviso", "azias", "bicos", "baila", "borda", "busca", "capuz", "calmo",
    "campo", "urina", "chave", "chuva", "cobra", "cofre", "couve", "danos", "droga", "durar",
    "eixos", "farol", "feira", "filho", "filha", "filme", "flora", "fauna", "finta", "fones",
    "fusao", "fugaz", "ganso", "giria", "morro", "grilo", "heroi", "hiato", "juros", "lanca",
    "latir", "lacos", "leigo", "lepra", "lesar", "licao", "medir", "meias", "melao", "micos",
    "obeso", "oncas", "oleos", "pacto", "padre", "papel", "pausa", "pelos", "peita", "pinga",
    "posar", "praca", "prima", "queda", "rasgo", "reter", "saldo", "senha", "surto", "tacar"
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

# ===== Relatório (opcional) =====
print("="*40)
print("📋 RELATÓRIO DE VERIFICAÇÃO")
print("="*40)
print(f"🔁 Repetidas removidas ({len(repetidas)}):", ", ".join(sorted(repetidas)) or "nenhuma")
print("⚠️ Com acento/especial:", ", ".join(sorted(set(com_acentos))) or "nenhuma")
print("🔢 Tamanho != 5:", ", ".join(sorted(set(tamanho_errado))) or "nenhuma")
print("="*40)

# ===== Saída formatada como lista Python =====
print("\nEntradas = [")
for i in range(0, len(words_unicas), 10):
    bloco = ", ".join(f'"{w}"' for w in words_unicas[i:i+10])
    # adiciona vírgula no final da linha SE não for o último bloco
    is_last_block = (i + 10) >= len(words_unicas)
    linha = f"    {bloco}" + ("," if not is_last_block else "")
    print(linha)
print("]")

tamanho_original = len(words)
print(f"\n\nTamanho da lista original: {tamanho_original}")
tamanho_semrepetidas = (tamanho_original - len(repetidas))
print(f"\nTamanho da lista sem repetidas: {tamanho_semrepetidas}")
