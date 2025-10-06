#!/usr/bin/env bash
set -euo pipefail

# Lê credenciais de variáveis de ambiente
: "${EARTHDATA_USERNAME:?Environment variable EARTHDATA_USERNAME is not set}"
: "${EARTHDATA_PASSWORD:?Environment variable EARTHDATA_PASSWORD is not set}"

# Arquivo alvo (Unix/macOS)
NETRC_PATH="${HOME}/.netrc"

# Host padrão Earthdata (mude se necessário)
HOST="urs.earthdata.nasa.gov"

cat > "$NETRC_PATH" <<EOF
machine ${HOST}
  login ${EARTHDATA_USERNAME}
  password ${EARTHDATA_PASSWORD}
EOF

# Ajusta permissões para somente dono
chmod 600 "$NETRC_PATH"

echo "Arquivo criado em: $NETRC_PATH"
echo "Permissões ajustadas para 600 (rw-------)."