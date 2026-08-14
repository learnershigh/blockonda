#!/bin/sh
# itch.io 업로드용 zip을 만든다. 실행에 필요한 파일만 담는다.
set -e
cd "$(dirname "$0")/.."
rm -f tetris-itch.zip
zip -X -q -r tetris-itch.zip index.html css src assets -x "*.DS_Store"
echo "tetris-itch.zip"
unzip -l tetris-itch.zip | tail -3
