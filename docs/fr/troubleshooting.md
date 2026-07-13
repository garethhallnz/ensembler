# Dépannage

## « Docker est requis » / Docker n'est pas en cours d'exécution
Ensembler a besoin d'un environnement d'exécution de conteneurs en cours de
fonctionnement. Si vous utilisez **Docker Desktop**, démarrez-le et attendez
qu'il indique qu'il est en cours d'exécution (et pas simplement installé), et
Ensembler continuera. S'il n'est pas installé, suivez le lien de téléchargement
sur cet écran. Vous utilisez une alternative comme **OrbStack** ou **Podman** ?
C'est parfait aussi — assurez-vous simplement qu'elle est en cours d'exécution
et que `docker` et `docker compose` fonctionnent.

## Un service ne démarre pas
- Ouvrez le **menu ⋯ → Voir les journaux** du service pour voir ce dont il se
  plaint.
- Essayez le **menu ⋯ → Redémarrer**.
- Les notifications d'import et les analyses de bibliothèque peuvent prendre une
  minute pendant que les services finissent de démarrer, alors laissez-lui un
  moment après le premier lancement.

## Un avertissement concernant la mémoire Docker ou l'espace disque
Ensembler vous avertit lorsque Docker dispose de peu de mémoire allouée ou que
le disque multimédia est presque plein — les deux raisons invisibles les plus
courantes d'un mauvais fonctionnement des services.
- **Mémoire :** augmentez-la dans les réglages de votre environnement
  d'exécution de conteneurs (Docker Desktop → Settings → Resources) ; 4 Go ou
  plus est une bonne base pour quelques services.
- **Disque :** libérez de l'espace sur le disque qu'utilisent vos
  téléchargements/médias, ou orientez les services vers un disque plus grand
  depuis leur écran **Configurer**.

## Avertissement « Non sécurisé » lorsque j'ouvre un service
Les services s'ouvrent désormais **dans Ensembler** sous forme d'onglets, vous
ne devriez donc pas voir cela. Cela n'apparaît que si vous utilisez le
**menu ⋯ → Ouvrir dans le navigateur** d'un service (ou si vous exécutez
Ensembler dans un navigateur web). Les services locaux fonctionnent sur
`http://localhost`, que les navigateurs étiquettent « Non sécurisé » — pour un
service sur votre propre machine, c'est attendu et sans danger ; vos données ne
quittent pas votre ordinateur.

## Un port est déjà utilisé
Ensembler vérifie les ports lors de la configuration et en choisit
automatiquement un libre si un port par défaut est pris, c'est donc rare. Si un
service refuse malgré tout de se lier, une autre application a peut-être accaparé
son port — arrêtez cette application, ou changez le port depuis l'écran
**Configurer** du service.

## Où sont mes données ?
- **La configuration de l'application** se trouve dans un dossier caché propre à
  chaque utilisateur (voir *Gérer vos services → Où se trouvent vos réglages*).
  Vous n'avez pas besoin de la modifier.
- **Vos médias** restent là où vous les avez choisis lors de la configuration et
  ne sont jamais déplacés ni supprimés par Ensembler.

## Quelque chose est vraiment bloqué — repartir de zéro
**Réglages → Zone de danger → Tout réinitialiser** arrête et supprime tous les
services ainsi que leurs réglages et ramène Ensembler à un état propre. **Vos
fichiers multimédias ne sont pas affectés** — seuls les services et leur
configuration sont supprimés. Vous repasserez ensuite par l'assistant de
configuration.

## Toujours bloqué ?
Récupérez les détails depuis **Voir les journaux** d'un service et depuis le
panneau **Diagnostics** en bas du tableau de bord — ce sont les éléments les
plus utiles à inclure lorsque vous signalez un problème.
