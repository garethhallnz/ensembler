# Qu'est-ce qu'Ensembler ?

Ensembler installe et fait fonctionner pour vous un **centre multimédia
domestique** — la fameuse pile « *arr » (Sonarr, Radarr, Prowlarr et compagnie)
ainsi qu'un serveur multimédia comme Plex ou Jellyfin — sans que vous ayez
besoin de connaître Docker, YAML ou la ligne de commande.

Vous choisissez les services que vous voulez, Ensembler les installe, les
démarre, les relie entre eux et vous offre un tableau de bord unique pour tout
gérer.

## Comment ça fonctionne

En coulisses, chaque service tourne dans son propre **conteneur Docker**.
Ensembler génère la configuration Docker, démarre les conteneurs et les connecte
les uns aux autres pour qu'ils fonctionnent comme un seul système. Vous n'avez
jamais à toucher un fichier de configuration.

Le parcours habituel est le suivant :

1. **Assistant de configuration** — choisissez vos services, indiquez à
   Ensembler l'emplacement de vos dossiers multimédias, puis cliquez sur
   **Appliquer**. Les ports sont vérifiés pour vous, et des ports libres sont
   choisis automatiquement si un port par défaut est déjà pris.
2. **Câblage automatique** — Sonarr et Radarr reçoivent leur client de
   téléchargement et leurs dossiers, Prowlarr s'y relie, les serveurs
   multimédias reçoivent les notifications d'import, et ainsi de suite. Vous
   voyez chaque étape se terminer.
3. **Tableau de bord** — dès lors, vous gérez tout depuis un seul endroit :
   ouvrir un service, le démarrer/l'arrêter, vérifier les mises à jour ou
   ajouter d'autres services.

## Ce que font les services

| Service | Rôle |
|---|---|
| **Sonarr** | Gère vos séries TV |
| **Radarr** | Gère vos films |
| **Bazarr** | Gère les sous-titres pour Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Diffusent vos médias sur vos appareils |
| **Transmission / Deluge** | Clients de téléchargement |
| **Prowlarr / Jackett** | Gèrent où vos services recherchent du contenu |
| **Overseerr** | Demander et découvrir des médias |

## Ce qu'Ensembler fait — et ne fait pas

Ensembler **relie vos services entre eux**. Il ne sélectionne, ne demande ni ne
télécharge **aucun** contenu, et il ne configure **pas** les indexeurs ou les
trackers à votre place. Vous choisissez vos propres sources et vous êtes
responsable de la façon dont vous les utilisez.
