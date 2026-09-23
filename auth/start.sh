#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${TRACKER_ORIGIN:=http://127.0.0.1:8090}"
export TRACKER_ORIGIN
case "$TRACKER_ORIGIN" in
  http://127.0.0.1:*|http://localhost:*) ;;
  https://*) ;;
  *) echo 'TRACKER_ORIGIN 必须是 HTTPS 地址，本机预览可使用 http://127.0.0.1:端口' >&2; exit 1 ;;
esac
if [ ! -x bin/pocketbase ]; then
  echo '请先运行 python3 auth/install.py 安装 PocketBase。' >&2
  exit 1
fi
python3 build.py
exec bin/pocketbase serve --http="${TRACKER_LISTEN:-127.0.0.1:8090}" \
  --dir=pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations \
  --publicDir=site --indexFallback=false --automigrate=false --hooksWatch=false \
  --origins="$TRACKER_ORIGIN"
