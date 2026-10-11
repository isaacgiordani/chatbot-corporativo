#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ACCOUNT_ID="${1:-}"
ENVIRONMENT="${2:-}"

if [[ ! "${ACCOUNT_ID}" =~ ^[0-9]{12}$ ]]; then
  echo "Uso: $0 <AccountId> <env>"
  echo "Exemplo: $0 651644924182 dev"
  exit 2
fi

if [[ ! "${ENVIRONMENT}" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "O ambiente deve conter apenas letras minúsculas, números e hífens."
  echo "Exemplo: $0 651644924182 dev"
  exit 2
fi

DIST_DIR="${SITE_DIR}/dist"
if [[ ! -d "${DIST_DIR}" ]]; then
  echo "Diretório ${DIST_DIR} não encontrado. Gere o build antes: cd site && npm run build"
  exit 1
fi

BUCKET="${ACCOUNT_ID}-${ENVIRONMENT}-chatbot-corporativo-s3"

echo "Sincronizando ${DIST_DIR} com s3://${BUCKET}..."
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}"
echo "Sincronização concluída: s3://${BUCKET}"
