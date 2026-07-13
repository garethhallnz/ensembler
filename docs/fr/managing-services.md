# Gérer vos services

Tout se passe sur le **tableau de bord**. Chaque service dispose d'une carte
affichant son état et les actions que vous pouvez effectuer.

## Cartes de service

- Une **pastille d'état** colorée vous indique l'état d'un coup d'œil :
  - **vert — En cours d'exécution**
  - **gris — Arrêté**
  - **ambre — Configuration requise** ou **Nécessite votre attention**
- **Ouvrir** ouvre le service **dans Ensembler sous forme d'onglet** — pas de
  navigateur séparé, et pas d'avertissement « Non sécurisé ». Une barre en haut
  vous permet de basculer entre le **Tableau de bord** et les services ouverts,
  et de fermer un onglet avec son **✕**. Elle comporte aussi un bouton de
  **rechargement** et un bouton d'**ouverture dans le navigateur** pour le
  service actuel.
- Une petite **version** apparaît sur chaque carte en cours d'exécution. Un
  **cadenas 🔒** signifie que le service est épinglé à une version précise ; le
  marqueur **↻** signifie qu'il suit la dernière version. Il devient ambre
  lorsqu'une mise à jour est disponible.
- Le **menu ⋯** contient le reste : **Ouvrir dans le navigateur**,
  **Démarrer / Arrêter**, **Redémarrer**, **Voir les journaux**, **Vérifier les
  mises à jour** et **Configurer**.

Pendant qu'un service démarre ou s'arrête, l'état affiche brièvement
« Démarrage… / Arrêt… » pour que vous sachiez qu'il se passe quelque chose.

## Ajouter et supprimer des services

- **Ajouter un service** (en haut de la section Services) vous permet d'ajouter
  tout ce que vous n'avez pas choisi lors de la configuration.
- Pour supprimer un service, ouvrez son **menu ⋯ → Configurer**.

## Maintenir les services à jour

- Ensembler vérifie discrètement en arrière-plan, de sorte que les mises à jour
  disponibles apparaissent d'elles-mêmes. Vous pouvez aussi cliquer sur
  **Vérifier les mises à jour** (en haut de la section Services) pour tout
  vérifier maintenant, ou vérifier un seul service via son **menu ⋯ → Vérifier
  les mises à jour** (le résultat s'affiche sur la carte).
- Lorsque des mises à jour sont disponibles, l'en-tête Services indique combien,
  et un bouton **Tout mettre à jour** les applique d'un seul coup. Pour n'en
  mettre à jour qu'une, cliquez sur **Mise à jour disponible — mettre à jour
  maintenant** sur sa carte. Vos réglages sont préservés.
- **Épingler une version.** Par défaut, chaque service suit la dernière version.
  Pour en maintenir un à une version précise, ouvrez **menu ⋯ → Configurer** et
  choisissez dans le menu déroulant **Version**. Les services épinglés affichent
  un 🔒 et cessent de proposer des mises à jour.
- **Mises à jour automatiques.** Activez **Réglages → Mises à jour → Installer
  les mises à jour automatiquement** pour qu'Ensembler applique les mises à jour
  disponibles en arrière-plan. C'est désactivé par défaut, vous gardez donc le
  contrôle.

## Réglages

Ouvrez les **Réglages** (en haut à droite) pour les options applicables à toute
l'application :

- **Apparence** — Clair, Sombre ou Système (suit votre système d'exploitation).
- **Général** — garder Ensembler dans la barre de menus / la zone de
  notification lorsque vous fermez la fenêtre (activé par défaut) pour qu'il soit
  accessible en un clic. Vos services continuent de fonctionner dans les deux
  cas ; utilisez **Quitter** dans le menu de la zone de notification pour quitter
  complètement.
- **Mises à jour** — activez les mises à jour automatiques en arrière-plan pour
  vos services (désactivé par défaut).
- **Environnement** — fuseau horaire et identifiants utilisateur/groupe utilisés
  pour les permissions de fichiers.
- **Zone de danger → Tout réinitialiser** — arrête et supprime tous les services
  ainsi que leurs réglages, ramenant Ensembler à une installation neuve. **Vos
  fichiers multimédias ne sont jamais touchés** — seuls les services et leur
  configuration sont supprimés.

## Où se trouvent vos réglages

Ensembler stocke sa configuration dans un dossier caché propre à chaque
utilisateur (géré pour vous — vous ne devriez pas avoir besoin de le modifier) :

- **macOS :** `~/Library/Application Support/Ensembler`
- **Windows :** `%APPDATA%\Ensembler`
- **Linux :** `~/.config/Ensembler`

Vos **fichiers multimédias** (séries TV, films, téléchargements) se trouvent là
où vous les avez choisis lors de la configuration et sont distincts de cela.

## Diagnostics

En bas du tableau de bord, le panneau **Diagnostics** (replié par défaut)
affiche l'état technique — si Docker est en cours d'exécution, combien de
services sont actifs, etc. Vous n'en aurez normalement pas besoin, mais il est
pratique pour le dépannage.
