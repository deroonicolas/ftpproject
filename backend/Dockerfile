FROM node:20-slim
# Installation de FFmpeg pour Linux (Nécessaire pour le stream sur le NAS)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# On définit par défaut qu'on est en mode Docker
ENV DOCKER_MODE=true
EXPOSE 3000
CMD ["node", "server.js"]