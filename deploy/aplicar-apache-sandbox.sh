#!/usr/bin/env bash
# Aplica los vhosts del ERP del sandbox. Ejecutar con sudo desde una terminal propia:
#
#   sudo bash /var/www/sandbox/erp_findair/deploy/aplicar-apache-sandbox.sh        # solo logo de partner en sandbox.erp
#   sudo bash /var/www/sandbox/erp_findair/deploy/aplicar-apache-sandbox.sh hmr    # ademas: HMR en sandbox.erp-dev
#
# Guarda copia de cada fichero que sustituye y, si `apache2ctl configtest` falla,
# las restaura y no recarga Apache.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Ejecutalo con sudo."; exit 1; }

SRC=/var/www/sandbox/erp_findair/deploy
DST=/etc/apache2/sites-available
STAMP=$(date +%Y%m%d-%H%M%S)
declare -a CAMBIADOS=()

instalar() { # origen destino
  cp -a "$2" "$2.bak-$STAMP"
  cp "$1" "$2"
  CAMBIADOS+=("$2")
  echo "  instalado $(basename "$1") -> $2 (copia: $2.bak-$STAMP)"
}

echo "1) Logo de partner en sandbox.erp.findair.it"
instalar "$SRC/apache/sandbox.erp.findair.it.conf" "$DST/sandbox.erp.findair.it.conf"

if [ "${1:-}" = "hmr" ]; then
  echo "2) Recarga en caliente en sandbox.erp-dev.findair.it"
  instalar "$SRC/apache/sandbox.erp-dev.findair.it.hmr.conf" "$DST/sandbox.erp-dev.findair.it.conf"
  loginctl enable-linger tmwe-admin2
  echo "  linger activado para tmwe-admin2"
fi

if apache2ctl configtest; then
  systemctl reload apache2
  echo "OK: Apache recargado."
else
  echo "ERROR en la configuracion: restaurando copias y sin recargar."
  for f in "${CAMBIADOS[@]}"; do cp -a "$f.bak-$STAMP" "$f"; done
  exit 1
fi
