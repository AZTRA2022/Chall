# Chall — Partage de ressources libres · Design V1

**Date :** 2026-07-25
**Statut :** validé, prêt pour plan d'implémentation

## 1. Objectif

Une app mobile où chacun partage des ressources gratuites — formations, logiciels, apps,
mods, vidéos, liens, photos. Un feed public trié par votes, alimenté dès le premier jour
par des imports automatiques, modéré par IA puis par un humain, et complété par des
fichiers que les utilisateurs téléversent eux-mêmes.

Le produit doit être utile jour 1 (catalogue pré-rempli), défendable face aux stores
(Apple 1.2, Google), et exploitable par une seule personne (modération assistée).

## 2. Décisions de cadrage

| Sujet | Décision |
|---|---|
| Hébergement du contenu | Hybride : liens externes par défaut, upload bridé pour les fichiers dont l'utilisateur est l'auteur |
| Amorçage du catalogue | Import automatique (awesome-lists GitHub, flux RSS, chaînes YouTube) |
| Écran d'accueil | Feed unique trié par votes (Hot / Nouveau / Top) + filtre catégorie |
| Modération | File d'attente : blacklist déterministe → classifieur IA → revue humaine sur les cas incertains |
| Rétention | Abonnements + notifications groupées, et bibliothèque personnelle |
| Backend | Convex seul (données, crons, actions d'import, notifications) |
| Stockage fichiers | Convex Storage au démarrage, migration vers Cloudflare R2 dès que le compte est créé |

## 3. Architecture

Tout vit dans Convex : schéma, mutations, queries, crons, et actions Node pour les appels
sortants (unfurl, classifieur IA, scan antivirus, push Expo). Un seul déploiement, un seul
endroit à déboguer, temps réel gratuit pour les votes et la file de modération.

Deux dépendances externes seulement :

- **Service de scan** — un daemon ClamAV dans un conteneur, exposé par un endpoint HTTP
  minimal, appelé par une action Convex. ClamAV est un binaire natif et ne peut pas tourner
  dans une action Convex.
- **Classifieur IA** — appel HTTP sortant depuis une action Convex.

L'alternative écartée : un worker Node séparé pour les imports lourds. Justifié seulement
au-delà de dizaines de milliers d'items ; le découpage en lots avec curseur (§5) rend
Convex largement suffisant à cette échelle. Le passage à un worker séparé plus tard ne
touche pas l'app.

## 4. Modèle de données

Schéma Convex (`convex/schema.ts`) :

```ts
resources: {
  title, description, url, canonicalUrl, urlHash,
  category,        // formation | logiciel | app | mod | video | lien | photo | autre
  tags: string[],
  thumbUrl, sourceDomain,
  origin,          // "user" | "import"
  submittedBy?,    // userId, absent si import
  importSourceId?,
  kind,            // "link" | "file"
  fileId?,         // présent si kind === "file"
  status,          // "pending" | "approved" | "rejected" | "dead"
  autoFlags: string[],
  moderationVerdict?, moderationConfidence?, moderationReason?,
  score, voteCount, saveCount, hotScore,
  createdAt, approvedAt?, lastCheckedAt?
}

files: {
  resourceId?,                   // absent tant que l'upload n'est pas finalisé
  storageProvider,               // "convex" | "r2"
  storageKey,                    // id Convex ou clé R2
  filename, mimeType, sizeBytes,
  sha256,
  scanStatus,                    // "pending" | "clean" | "infected" | "error"
  scanEngine, scanAt?,
  authorDeclaredAt,              // horodatage de la déclaration d'auteur
  uploadedBy, createdAt
}

users        { clerkId, handle, avatarUrl, karma, role, trustLevel, strikes }
votes        { resourceId, userId }
collections  { userId, name, isDefault }
collectionItems { collectionId, resourceId, addedAt }
subscriptions   { userId, kind, value }      // kind: "category" | "tag"
reports      { resourceId, userId, reason, createdAt }
takedowns    { resourceId, sha256?, claimant, receivedAt, actedAt, note }
blockedHashes   { sha256, reason, blockedAt }
blockedDomains  { domain, reason }
blocks       { userId, blockedUserId }
importSources   { type, config, enabled, lastRunAt, callsToday, callsResetAt }
pushTokens   { userId, token, deviceId }
notificationQueue { userId, resourceId, createdAt, sentAt? }
```

Trois mécanismes portent le reste :

**`urlHash`** — URL normalisée (host en minuscule, paramètres `utm_*` retirés, slash final
retiré) puis hashée, avec index unique. Un lien posté plusieurs fois donne une seule
ressource ; les soumissions suivantes deviennent des votes. Indispensable dès l'import de
masse.

**`hotScore`** — champ stocké, pas calculé à la lecture. Cron horaire :
`votes / (heures_age + 2)^1.5`. Permet un index et donc un feed « Hot » paginé sans
scanner la table.

**`status` + `autoFlags`** — la modération vit sur la ressource. Le feed lit
`status: "approved"`, l'écran modérateur lit `status: "pending"` trié flags d'abord.

Un vote est un document, jamais un compteur incrémenté sur la ressource — sinon conflits
d'écriture en cas de votes simultanés. `voteCount` est dénormalisé et mis à jour dans la
même mutation.

## 5. Pipeline d'import

Un cron quotidien réveille chaque `importSource` activée. Chaque source suit le même
tuyau :

```
fetch source → extraire candidats {url, titre}
  → normaliser URL → urlHash
  → déjà en base ? stop
  → unfurl Open Graph (titre, image, description)
  → auto-check (blacklist + regex)
  → classifieur IA
  → insert status="pending" (ou "approved" si verdict propre et confiance haute)
```

Types de sources V1, choisis parce qu'ils sont gratuits et sans clé API :

- `github-awesome` — lecture du README brut d'un repo `awesome-*`, parsing des liens
  markdown. Des milliers de ressources déjà curées.
- `rss` — n'importe quel blog. YouTube expose un flux RSS par chaîne
  (`youtube.com/feeds/videos.xml?channel_id=`), donc les vidéos passent par le même code
  sans quota.

Reddit est reporté en V2 : son API demande des identifiants OAuth depuis la fin des
endpoints `.json` publics, ce qui en fait la seule source à coût d'inscription.

**Découpage obligatoire.** Une action Convex ne tourne pas indéfiniment. Chaque exécution
traite un lot fixe de 50 candidats, stocke son curseur dans `importSources.config`, et se
replanifie via `ctx.scheduler.runAfter(0, ...)` tant qu'il reste du travail. Une
awesome-list de 900 liens devient 18 lots enchaînés, sans timeout.

**Plafond d'appels.** `importSources.callsToday` compte les appels sortants, remis à zéro
chaque jour. Au-delà du plafond, la source se met en pause et journalise. Protège à la fois
le budget IA et le million d'appels de fonctions mensuel de Convex contre un scraper qui
boucle.

**L'unfurl est la partie fragile** — sites tiers qui expirent, redirigent, ou servent du
HTML incomplet. Règle : timeout 5 s, échec = ressource conservée avec le titre brut du
parseur et `thumbUrl` vide. Jamais un lien perdu à cause d'une image manquante.

**Cron hebdomadaire « liens morts »** — requêtes HEAD par lots sur les ressources les plus
anciennement vérifiées ; 404/410 répétés → `status: "dead"`, sortie du feed.

## 6. Modération

Trois couches, dans cet ordre :

```
1. Blacklist domaine + regex     — déterministe, gratuit, non manipulable
2. Classifieur IA                — nuance, contexte, langue
3. File humaine                  — les cas incertains, ~5 % du volume
```

La blacklist passe **avant** l'IA. Un domaine de warez connu se bloque par son nom ; un
lien dont le titre contient « ignore les instructions précédentes » ne peut pas négocier
avec une expression régulière. C'est la seule couche non contournable.

**Classifieur.** Une action Convex envoie titre, description, domaine et URL au modèle et
exige une réponse structurée :

```json
{
  "verdict": "approve" | "review" | "reject",
  "confidence": 0.0,
  "categories": ["piratage", "malware", "spam", "porn", "hors-sujet"],
  "suggested_category": "formation",
  "suggested_tags": ["python", "gratuit"],
  "reason": "texte court affiché au modérateur"
}
```

Le même appel catégorise et tague, donc l'import automatique produit des ressources déjà
rangées sans travail manuel.

Seuils : `approve` avec confiance > 0,85 et zéro `autoFlag` → publication directe. Tout le
reste part en file humaine, triée par risque.

**Trois règles non négociables :**

1. Le contenu utilisateur est traité comme **données**, jamais comme instructions. Titres et
   descriptions récupérés vont dans un bloc délimité, avec consigne explicite au modèle de
   ne pas suivre ce qu'il contient. Sans ça, un lien piraté avec la bonne description
   s'auto-approuve.
2. **Fail closed.** API indisponible, timeout, JSON invalide → `status: "pending"`, jamais
   `approved`. Un modérateur absent bloque la publication, il ne l'ouvre pas.
3. La clé API vit dans les variables d'environnement Convex, côté serveur. Jamais dans
   l'app : un binaire mobile se décompile.

**Soumission utilisateur.** L'utilisateur colle une URL, voit le preview (titre, image,
description pré-remplis et éditables), choisit catégorie et tags, envoie. Si `urlHash`
existe déjà, pas d'erreur : redirection vers la ressource existante et le geste devient un
vote. La mutation force `status: "pending"` côté serveur — le client ne choisit jamais son
statut. Limite : 10 soumissions par jour et par compte.

