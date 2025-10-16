# MuskiGuess - Versão Web (Flask + HTML/JS)

## Como executar (Windows / PowerShell)

1. Entre na pasta do projeto:
```powershell
cd termo\termo-game\src
```

2. (Opcional) Crie e ative um ambiente virtual:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Instale as dependências:
```powershell
pip install -r requirements.txt
```

4. Execute o servidor:
```powershell
python app.py
```

5. Acesse no navegador:
- `http://localhost:5000/`

## Endpoints
- `POST /api/new-game` → cria um novo jogo e retorna `gameId`
- `POST /api/guess` → body: `{ gameId, guess }` retorna feedback por letra, tentativas e estado

## Manter CLI
O arquivo `main.py` continua funcionando para jogar no terminal. Para usar:
```powershell
python main.py
```
