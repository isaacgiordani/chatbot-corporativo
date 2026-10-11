#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

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

run_step "1/4" "Inicializar e migrar para o state remoto" terraform init -backend-config=dev.backend.hcl -migrate-state
run_step "2/4" "Verificar formatação" terraform fmt -check
run_step "3/4" "Validar configuração" terraform validate
run_step "4/4" "Gerar plano para dev" terraform plan -var-file=dev.tfvars

printf '\nTodas as etapas foram concluídas.\n'
