# Comment mettre à jour Ensembler

Cette page concerne la mise à jour d'**Ensembler lui-même** — l'application.
(Pour maintenir vos *services* comme Sonarr et Plex à jour, voir **Gérer vos
services → Maintenir les services à jour**.)

## Comment savoir qu'une mise à jour est disponible

Ensembler vérifie de temps en temps si une version plus récente a été publiée,
et affiche un petit avis sur le tableau de bord lorsqu'une mise à jour est
disponible. Vous pouvez aussi vérifier à tout moment dans **Réglages → Général →
Vérifier les mises à jour**.

Ensembler n'installe jamais une nouvelle version tout seul — la mise à jour est
une petite étape manuelle, et le principe est le même sur toutes les
plateformes : **téléchargez la dernière version et ouvrez-la**. Vos services et
vos réglages sont laissés totalement intacts.

## Mettre à jour

1. Ouvrez la **[page des versions](https://github.com/garethhallnz/ensembler/releases)**
   (l'avis de mise à jour y renvoie directement).
2. Téléchargez le fichier correspondant à votre système, puis installez-le
   par-dessus votre copie actuelle :

   - **macOS** — téléchargez le `.dmg`, ouvrez-le et glissez **Ensembler** dans
     votre dossier **Applications**, en remplaçant l'ancienne version. La
     première fois que vous ouvrez la nouvelle version, faites un clic droit (ou
     Contrôle-clic) sur l'application et choisissez **Ouvrir**.
   - **Windows** — téléchargez le `.exe` et exécutez-le. Il s'installe par-dessus
     votre version existante. Si Windows affiche un écran « Windows a protégé
     votre ordinateur », cliquez sur **Informations complémentaires → Exécuter
     quand même**.
   - **Linux** — téléchargez le nouveau `.AppImage` et remplacez l'ancien. Vous
     devrez peut-être le rendre à nouveau exécutable (clic droit → **Propriétés →
     Permissions**, ou `chmod +x` dans un terminal).

3. Ouvrez Ensembler. C'est tout — vos services continuent de fonctionner pendant
   toute l'opération, et tous vos réglages sont exactement tels que vous les avez
   laissés.

## Désactiver l'avis

Si vous préférez ne pas voir d'avis de mise à jour, désactivez **Réglages →
Général → Notifications de mise à jour**. Vous pouvez toujours vérifier
manuellement quand vous le souhaitez avec le bouton **Vérifier les mises à
jour**.

> **Pourquoi la mise à jour est manuelle :** cela garde Ensembler simple et
> cohérent sur macOS, Windows et Linux, et fait que l'application ne se modifie
> jamais dans votre dos. Vos fichiers multimédias ne sont jamais affectés par une
> mise à jour.
