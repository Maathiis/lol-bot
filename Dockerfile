# Image de base Linux avec Node.js 18
FROM node:18

# Créer le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
# On utilise --build-from-source pour s'assurer que better-sqlite3 est compilé pour l'OS du conteneur
RUN npm install

# Copier tout le reste du code source
COPY . .

# Définir la commande de démarrage
CMD [ "npm", "start" ]
