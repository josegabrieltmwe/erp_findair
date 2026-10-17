#!/usr/bin/env bash
# Instala el vhost local erp-findair.php8 (ejecutar con: sudo bash deploy/apache/install.sh).
# Los certificados NO están en el repo: se generan con mkcert como el usuario de desarrollo
# (mkcert -cert-file erp-findair.php8.pem -key-file erp-findair.php8-key.pem \
#    erp-findair.php8 www.erp-findair.php8) y se pasan en CERT_DIR (por defecto, el directorio actual).
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="${CERT_DIR:-$PWD}"
install -m 644 -o root -g root "$CERT_DIR/erp-findair.php8.pem"     /etc/apache2/ssl/erp-findair.php8.pem
install -m 600 -o root -g root "$CERT_DIR/erp-findair.php8-key.pem" /etc/apache2/ssl/erp-findair.php8-key.pem
install -m 644 -o root -g root "$D/erp-findair.php8.conf"           /etc/apache2/sites-available/erp-findair.php8.conf
grep -q 'erp-findair.php8' /etc/hosts || echo '127.0.0.1 erp-findair.php8 www.erp-findair.php8' >> /etc/hosts
a2ensite erp-findair.php8.conf
apache2ctl configtest
systemctl reload apache2
echo "OK -> https://erp-findair.php8/bff/healthz"
