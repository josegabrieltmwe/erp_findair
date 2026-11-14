#!/usr/bin/env bash
# Rellena web/e2e/.env.e2e (perfil partner) leyendo la BD del API local (tmwe_api/.env).
# SOLO LECTURA sobre la BD. La contraseña va directa al fichero (modo 600, ignorado por git) y no se imprime.
#
# Uso:
#   scripts/rellenar-env.sh --list [--partner-id 9069]            # lista usuarios y clientes del partner
#   scripts/rellenar-env.sh [--partner-id 9069] [--user LOGIN] [--client "texto"] [--allow-write]
#
# Sin --user elige el usuario de pruebas «JOURNEY…» del partner si existe; si no, el primero activo.
# Sin --client elige un cliente «JOURNEY…» del partner; si no, el primero.
# --allow-write escribe E2E_ALLOW_WRITE=1 (consentimiento a que el test cree datos en ESA base).
set -euo pipefail

API_ENV="${TMWE_API_ENV:-/var/www/dev/api/.env}"
OUT="$(dirname "$0")/../.env.e2e"
PARTNER=9069; USER_LOGIN=""; CLIENT=""; LIST=0; ALLOW=0

while [ $# -gt 0 ]; do
  case "$1" in
    --partner-id) PARTNER="$2"; shift 2;;
    --user) USER_LOGIN="$2"; shift 2;;
    --client) CLIENT="$2"; shift 2;;
    --list) LIST=1; shift;;
    --allow-write) ALLOW=1; shift;;
    *) echo "argumento desconocido: $1" >&2; exit 2;;
  esac
done
[[ "$PARTNER" =~ ^[0-9]+$ ]] || { echo "--partner-id debe ser numérico" >&2; exit 2; }
[[ -z "$USER_LOGIN" || "$USER_LOGIN" =~ ^[A-Za-z0-9_.@-]+$ ]] || { echo "--user con caracteres no válidos" >&2; exit 2; }

get() { grep -E "^$1=" "$API_ENV" | head -1 | cut -d= -f2- | sed -E "s/^['\"]//; s/['\"]$//"; }
DB_HOST="$(get DB_HOST)"; DB_PORT="$(get DB_PORT)"; DB_NAME="$(get DB_NAME)"; DB_USER="$(get DB_USER)"
export MYSQL_PWD="$(get DB_PASSWORD)"
sql() { mysql -h"$DB_HOST" -P"${DB_PORT:-3306}" -u"$DB_USER" "$DB_NAME" -N -B -e "$1"; }
esc() { printf '%s' "$1" | sed "s/'/''/g"; }

echo "BD: $DB_NAME en $DB_HOST (solo lectura)"
echo "Partner: $(sql "SELECT CONCAT(id,' · ',rag_soc) FROM anagrafiche WHERE id=$PARTNER")"

if [ "$LIST" = 1 ]; then
  echo "--- usuarios activos (login · nombre · mail)"
  sql "SELECT CONCAT(loginn,' · ',nome,' · ',IFNULL(mail,'')) FROM contatti WHERE id_anagrafica=$PARTNER AND stato='A' ORDER BY (loginn LIKE 'JRN%' OR nome LIKE '%JOURNEY%') DESC, id"
  echo "--- clientes propios del partner"
  sql "SELECT CONCAT(id,' · ',rag_soc) FROM anagrafiche WHERE id_anagr_titolare=$PARTNER ORDER BY (rag_soc LIKE 'JOURNEY%') DESC, id"
  exit 0
fi

if [ -z "$USER_LOGIN" ]; then
  USER_LOGIN="$(sql "SELECT loginn FROM contatti WHERE id_anagrafica=$PARTNER AND stato='A' AND lpw<>'' ORDER BY (loginn LIKE 'JRN%' OR nome LIKE '%JOURNEY%') DESC, id LIMIT 1")"
fi
[ -n "$USER_LOGIN" ] || { echo "no hay usuario activo con contraseña para el partner $PARTNER" >&2; exit 1; }
PASS="$(sql "SELECT lpw FROM contatti WHERE id_anagrafica=$PARTNER AND stato='A' AND loginn='$(esc "$USER_LOGIN")' LIMIT 1")"
[ -n "$PASS" ] || { echo "usuario $USER_LOGIN no existe, no está activo o no tiene contraseña" >&2; exit 1; }

if [ -z "$CLIENT" ]; then
  CLIENT="$(sql "SELECT rag_soc FROM anagrafiche WHERE id_anagr_titolare=$PARTNER ORDER BY (rag_soc LIKE 'JOURNEY%') DESC, id LIMIT 1")"
fi
[ "${#CLIENT}" -ge 2 ] || { echo "el partner $PARTNER no tiene clientes propios; pasa --client" >&2; exit 1; }

# Conserva las claves que ya hubiera (otros perfiles, E2E_BASE_URL) y sustituye las del partner.
touch "$OUT"; chmod 600 "$OUT"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
grep -vE '^(E2E_PARTNER_USER|E2E_PARTNER_PASS|E2E_PARTNER_CLIENT|E2E_ALLOW_WRITE)=' "$OUT" > "$TMP" || true
{
  cat "$TMP"
  echo "E2E_PARTNER_USER=$USER_LOGIN"
  echo "E2E_PARTNER_PASS=$PASS"
  echo "E2E_PARTNER_CLIENT=$CLIENT"
  [ "$ALLOW" = 1 ] && echo "E2E_ALLOW_WRITE=1"
} > "$OUT"
chmod 600 "$OUT"

echo "Escrito $(realpath "$OUT") (modo 600)"
echo "  E2E_PARTNER_USER=$USER_LOGIN"
echo "  E2E_PARTNER_PASS=<oculta>"
echo "  E2E_PARTNER_CLIENT=$CLIENT"
echo "  E2E_ALLOW_WRITE=$([ "$ALLOW" = 1 ] && echo 1 || echo '(no; añade --allow-write cuando confirmes que la BD es de pruebas)')"
