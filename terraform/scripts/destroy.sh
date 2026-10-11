#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$TERRAFORM_DIR"

ENVIRONMENT="dev"
VARIABLES_FILE="${ENVIRONMENT}.tfvars"
BACKEND_FILE="${ENVIRONMENT}.backend.hcl"
PLAN_FILE="destroy-${ENVIRONMENT}.tfplan"
current_step="inicialização"

trap 'status=$?; printf "\nERRO na etapa: %s (código %s)\n" "$current_step" "$status" >&2; exit "$status"' ERR

run_step() {
  local number="$1"
  local label="$2"
  shift 2

  current_step="$number $label"
  printf '\n[%s] %s\n' "$number" "$label"
  printf '  $'
  printf ' %q' "$@"
  printf '\n'
  "$@"
  printf 'Concluído: %s\n' "$label"
}

for command_name in terraform aws; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERRO: comando obrigatório não encontrado: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ ! -f "$VARIABLES_FILE" || ! -f "$BACKEND_FILE" ]]; then
  printf 'ERRO: arquivos %s e/ou %s não encontrados em %s\n' \
    "$VARIABLES_FILE" "$BACKEND_FILE" "$TERRAFORM_DIR" >&2
  exit 1
fi

EXPECTED_ACCOUNT_ID="$(awk -F= '$1 ~ /^[[:space:]]*AccountId[[:space:]]*$/ { gsub(/[[:space:]\"]/, "", $2); print $2; exit }' "$VARIABLES_FILE")"
if [[ ! "$EXPECTED_ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
  printf 'ERRO: AccountId inválido ou ausente em %s\n' "$VARIABLES_FILE" >&2
  exit 1
fi

run_step "1/5" "Inicializar backend remoto do ambiente ${ENVIRONMENT}" \
  terraform init -backend-config="$BACKEND_FILE"

current_step="2/5 Verificar conta AWS"
printf '\n[%s] %s\n' "2/5" "Verificar conta AWS"
CALLER_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
printf 'Conta autenticada: %s\n' "$CALLER_ACCOUNT_ID"
if [[ "$CALLER_ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]]; then
  printf 'ERRO: esperado AccountId %s, mas as credenciais apontam para %s.\n' \
    "$EXPECTED_ACCOUNT_ID" "$CALLER_ACCOUNT_ID" >&2
  exit 1
fi
printf 'Concluído: identidade AWS corresponde ao ambiente.\n'

current_step="3/5 Verificar workspace e recursos gerenciados"
WORKSPACE="$(terraform workspace show)"
if [[ "$WORKSPACE" != "default" ]]; then
  printf 'ERRO: workspace Terraform atual é "%s"; este script opera apenas no workspace default.\n' \
    "$WORKSPACE" >&2
  exit 1
fi
STATE_RESOURCES="$(terraform state list)"
if [[ -z "$STATE_RESOURCES" ]]; then
  printf '\nO state remoto não contém recursos gerenciados. Nada para destruir.\n'
  exit 0
fi
SITE_BUCKET="$(terraform output -raw site_bucket_name)"
EXPECTED_SITE_BUCKET="${EXPECTED_ACCOUNT_ID}-${ENVIRONMENT}-chatbot-corporativo-s3"
if [[ "$SITE_BUCKET" != "$EXPECTED_SITE_BUCKET" ]]; then
  printf 'ERRO: bucket no output (%s) difere do esperado (%s).\n' \
    "$SITE_BUCKET" "$EXPECTED_SITE_BUCKET" >&2
  exit 1
fi
printf 'Workspace: %s\nBucket do site: %s\n' "$WORKSPACE" "$SITE_BUCKET"
BUCKET_VERSIONING="$(aws s3api get-bucket-versioning --bucket "$SITE_BUCKET" --query Status --output text)"
if [[ "$BUCKET_VERSIONING" == "Enabled" || "$BUCKET_VERSIONING" == "Suspended" ]]; then
  printf 'ERRO: versionamento S3 está %s no bucket do site. Este script não apaga versões antigas; resolva isso antes de continuar.\n' \
    "$BUCKET_VERSIONING" >&2
  exit 1
fi
printf 'Versionamento do bucket do site: desativado.\n'
printf 'Concluído: state e destino conferidos.\n'

run_step "4/6" "Gerar plano de destruição para ${ENVIRONMENT}" \
  terraform plan -destroy -var-file="$VARIABLES_FILE" -out="$PLAN_FILE"

printf '\nEste plano apaga os recursos do ambiente %s, incluindo usuários Cognito, dados DynamoDB, Lambdas, API WebSocket, CloudFront e o bucket do site.\n' "$ENVIRONMENT"
printf 'O bucket remoto do Terraform state é separado e não será destruído por este script.\n'
printf 'Antes do apply, o script também removerá todos os objetos atuais do bucket s3://%s.\n' "$SITE_BUCKET"
read -r -p "Para confirmar, digite 'destroy ${ENVIRONMENT} ${EXPECTED_ACCOUNT_ID}': " confirmation
if [[ "$confirmation" != "destroy ${ENVIRONMENT} ${EXPECTED_ACCOUNT_ID}" ]]; then
  printf 'Operação cancelada. Nenhum objeto ou recurso foi removido.\n'
  exit 0
fi

run_step "5/6" "Esvaziar bucket do site" \
  aws s3 rm "s3://${SITE_BUCKET}" --recursive
run_step "6/6" "Destruir recursos do ambiente ${ENVIRONMENT}" \
  terraform apply "$PLAN_FILE"

printf '\nAmbiente %s destruído. O bucket de state e o state do bootstrap foram preservados.\n' "$ENVIRONMENT"
printf 'Para recriar, siga docs/PROVISIONAMENTO-DO-ZERO.md a partir da etapa 3.\n'
