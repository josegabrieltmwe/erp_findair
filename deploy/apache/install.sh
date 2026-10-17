#!/usr/bin/env bash
# Instala el vhost local erp-findair.php8 (ejecutar con: sudo bash deploy/apache/install.sh).
# Los certificados NO están en el repo: se generan con mkcert como el usuario de desarrollo
# (mkcert -cert-file erp-findair.php8.pem -key-file erp-findair.php8-key.pem \
#    erp-findair.php8 www.erp-findair.php8) y se pasan en CERT_DIR (por defecto, el directorio actual). Si ya están instalados en
# /etc/apache2/ssl, no hace falta CERT_DIR: solo se actualiza el vhost.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="${CERT_DIR:-$PWD}"
SSL=/etc/apache2/ssl
if [[ -f "$CERT_DIR/erp-findair.php8.pem" && -f "$CERT_DIR/erp-findair.php8-key.pem" ]]; then
  install -m 644 -o root -g root "$CERT_DIR/erp-findair.php8.pem"     "$SSL/erp-findair.php8.pem"
  install -m 600 -o root -g root "$CERT_DIR/erp-findair.php8-key.pem" "$SSL/erp-findair.php8-key.pem"
elif [[ ! -f "$SSL/erp-findair.php8.pem" || ! -f "$SSL/erp-findair.php8-key.pem" ]]; then
  echo "Faltan los certificados: genéralos con mkcert y pasa CERT_DIR=<carpeta> (ver cabecera)." >&2
  exit 1
fi
install -m 644 -o root -g root "$D/erp-findair.php8.conf"           /etc/apache2/sites-available/erp-findair.php8.conf
grep -q 'erp-findair.php8' /etc/hosts || echo '127.0.0.1 erp-findair.php8 www.erp-findair.php8' >> /etc/hosts
a2ensite erp-findair.php8.conf
apache2ctl configtest
systemctl reload apache2
echo "OK -> https://erp-findair.php8/bff/healthz"
