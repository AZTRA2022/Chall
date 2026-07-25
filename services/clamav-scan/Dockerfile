# Service d'analyse antivirus appelé par `convex/files.ts`.
#
# ClamAV est un binaire natif : il ne peut pas tourner dans une action Convex,
# d'où ce conteneur. L'image officielle embarque déjà `clamd` et `freshclam`,
# qui tient les signatures à jour tout seul.
FROM clamav/clamav:stable

RUN apk add --no-cache nodejs

WORKDIR /srv
COPY server.mjs .

ENV PORT=8080
EXPOSE 8080

# `clamd` en tâche de fond, le serveur HTTP au premier plan : c'est lui qui doit
# recevoir les signaux d'arrêt du superviseur.
CMD sh -c "clamd & node /srv/server.mjs"