**Écran modérateur** — route `/(mod)`, visible seulement si `users.role` vaut `mod` ou
`admin`. Le rôle vient des `publicMetadata` Clerk, synchronisé dans Convex par webhook
(`svix` est déjà installé). File triée : flaggés d'abord, puis par ancienneté. Une carte à
la fois, deux gestes : approuver / rejeter avec motif. Le rejet notifie l'auteur.

**Signalement.** Motifs : pirate / mort / hors-sujet / trompeur. À 3 signalements
distincts, la ressource repasse automatiquement en `pending`, donc disparaît du feed, et
retourne en file. Modération réactive sans surveillance permanente.

**Blocage.** Un utilisateur peut bloquer un compte : ses ressources disparaissent de son
feed. Table `blocks`, filtre à la lecture.

**Goulot connu.** Un seul modérateur au départ. La sortie est la confiance progressive
(les comptes à fort karma publient directement) — d'où `users.trustLevel` déjà présent au
schéma. Non construit en V1.

## 7. Fichiers hébergés

### Périmètre

**L'upload est réservé aux fichiers dont l'utilisateur est l'auteur** : presets, LUTs,
templates, PDF, configurations, samples. Tout le reste — logiciels, formations, mods de
jeux tiers — reste en lien externe. Ce cadrage donne l'usage sans transformer le stockage
en dépôt de contrefaçon.

### Limites

| Règle | Valeur |
|---|---|
| Taille par fichier | 25 Mo pendant la phase Convex, 100 Mo après migration R2 |
| Quota par compte | 1 Go |
| Extensions refusées | `.apk`, `.exe`, `.dmg`, `.msi`, `.ipa` et tout exécutable — lien externe uniquement |
| Déclaration d'auteur | Case obligatoire, horodatée, stockée dans `files.authorDeclaredAt` |

La limite de 25 Mo au démarrage vient du tier gratuit Convex : 1 Go de fichiers et 1 Go de
sortie par mois. Un fichier de 100 Mo téléchargé dix fois consommerait le mois entier.
Cette limite remonte à 100 Mo au basculement vers R2, dont le tier gratuit offre 10 Go de
stockage et une sortie illimitée à 0 $.

### Abstraction de stockage

Toute lecture et écriture de fichier passe par un module unique
(`convex/storage/provider.ts`) exposant `put`, `getUrl`, `delete`. Deux implémentations :
Convex Storage et R2 via URLs pré-signées. `files.storageProvider` indique laquelle
détient chaque fichier.

La migration ne casse rien : les nouveaux uploads partent vers R2, les anciens restent
lisibles sur Convex, et un script de migration les recopie progressivement. Aucun temps
d'arrêt, aucune modification côté app.

### Flux d'upload

```
1. L'utilisateur choisit un fichier, coche la déclaration d'auteur
2. Vérification extension + taille + quota du compte      → refus immédiat si dépassement
3. Calcul du SHA-256                                       → refus si présent dans blockedHashes
4. Upload vers le provider, scanStatus = "pending"
5. Action Convex → endpoint ClamAV
6. clean    → la ressource entre en file de modération normale
   infected → fichier supprimé, strike sur le compte, notification à l'utilisateur
   error    → reste en "pending", relance par cron (fail closed)
```

Le fichier n'est jamais téléchargeable tant que `scanStatus !== "clean"` **et**
`status !== "approved"`.

### Service de scan

ClamAV en conteneur, daemon `clamd` derrière un endpoint HTTP minimal. Choisi parce qu'il
est libre, sans quota et sans restriction d'usage commercial.

VirusTotal a été écarté : son API gratuite est plafonnée à 500 requêtes par jour et
4 par minute, et interdit explicitement l'usage dans un produit ou service commercial —
une app publique, même gratuite, entre dans cette définition.

