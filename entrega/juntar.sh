#!/bin/sh
cd "$(dirname "$0")"
cat MyMusicPlace-Windows.zip.* > MyMusicPlace-Windows.zip
echo "Pronto: $(pwd)/MyMusicPlace-Windows.zip"
