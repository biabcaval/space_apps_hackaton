#!/bin/bash

# Instala as dependências do Python
cd backend
pip install -r requirements.txt

# Inicia o servidor FastAPI
python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT