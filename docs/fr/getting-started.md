# Premiers pas

## Ce dont vous avez besoin

Ensembler exécute vos services dans Docker, vous avez donc besoin d'un
**environnement d'exécution de conteneurs** installé et en cours d'exécution —
quelque chose qui fournit les commandes `docker` et `docker compose`.

- **Recommandé (le plus simple) :**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — une
  installation en un clic pour macOS, Windows et Linux. Si vous ne l'avez pas,
  Ensembler vous y oriente au premier lancement.
- **Vous utilisez déjà autre chose ?** N'importe quel environnement d'exécution
  compatible Docker fonctionne tout aussi bien — par exemple **OrbStack**
  (macOS), **Podman**, **Rancher Desktop**, **colima** ou **Docker Engine** sur
  Linux. Tant que `docker` et `docker compose` fonctionnent, Ensembler les
  utilisera.

Vous n'avez **pas** besoin de Node.js, d'un terminal ou d'outils de
développement pour utiliser l'application.

## Premier lancement

Lorsque vous ouvrez Ensembler pour la première fois, il vérifie que Docker est
en cours d'exécution. Si Docker n'est pas installé ou démarré, vous verrez des
instructions pour corriger cela — démarrez Docker Desktop, attendez qu'il
indique qu'il est en cours d'exécution, et Ensembler continuera.

## L'assistant de configuration

### 1. Choisissez vos services
Les services recommandés sont présélectionnés pour un centre multimédia complet.
Les catégories intitulées **« choisir un »** (serveur multimédia, client de
téléchargement, gestionnaire d'indexeurs, demandes) vous laissent sélectionner
une seule option ; « gestion multimédia » vous permet d'en sélectionner
plusieurs.

### 2. Définissez vos dossiers
Indiquez à Ensembler où se trouvent vos **séries TV**, vos **films** et vos
**téléchargements**. Ce sont vos propres dossiers — choisissez des emplacements
disposant de suffisamment d'espace pour votre bibliothèque. Les ports sont
vérifiés automatiquement, et si un port par défaut est déjà utilisé, Ensembler
en choisit discrètement un libre pour vous.

### 3. Appliquez
Ensembler génère la configuration, démarre vos services et les relie entre eux.
Vous verrez chaque étape se terminer.

## Terminer la configuration

Quelques étapes ne peuvent être réalisées que par vous, et le tableau de bord
vous les proposera dans une liste **« Terminer la configuration »** :

- **Ajouter un indexeur dans Prowlarr** — pour que Sonarr et Radarr puissent
  rechercher du contenu. Vous choisissez vos propres sources ; Ensembler ne les
  sélectionne jamais à votre place.
- **Se connecter à Plex** — Ensembler crée alors automatiquement vos
  bibliothèques Séries TV et Films. (Jellyfin ne nécessite aucune connexion — il
  est entièrement configuré pour vous.)
- **Terminer Overseerr** — il se connecte avec Plex et découvre vos autres
  services.

Chaque invite dispose d'un lien **Ouvrir** qui vous amène directement au bon
endroit.

Une fois ces étapes terminées, tout est opérationnel.
