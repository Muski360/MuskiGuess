from collections import Counter
import re
import unicodedata

# Lista de palavras
words = [
       "abaco", "bosta", "monte", "monge", "abate",
    "acima", "acido", "lacre", "porco", "afeto",
    "agora", "ajuda", "marca", "jatos", "aluno",
    "amigo", "anexo", "mijar", "apelo", "nicho",
    "aroma", "atual", "aviao", "banco", "visto",
    "bingo", "bolha", "telha", "bravo", "cacau",
    "raios", "canto", "carro", "casal", "certa",
    "cesto", "cinta", "claro", "cobre", "corte",
    "costa", "cravo", "dente", "dolar", "doido",
    "ducha", "jegue", "festa", "firme", "lindo",
    "gente", "gordo", "grito", "forca", "gelar",
    "hotel", "jogos", "jovem", "lagoa", "kiwis",
    "manga", "manto", "massa", "misto", "moeda",
    "mundo", "norte", "notas", "piano", "pinta",
    "plano", "ponto", "homem", "quero", "rango",
    "sabor", "santo", "sorte", "tampa", "tempo",
    "tigre", "tinta", "torta", "trigo", "vazio",
    "legal", "menta", "local", "trena", "honra",
    "afora", "agudo", "ainda", "areia", "axila",
    "barco", "baixo", "banho", "bazar", "bomba",
    "barro", "busto", "burro", "bossa", "breve",
    "brisa", "cabra", "carga", "clima", "cifra",
    "cerne", "ciclo", "coral", "corpo", "couro",
    "curto", "dorso", "deusa", "dengo", "dardo",
    "dueto", "exato", "exame", "folha", "fruta",
    "fenda", "fugar", "fugir", "fazer", "beber",
    "abrir", "andar", "comer", "dizer", "falar",
    "lutar", "viver", "estar", "gasto", "gabar",
    "galho", "gesto", "girar", "humor", "horto",
    "idoso", "idade", "irado", "itens", "jeito",
    "junco", "joias", "kilos", "carma", "livro",
    "lugar", "lento", "largo", "luzes", "moral",
    "morte", "media", "minha", "molho", "metro",
    "ninar", "navio", "noite", "natal", "nobre",
    "ninja", "otimo", "opaco", "outro", "pegar",
    "pular", "prato", "preto", "penca", "quase",
    "raiva", "risco", "rural", "remar", "repor",
    "ramal", "sinal", "salto", "senso", "sobra",
    "suave", "samba", "tarde", "tocha", "tarja",
    "trono", "vento", "tocar", "usado", "unido",
    "urgir", "vagar", "velho", "veloz", "pirar",
    "cenho", "zebra", "zarpa", "zumba", "junta",
    "otima", "pardo", "rolar", "temer", "mimar",
    "sagaz", "limpo", "termo", "negro", "exito", 
    "mexer", "etica", "algoz", "plena", "tenue",
    "mutua", "sobre", "aquem", "visar", "poder", 
    "vigor", "sutil", "porem", "ideia", "sanar",
    "audaz", "inato", "desde", "muito", "justo", 
    "sonho", "torpe", "razao", "icone", "quilo",
    "etnia", "futil", "haver", "lapso", "entao", 
    "expor", "bocal", "retro", "habil", "saber",
    "mutuo", "graca", "xibiu", "obice", "obito", 
    "ardil", "pesar", "dever", "causa", "tenaz",
    "brado", "vetor", "crivo", "temor", "coser", 
    "genro", "comum", "apice", "posse", "prole",
    "animo", "assar", "ceder", "volta", "pauta", 
    "fugaz", "ansia", "culto", "atroz", "digno",
    "vulgo", "vicio", "gleba", "saude", "criar", 
    "fonte", "todos", "reves", "pudor", "dogma",
    "denso", "nenem", "louco", "atras", "regra", 
    "ordem", "limbo", "pedir", "clava", "feliz",
    "impor", "usura", "banal", "juizo", "levar", 
    "olhar", "tomar", "visao", "genio", "ouvir",
    "caldo", "clara", "trair", "balde", "prova",
    "acaso", "adeus", "afiar", "amplo", "antes", 
    "apito", "arcar", "ardor", "arroz", "astro", 
    "balsa", "bater", "bicho", "bolar", "botar", 
    "brava", "brejo", "bruto", "caber", "cacho", 
    "caixa", "calar", "canal", "carne", "cerca", 
    "cesta", "citar", "civil", "colar", "copia", 
    "coxas", "cocar", "croca", "curar", "dados", 
    "danar", "dedos", "dores", "drama", "densa", 
    "errar", "etapa", "falha", "ferir", "feroz", 
    "ferro", "ficar", "pinha", "arara", "fixar", 
    "focar", "forno", "ganho", "garra", "golpe", 
    "grato", "grave", "guiar", "haste", "horda", 
    "imune", "laudo", "lavar", "leito", "ligar", 
    "linha", "livre", "lixar", "lucro", "magro", 
    "meigo", "meter", "mirar", "molar", "morar", 
    "mover", "nasce", "nuvem", "odiar", "optar", 
    "ornar", "outra", "parar", "passe", "peixe", 
    "peido", "perna", "perto", "pinto", "pisar", 
    "pleno", "podar", "puxar", "regar", "rente", 
    "riram", "rival", "rolha", "rosto", "roubo", 
    "rufar", "ruido", "sacar", "salve", "selar", 
    "sirva", "somar", "sonar", "sopra", "sopro", 
    "sugar", "sumir", "talar", "tenso", "terno", 
    "torso", "turma", "turvo", "janta", "valer", 
    "vasto", "vazar", "vedar", "velar", "venda", 
    "vivar", "vocal", "voltar", "zelar", "zunir", 
    "aguar", "algar", "alcar", "ameno", "amuar", 
    "arduo", "arfar", "aviar", "azedo", "babar", 
    "bafar", "balar", "banir", "bicar", "bocar", 
    "bufar", "cavar", "cegar", "chato", "circo", 
    "coado", "cozer", "cruel", "galos", "curva", 
    "datar", "depor", "ditar", "dobar", "donos", 
    "praga", "duros", "ecoar", "feder", "feiar", 
    "fitar", "fluir", "furar", "gerar", "golar", 
    "jarro", "leigo", "mamar", "manar", "manso", 
    "matar", "mofar", "nadar", "nevoa", "notar", 
    "picar", "pobre", "rosae", "rosar", "rouca", 
    "sabio", "safar", "sopar", "tirar", "torar", 
    "toser", "verde"
]

