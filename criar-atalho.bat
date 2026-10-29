@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0criar-atalho.ps1"
echo.
echo Atalho "Cedro Pagamentos" criado na Area de Trabalho e no Menu Iniciar.
echo Para fixar: abra o Menu Iniciar, procure "Cedro Pagamentos",
echo clique com o botao direito e escolha "Fixar em Iniciar" ou "Fixar na barra de tarefas".
echo.
pause
