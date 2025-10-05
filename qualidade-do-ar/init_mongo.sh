#!/bin/bash
set -e

# Aguarda o MongoDB iniciar
until mongosh --host mongodb --port 27017 -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "print(\"waited for connection\")"
do
    echo "Aguardando conexão com MongoDB..."
    sleep 2
done

# Cria o banco de dados e usuário
mongosh --host mongodb --port 27017 -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin <<EOF
use $MONGO_INITDB_DATABASE

db.createUser({
  user: '$MONGO_INITDB_ROOT_USERNAME',
  pwd: '$MONGO_INITDB_ROOT_PASSWORD',
  roles: [{
    role: 'readWrite',
    db: '$MONGO_INITDB_DATABASE'
  }]
});

# Criando algumas coleções iniciais
db.createCollection('users');
db.createCollection('notifications');

print("Inicialização do MongoDB concluída!");
EOF