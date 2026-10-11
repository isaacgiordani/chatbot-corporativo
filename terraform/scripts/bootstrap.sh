#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BOOTSTRAP_DIR="$TERRAFORM_DIR/state-bootstrap"
cd "$BOOTSTRAP_DIR"

current_step="inicialização do bootstrap"
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

run_step "1/4" "Inicializar Terraform local do bootstrap" terraform init
run_step "2/4" "Verificar formatação" terraform fmt -check
run_step "3/4" "Validar configuração do bootstrap" terraform validate

current_step="4/4 Gerar plano do bucket de state"
printf '\n[%s] %s\n' "4/4" "Gerar plano do bucket de state"
printf '  $ terraform plan -detailed-exitcode -var-file=../dev.tfvars -out=state-bootstrap.tfplan\n'
if terraform plan -detailed-exitcode -var-file=../dev.tfvars -out=state-bootstrap.tfplan; then
  plan_status=0
else
  plan_status=$?
fi

if [[ "$plan_status" == "0" ]]; then
  printf '\nO bucket de state já está atualizado. Nenhuma alteração necessária; apply não será executado.\n'
  exit 0
elif [[ "$plan_status" != "2" ]]; then
  printf '\nERRO na etapa: %s (código %s)\n' "$current_step" "$plan_status" >&2
  exit "$plan_status"
fi
printf 'Concluído: plano com alterações.\n'

printf '\nO plano acima cria ou atualiza o bucket de state.\n'
read -r -p "Digite 'yes' para aplicar este plano: " confirmation
if [[ "$confirmation" != "yes" ]]; then
  printf 'Bootstrap cancelado; nenhum recurso foi aplicado.\n'
  exit 0
fi

run_step "5/5" "Aplicar plano revisado do bucket de state" terraform apply state-bootstrap.tfplan
printf '\nBootstrap concluído. Preserve state-bootstrap/terraform.tfstate.\n'