Limite assumée : ClamAV est basé sur signatures. Il détecte le malware connu, pas les
attaques inédites. Suffisant ici, où l'objectif est de bloquer le fichier vérolé évident et
de pouvoir démontrer la diligence ; le refus des exécutables couvre le reste en amont.

## 8. Conformité

### Statut d'hébergeur

L'objectif juridique tient en une phrase : **être un hébergeur passif diligent, jamais un
éditeur qui recommande.**

| Mesure | Statut V1 |
|---|---|
| Adresse de retrait publiée (`abuse@`) | Requis, gratuit |
| Procédure de retrait écrite dans les CGU | Requis, gratuit |
| Retrait sur notification, journalisé dans `takedowns` | Requis, gratuit |
| Résiliation des récidivistes : 3 retraits validés → compte fermé | Requis, gratuit |
| Blocklist par hash après retrait (`blockedHashes`) | Requis, gratuit |
| Agent DMCA enregistré (Copyright Office, 6 $) | Reporté — avant soumission au store |
| Aucune mise en avant éditoriale des fichiers hébergés | Règle de conception |

La résiliation des récidivistes n'est pas optionnelle : c'est une condition du safe harbor.
Un service qui retire chaque fichier signalé mais ne ferme jamais un compte perd sa
protection. Le compteur vit dans `users.strikes`.

La blocklist par hash est ce qui rend un retrait durable : sans elle, le même fichier
revient au prochain upload et l'ayant droit avec lui.

**Sur l'agent DMCA.** Le safe harbor du DMCA est américain ; il coûte 6 $ par dépôt auprès
du Copyright Office, renouvelable tous les 3 ans au même tarif. Hors États-Unis, le régime
applicable est le statut d'hébergeur local (LCEN, DSA, équivalents), qui ne demande aucun
enregistrement payant — seulement un mécanisme de signalement et un contact publié, tous
deux couverts ci-dessus. L'enregistrement devient nécessaire dès qu'il y a des
utilisateurs américains, donc à faire avant la soumission au store.

### Exigences des stores

Apple (guideline 1.2) et Google demandent quatre choses pour tout contenu utilisateur,
toutes couvertes :

| Exigence | Où |
|---|---|
| Filtrage du contenu | Blacklist + classifieur IA + file humaine (§6) |
| Bouton signaler | Écran détail ressource (§9) |
| Blocage d'utilisateur | Table `blocks`, écran paramètres (§9) |
| Contact joignable et publié | Adresse `abuse@` + page contact |

### Données personnelles

Conservation minimale : IP et horodatage à la soumission et à l'upload, durée de
conservation limitée et annoncée dans la politique de confidentialité.

**Aucune transmission spontanée aux autorités.** Les données sont conservées, et
communiquées uniquement sur réquisition valide. Une transmission proactive constituerait
elle-même une violation du RGPD.

## 9. Écrans

Expo Router, en réutilisant les groupes existants :

```
src/app/
  (auth)/            déjà en place
  (tabs)/
    index.tsx        Feed — Hot / Nouveau / Top + filtre catégorie
    search.tsx       Recherche + tags populaires
    library.tsx      Collections + abonnements
    settings.tsx     Profil, notifications, comptes bloqués
  resource/[id].tsx  Détail — preview, Ouvrir, Sauvegarder, Signaler
  submit.tsx         Form sheet — URL ou fichier, preview, envoi
  (mod)/queue.tsx    File de modération, si role mod/admin
```

Le bouton d'ajout est un FAB au-dessus de la tab bar (`floating-tab-bar.tsx` existe déjà),
pas un onglet : publier est ponctuel et ne mérite pas un cinquième de la barre.

**Écran détail.** Les liens s'ouvrent dans `expo-web-browser`, en interne, pas dans le
navigateur système : l'utilisateur revient d'un geste au lieu de quitter l'app. Le même
écran porte sauvegarder, signaler, et l'auteur de la publication.

## 10. Rétention

**Abonnements et notifications.** L'utilisateur suit des catégories et des tags. À
l'approbation d'une ressource, une mutation planifie un job qui empile les notifications
des abonnés correspondants dans `notificationQueue`.

Une notification **groupée** par jour et par utilisateur, à heure fixe : « 12 nouvelles
ressources dans #python, #capcut ». Un import quotidien de 200 liens ne doit jamais devenir
200 notifications. Un cron quotidien vide la file. L'heure d'envoi et le mode temps réel
sont réglables dans les paramètres.

