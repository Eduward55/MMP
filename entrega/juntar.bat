@echo off
cd /d "%~dp0"
copy /b MyMusicPlace-Windows.zip.00 + MyMusicPlace-Windows.zip.01 + MyMusicPlace-Windows.zip.02 MyMusicPlace-Windows.zip
echo Pronto: %cd%\MyMusicPlace-Windows.zip
pause
