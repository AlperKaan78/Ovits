@echo off
rem Mor Sarmasik 3D: yerel sunucuyu baslatir ve oyunu tarayicida acar. Kurulum gerekmez.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\sunucu.ps1" -Port 4180 -Open oyun.html
