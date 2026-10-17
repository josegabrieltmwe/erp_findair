#!/usr/bin/env bash
# Regenera config/routes.spa.yaml desde los módulos migrados de ../web.
# Añadir aquí cada carpeta (módulo o paquete compartido) que se migre al BFF.
# Uso: bin/regen-spa-manifest.sh [raiz tmwe_json]   (por defecto /var/www/host/tmwe/erp/tmwe_json)
set -euo pipefail
cd "$(dirname "$0")/.."
BACKEND="${1:-/var/www/host/tmwe/erp/tmwe_json}"
SOURCES=(
  cargo shipment
  apps/operations/src/shell
  packages/platform/{presence,services,shell,composables,platform,anagrafiche,flight-search,detail,dashboard}
)
php bin/gen-spa-manifest.php "$BACKEND" "$(IFS=,; echo "${SOURCES[*]}")" "$PWD/../web"
