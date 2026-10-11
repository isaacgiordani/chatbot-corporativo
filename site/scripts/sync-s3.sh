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
TERRAFORM_DIR="$(cd -- "${SITE_DIR}/../terraform" && pwd)"
DISTRIBUTION_ID="${AWS_CLOUDFRONT_DISTRIBUTION_ID:-}"

if [[ -z "${DISTRIBUTION_ID}" ]]; then
  if ! command -v terraform >/dev/null 2>&1; then
    echo "Terraform não encontrado. Instale-o ou defina AWS_CLOUDFRONT_DISTRIBUTION_ID."
    exit 1
  fi

  if ! DISTRIBUTION_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw cloudfront_distribution_id 2>/dev/null)"; then
    echo "Não foi possível obter cloudfront_distribution_id do state Terraform."
    echo "Inicialize o Terraform ou defina AWS_CLOUDFRONT_DISTRIBUTION_ID."
    exit 1
  fi
fi

if [[ ! "${DISTRIBUTION_ID}" =~ ^[A-Z0-9]+$ ]]; then
  echo "ID da distribuição CloudFront inválido: ${DISTRIBUTION_ID}"
  exit 1
fi

echo "Sincronizando ${DIST_DIR} com s3://${BUCKET}..."
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}"
echo "Sincronização concluída: s3://${BUCKET}"

echo "Invalidando o cache da distribuição CloudFront ${DISTRIBUTION_ID}..."
INVALIDATION="$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output text)"
printf 'Invalidação solicitada (ID e status): %s\n' "${INVALIDATION}"
