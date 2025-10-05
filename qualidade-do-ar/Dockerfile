# Use uma imagem base adequada
FROM node:20.12.2

# Defina o diretório de trabalho
WORKDIR /usr/src/app

# Instale dependências do sistema
RUN apt-get update && apt-get install -y \
  wget \
  curl \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdbus-glib-1-2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  libu2f-udev \
  libvulkan1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libgtk2.0-0 \
  libnotify-dev \
  libglib2.0-0 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Copie o package.json e instale as dependências do Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Copie o restante dos arquivos
COPY . .

# Comando para iniciar o aplicativo
CMD ["npm", "start"]
