@echo off
cd /d "%~dp0"
echo Ayni Wi-Fi icin asagidaki IP adresini diger oyunculara verin.
node assets/lan-server.cjs
pause
