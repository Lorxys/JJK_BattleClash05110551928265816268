# JJK Battle Clash

Jeu perso pour téléphone (Android / iOS), en pixel art isométrique : on incarne
**Satoru Gojo** sur une île entourée par la mer
(prairie, forêts, cerisiers, lacs, sanctuaires) et on exorcise des vagues de fléaux en
détruisant le décor.

Aucune dépendance : le pixel art est généré par le code, les sons aussi tant que les
fichiers du dossier `audio/` ne sont pas fournis. Il suffit d'ouvrir `index.html`
dans le navigateur du téléphone (ou de passer par GitHub Pages). Sur ordinateur,
la souris fait office de doigt (pratique pour tester).

## Commandes tactiles

Le jeu se joue **à l'horizontale**. À la verticale, il se met en attente et demande
de tourner l'appareil.

| Geste | Action |
|---|---|
| Doigt sur la moitié gauche | Joystick : se déplacer |
| Toucher **Bleu** (attire et écrase) / **Rouge** (explose, met le feu) | Tir sur le fléau le plus proche |
| Glisser depuis Bleu / Rouge | Viser dans la direction du glissement (le Bleu va plus loin si on glisse plus) |
| Bleu + Rouge tenus ensemble, ou bouton Violet | Charger le **Violet**, relâcher pour tirer |
| Rouge tiré dans un Bleu | **Violet** par fusion, depuis la position du Bleu |
| Téléport | Téléportation vers le fléau le plus proche |
| Territoire | Extension du territoire |
| II | Pause |
| Haut-parleur | Couper / remettre le son |

**Installer comme une appli** (plein écran, sans barre du navigateur) :

- Android (Chrome) : menu ⋮ → *Ajouter à l'écran d'accueil*. L'écran est verrouillé
  à l'horizontale.
- iPhone / iPad (Safari) : bouton Partager → *Sur l'écran d'accueil*. iOS ne permet
  pas de verrouiller l'orientation : on tourne simplement le téléphone.

## Sons

Dépose les MP3 dans `audio/` avec les noms listés dans
[`audio/README.md`](audio/README.md). Chaque fichier présent remplace le son généré.

## Règles

- **Énergie occulte** : chaque technique en consomme, elle se recharge seule.
- **Infinité** (passive) : les coups des fléaux sont arrêtés net, mais cela coûte de
  l'énergie. Plus d'énergie = plus d'Infinité, et les PV encaissent.
- **Extension du territoire** : la jauge se remplit en exorcisant des fléaux.
  Pendant 10 s, les fléaux dans la sphère sont figés et rongés, et Gojo lance ses
  techniques sans énergie et trois fois plus vite.
- **Fléaux** : Larve (rapide, mord), Œil (flotte, tire à distance),
  Colosse (lent, écrase les arbres, frappe le sol). Ils arrivent par vagues.

## Le décor réagit

- **Feu** : le Rouge enflamme l'herbe, les fleurs et les arbres ; le feu se propage,
  carbonise la forêt et brûle les fléaux. Le Bleu aspire les flammes et les éteint.
- **Eau** : un cratère ou une tranchée qui touche un lac se remplit d'eau. Les fléaux
  qui marchent s'y noient, le Rouge la fait bouillir, Gojo marche dessus.
- **Objets projetés** : les arbres et rochers en vol blessent les fléaux qu'ils percutent.
- **Sanctuaires** : torii et lanternes destructibles (une lanterne brisée met le feu).

## Options d'URL

`?seed=42` carte précise · `?demo` Gojo joue tout seul · `?debug` FPS dans la console ·
`?sim=30` avance de 30 s de jeu d'un coup (tests)

## Structure

- `js/util.js` : constantes, projection isométrique, bruit, tampon de pixels
- `js/sprites.js` : génération du pixel art
- `js/world.js` : carte, relief, lacs, sanctuaires, destruction, inondation
- `js/fire.js` : propagation du feu
- `js/particles.js` : débris, étincelles, fumée, objets projetés
- `js/abilities.js` : Bleu, Rouge, Violet, téléportation
- `js/curses.js` : fléaux, IA, vagues
- `js/domain.js` : extension du territoire
- `js/player.js` : déplacements, vie, énergie, Infinité
- `js/render.js` : rendu isométrique
- `js/audio.js` : sons (fichiers de `audio/`, sinon bruitages synthétisés)
- `js/touch.js` : commandes tactiles, plein écran, orientation
- `js/main.js` : boucle de jeu, interface
- `audio/` : musiques et bruitages (MP3) · `icons/` + `manifest.json` : installation mobile
