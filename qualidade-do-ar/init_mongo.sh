#!/bin/bash

# Criando diretório para persistência dos dados
mkdir -p ~/mongodb/data

# Definindo variáveis de ambiente
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=senha123
MONGO_PORT=27017

# Executando o container MongoDB
docker run -d \
    --name mongodb \
    -p ${MONGO_PORT}:27017 \
    -v ~/mongodb/data:/data/db \
    -e MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME} \
    -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD} \
    --restart unless-stopped \
    mongo:latest

# Verificando se o container está rodando
echo "Verificando status do container..."
sleep 3
docker ps | grep mongodb