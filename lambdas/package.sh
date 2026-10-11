#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if ! command -v zip >/dev/null 2>&1; then
  echo "O comando 'zip' não foi encontrado. Instale o utilitário zip e tente novamente." >&2
  exit 1
fi

npm run build

for function_name in authorizer connect disconnect message-persist message-processor; do
  zip_path="dist/${function_name}.zip"
  rm -f "${zip_path}"
  (
    cd "dist/${function_name}"
    zip -q -j "../${function_name}.zip" index.js
  )
  echo "Pacote criado: ${SCRIPT_DIR}/${zip_path}"
done
