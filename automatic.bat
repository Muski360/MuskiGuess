@echo off
cd /d "%~dp0"
echo Ativando ambiente virtual...
echo Iniciando servidor Flask...
start "" http://localhost:5000
python app.py
pause