# Normaliza e limpa a lista
words_clean = [w.strip().lower() for w in words if w.strip()]

# 1️⃣ Verificar palavras repetidas
contagem = Counter(words_clean)
repetidas = [palavra for palavra, qtd in contagem.items() if qtd > 1]

# 2️⃣ Verificar palavras com acento ou caractere especial
def tem_caractere_especial(palavra):
    # Se tiver algo fora de a-z
    return bool(re.search(r'[^a-z]', unicodedata.normalize('NFD', palavra).encode('ascii', 'ignore').decode('utf-8')))

com_acentos = [p for p in words_clean if re.search(r'[çáàãâéèêíìîóòõôúùû]', p)]

# 3️⃣ Verificar palavras com tamanho diferente de 5 letras
tamanho_errado = [p for p in words_clean if len(p) != 5]

# 🔹 Mostrar resultados
print("="*40)
print("📋 RELATÓRIO DE VERIFICAÇÃO")
print("="*40)

if repetidas:
    print(f"🔁 Palavras repetidas ({len(repetidas)}):")
    print(", ".join(sorted(repetidas)))
else:
    print("✅ Nenhuma palavra repetida encontrada.")

print("\n" + "-"*40)

if com_acentos:
    print(f"⚠️ Palavras com acento ou caractere especial ({len(com_acentos)}):")
    print(", ".join(sorted(set(com_acentos))))
else:
    print("✅ Nenhuma palavra com acento/caractere especial.")

print("\n" + "-"*40)

if tamanho_errado:
    print(f"🔢 Palavras com tamanho diferente de 5 letras ({len(tamanho_errado)}):")
    print(", ".join(sorted(set(tamanho_errado))))
else:
    print("✅ Todas as palavras têm 5 letras.")

print("="*40)
