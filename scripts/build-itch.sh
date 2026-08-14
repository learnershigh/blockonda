#!/bin/sh
# itch.io 업로드용 zip을 만든다. 실행에 필요한 파일만 담는다.
set -e
cd "$(dirname "$0")/.."
rm -f blockonda-itch.zip
zip -X -q -r blockonda-itch.zip index.html css src assets -x "*.DS_Store"
echo "blockonda-itch.zip"
unzip -l blockonda-itch.zip | tail -3