Côté technique : token Expo enregistré au login dans `pushTokens`, action Convex qui appelle
l'API push d'Expo par lots de 100, suppression des tokens rejetés — sinon la table pourrit
et chaque envoi traîne des milliers d'entrées mortes.

**Bibliothèque.** Collection « À voir » créée à l'inscription. Sauvegarder se fait
directement depuis le feed, sans ouvrir le détail. Collections privées en V1.

## 11. Erreurs et cas limites

- Lien mort au clic → bouton « Signaler mort » dans le message d'erreur.
- Unfurl renvoyant un HTML vide → ressource conservée avec titre brut, jamais rejetée.
- Hors ligne → `expo-network` détecte ; le feed sert le dernier cache, la soumission est
  bloquée avec un message explicite plutôt qu'un échec silencieux.
- Job d'import interrompu → le curseur reste au dernier lot réussi ; la reprise ne duplique
  rien, `urlHash` protège de toute façon.
- Upload interrompu → fichier orphelin sans `resourceId`, nettoyé par un cron quotidien.
- Scan indisponible → `scanStatus: "error"`, fichier non téléchargeable, relance par cron.
- Quota de compte atteint → refus avant l'upload, avec l'espace restant affiché.

## 12. Tests

Trois choses seulement méritent des tests en V1, parce qu'elles échouent silencieusement :

1. **Normalisation d'URL** — le cœur de l'anti-doublon.
2. **Calcul de `hotScore`** — une erreur ici fige le feed sans lever d'exception.
3. **Parseurs de sources** — un par type (`github-awesome`, `rss`).

S'y ajoutent deux tests de sécurité, parce qu'ils protègent des règles qui ne doivent
jamais céder :

4. La mutation de soumission force `status: "pending"` même si le client envoie autre chose.
5. Un SHA-256 présent dans `blockedHashes` est refusé à l'upload.

Le reste se vérifie à l'usage.

## 13. Hors périmètre V1

Reporté volontairement, avec les champs déjà prévus au schéma pour éviter une migration :

- **Karma, badges, classement** (`users.karma`) — sans base de contributeurs, aucun sens.
- **Drop quotidien curé** — demande une curation quotidienne intenable au lancement.
- **Confiance progressive** (`users.trustLevel`) — à activer quand la file dépasse la
  capacité humaine.
- **Source Reddit** — nécessite des identifiants OAuth.
- **Collections publiques et partageables.**
- **Migration vers R2** — planifiée, non bloquante ; voir §7.

## 14. Coûts

| Poste | Offre gratuite | Tient jusqu'à |
|---|---|---|
| Backend Convex | 0,5 Go base, 1 M appels/mois, 1 Go sortie | Largement le lancement |
| Fichiers, phase 1 (Convex) | 1 Go stockage, 1 Go sortie/mois | ~40 fichiers de 25 Mo, sortie limitante |
| Fichiers, phase 2 (R2) | 10 Go, 1 M écritures, 10 M lectures, sortie 0 $ | ~100 fichiers de 100 Mo |
| Auth Clerk | Tier gratuit | Plusieurs milliers d'utilisateurs |
| Push Expo | Gratuit | — |
| Scan ClamAV | Logiciel libre | Coût = la VM uniquement |
| Classifieur IA | ~0,0005 $ par ressource | 10 000 liens ≈ 5 $ |
| Agent DMCA | — | 6 $, avant soumission au store |

Le plafond à surveiller n'est pas le stockage mais le **million d'appels de fonctions
Convex par mois**, consommé par lots par le cron d'import. Le compteur `callsToday` par
source (§5) le protège.

## 15. Risques ouverts

- **Sortie Convex pendant la phase 1.** 1 Go par mois est étroit dès qu'un fichier devient
  populaire. Mitigation : plafond à 25 Mo, et migration R2 traitée en priorité.
- **Capacité de modération.** Un seul humain. Mitigation : seuils du classifieur ajustables,
  et confiance progressive prête à activer.
- **Qualité des sources d'import.** Une awesome-list mal tenue injecte des liens déjà morts.
  Mitigation : cron de détection des liens morts, et désactivation par source.
- **Hébergement du service de scan.** Le seul poste qui n'est pas couvert par un tier
  gratuit connu. À arbitrer au déploiement selon la région ; ClamAV tourne sur la plus
  petite instance disponible.
- **Juridiction.** Le régime applicable (DMCA, LCEN, DSA) dépend du lieu d'établissement et
  d'hébergement. Les mesures du §8 couvrent le dénominateur commun ; l'enregistrement DMCA
  reste à faire avant toute exposition américaine.
