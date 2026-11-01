#!/usr/bin/env bash
# Regenera config/routes.spa.yaml desde los módulos migrados de ../web.
# Añadir aquí cada carpeta (módulo o paquete compartido) que se migre al BFF.
# Uso: bin/regen-spa-manifest.sh [raiz tmwe_json]   (por defecto $TMWE_JSON_DIR o /var/www/host/tmwe/erp/tmwe_json)
set -euo pipefail
cd "$(dirname "$0")/.."
BACKEND="${1:-${TMWE_JSON_DIR:-/var/www/host/tmwe/erp/tmwe_json}}"
SOURCES=(
  apps/operations/src   # shell, router y todos los módulos
  packages/platform     # componentes y servicios compartidos
)
php bin/gen-spa-manifest.php "$BACKEND" "$(IFS=,; echo "${SOURCES[*]}")" "$PWD/../web"
