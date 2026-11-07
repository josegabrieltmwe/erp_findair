#!/usr/bin/env bash
# Aplica los vhosts del ERP en sandbox.erp.findair.it y sandbox.erp-dev.findair.it.
# Ejecutar con sudo desde una terminal propia (el `!` de Claude Code no puede pedir la contraseña):
#
#   sudo bash /var/www/sandbox/erp_findair/deploy/aplicar-apache-sandbox.sh hmr        # recarga en caliente en ambos
#   sudo bash /var/www/sandbox/erp_findair/deploy/aplicar-apache-sandbox.sh compilado  # ambos sirven web/dist
#
# En los dos modos se incluye el Alias /loghi_partner (logo del partner).
# Modo hmr: necesita los servicios de usuario erp-sandbox-vite (5191) y
# erp-dev-vite (5190) activos; activa linger para que sigan vivos sin sesion.
#
# Guarda copia de cada fichero que sustituye y, si `apache2ctl configtest`
# falla, las restaura y no recarga Apache.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Ejecutalo con sudo."; exit 1; }

MODO="${1:-}"
SRC=/var/www/sandbox/erp_findair/deploy/apache
DST=/etc/apache2/sites-available
STAMP=$(date +%Y%m%d-%H%M%S)
declare -a CAMBIADOS=()

instalar() { # origen destino
  cp -a "$2" "$2.bak-$STAMP"
  cp "$1" "$2"
  CAMBIADOS+=("$2")
  echo "  $(basename "$1") -> $2 (copia: $2.bak-$STAMP)"
}

case "$MODO" in
  hmr)
    echo "Recarga en caliente (Vite) en sandbox.erp y sandbox.erp-dev"
    instalar "$SRC/sandbox.erp.findair.it.hmr.conf"     "$DST/sandbox.erp.findair.it.conf"
    instalar "$SRC/sandbox.erp-dev.findair.it.hmr.conf" "$DST/sandbox.erp-dev.findair.it.conf"
    loginctl enable-linger tmwe-admin2
    echo "  linger activado para tmwe-admin2"
    ;;
  compilado)
    echo "Bundle compilado (web/dist) en sandbox.erp y sandbox.erp-dev"
    instalar "$SRC/sandbox.erp.findair.it.conf"     "$DST/sandbox.erp.findair.it.conf"
    instalar "$SRC/sandbox.erp-dev.findair.it.conf" "$DST/sandbox.erp-dev.findair.it.conf"
    ;;
  *)
    echo "Uso: sudo bash $0 hmr|compilado"; exit 1 ;;
esac

if apache2ctl configtest; then
  systemctl reload apache2
  echo "OK: Apache recargado."
else
  echo "ERROR en la configuracion: restaurando copias y sin recargar."
  for f in "${CAMBIADOS[@]}"; do cp -a "$f.bak-$STAMP" "$f"; done
  exit 1
fi
