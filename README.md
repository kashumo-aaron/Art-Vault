# 🎨 ArtVault - Explorateur de Fichiers Artistique (PWA)

**ArtVault** est un explorateur de fichiers artistique conçu spécialement pour stocker, organiser et structurer vos références visuelles et inspirations, sans aucune dépendance à un serveur ou à des frameworks complexes. 

Ce projet est une **PWA (Progressive Web App)** moderne, rapide, élégante et entièrement fonctionnelle hors ligne. L'ensemble de ses données est stocké localement dans votre navigateur via **IndexedDB**.

---

## ✨ Caractéristiques principales

- **📂 Structure de type Windows Explorer** : Une véritable navigation dans des dossiers et sous-dossiers illimités. Le fil d'ariane (breadcrumb) et le bouton retour vous permettent de vous repérer instantanément.
- **📁 Dossiers automatiques intelligents** : Lors de la création d'un projet, des dossiers thématiques adaptés à sa nature (Bande dessinée, Character Design, Environnement) sont générés automatiquement pour structurer vos références.
- **🖼️ Gestion d'images fluide** : Importez vos images par simple glisser-déposer ou via sélection. Deux modes de visualisation sont disponibles : une grille classique structurée ou une grille d'affichage dynamique de style Pinterest (Masonry).
- **🔍 Recherche instantanée** : Recherchez à tout moment vos projets, dossiers et images.
- **🗑️ Système de Corbeille sécurisé** : Ne perdez jamais vos fichiers par accident. Les éléments supprimés sont déplacés vers la Corbeille, d'où ils peuvent être restaurés dans leur dossier d'origine ou supprimés définitivement.
- **📊 Tableau de bord interactif** : Suivez le nombre total de vos projets, dossiers et images. Retrouvez en un clic le dernier projet ouvert ou la dernière image ajoutée.
- **💾 Sauvegarde complète & Restauration** : Exportez l'intégralité de votre bibliothèque (images incluses en base64) dans un fichier JSON local. Restaurez-la à tout moment.
- **🌗 Design Neumorphique moderne** : Interface soignée neumorphique avec mode clair (tons doux et ombres légères) et mode sombre (bleu profond et accents lumineux).
- **📱 Responsive & PWA** : Totalement adapté aux téléphones et tablettes avec une barre de navigation inférieure moderne. Installable sur votre écran d'accueil et accessible hors ligne.
- **⚙️ Sans Backend, compatible GitHub Pages** : Se lance par simple double-clic sur `index.html`.

---

## 🛠️ Architecture du projet

Le projet est conçu avec du code propre, simple et commenté, idéal pour les débutants. Aucun compilateur, bundler ou framework (React, Vue, Next.js, PHP, etc.) n'est requis.

```text
ArtVault/
├── index.html          # Structure de l'application & Modals
├── manifest.json       # Manifeste PWA pour l'installation sur mobile/PC
├── service-worker.js   # Script de mise en cache pour le support hors ligne
├── README.md           # Documentation du projet
├── css/
│   └── style.css       # Système de design Neumorphique & Grille Pinterest
├── js/
│   ├── database.js     # Gestion de la base de données IndexedDB (CRUD)
│   ├── projects.js     # Gestion des projets et création de dossiers auto
│   ├── folders.js      # Navigation des dossiers, breadcrumbs et déplacements
│   ├── gallery.js      # Import d'images, affichage et Lightbox interactive
│   └── app.js          # Coordinateur principal (navigation, thèmes, PWA, Sauvegarde, Corbeille)
└── icons/
    └── icon.svg        # Icône artistique et émotionnelle de l'application
```

---

## 🚀 Comment lancer le projet en développement ?

Il n'y a **aucun serveur à installer**.

1. Clonez ou téléchargez ce dossier sur votre ordinateur.
2. Double-cliquez sur le fichier `index.html` pour l'ouvrir directement dans votre navigateur internet préféré.
3. C'est tout ! L'application est prête à fonctionner.

*Note relative aux PWA : Les navigateurs exigent un contexte sécurisé (HTTPS ou localhost) pour permettre l'installation d'une PWA et l'activation du Service Worker. Pour tester ces fonctionnalités PWA de manière optimale, vous pouvez ouvrir le dossier à l'aide d'une extension de serveur local (comme "Live Server" sur VS Code) ou en le déployant sur GitHub Pages.*

---

## 🎨 Conception de l'icône et Génération PWA intelligente

Conformément aux exigences, l'icône d'ArtVault (`icons/icon.svg`) représente un **coffre-fort artistique et émotionnel** :
- Un fond bleu nuit profond.
- Un arche néon lumineux protégeant l'intérieur.
- Des coups de pinceaux colorés et expressifs (rose magenta, bleu cyan, jaune doré) s'entremêlant au centre pour symboliser la créativité humaine.

### Résolution du défi des fichiers binaires PNG :
Pour que le manifeste PWA dispose des fichiers PNG réglementaires (`icon-192.png` et `icon-512.png`) sans alourdir le dépôt avec des fichiers binaires :
1. Au premier démarrage, l'application utilise un élément `<canvas>` masqué pour dessiner numériquement l'icône artistique à haute résolution.
2. Elle convertit ces rendus en Blobs PNG.
3. Elle les insère directement dans le stockage de cache de PWA du navigateur.
4. Le **Service Worker** intercepte les requêtes vers `icons/icon-192.png` et `icons/icon-512.png` et renvoie instantanément ces Blobs générés !
Cela garantit une PWA parfaitement conforme et installable sur tous les systèmes, tout en gardant le code 100% lisible et éditable.

---

## 🌍 Déploiement sur GitHub Pages

Le projet est conçu pour fonctionner parfaitement avec GitHub Pages :
1. Créez un dépôt public sur GitHub.
2. Envoyez-y l'intégralité des fichiers de ce projet.
3. Allez dans les **Settings** (Paramètres) du dépôt > **Pages**.
4. Sous **Build and deployment**, sélectionnez la branche `main` (ou `master`) et le dossier `/root`, puis validez.
5. Votre ArtVault personnel est en ligne ! Grâce au Service Worker, vous pourrez y accéder et l'installer même sans connexion internet.

---

## 💡 Conseils pour les débutants qui souhaitent modifier le code

- **Ajouter un type de projet** : Ouvrez `js/projects.js` et ajoutez simplement votre type dans le tableau `types` de l'objet `ArtVaultProjects`.
- **Ajouter des dossiers automatiques** : Dans `js/projects.js`, localisez l'objet `autoFolders` et ajoutez une clé correspondant au type de projet avec la liste des noms de dossiers souhaités.
- **Modifier le style neumorphique** : Ouvrez `css/style.css` et ajustez les variables `--shadow-out` (pour les éléments sortants) ou `--shadow-in` (pour les éléments enfoncés). Les ombres se recalculent automatiquement !
- **Changer la taille maximale des images** : Dans `js/gallery.js`, modifiez la valeur de `15 * 1024 * 1024` dans la fonction `importImages` pour augmenter ou diminuer la taille acceptée (exprimée en octets).
