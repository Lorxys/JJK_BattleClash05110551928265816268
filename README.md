# JJK Battle Clash

Jeu perso en pixel art isométrique : on incarne **Satoru Gojo** sur une île flottante
(prairie, forêts, lacs, sanctuaires) et on exorcise des vagues de fléaux en
détruisant le décor.

Aucune dépendance, aucune image ni aucun son externe : tout est généré par le code.
Il suffit d'ouvrir `index.html` dans un navigateur (ou de passer par GitHub Pages).

## Commandes

| Touche | Action |
|---|---|
| ZQSD / flèches | Se déplacer |
| Souris | Viser |
| A / clic gauche | **Bleu** : aspire débris, arbres et fléaux puis les écrase |
| E / clic droit | **Rouge** : projectile qui explose, repousse tout et met le feu |
| A + E maintenus | **Violet** : Gojo réunit Bleu et Rouge, relâcher pour tirer |
| Rouge tiré dans un Bleu | **Violet** par fusion, depuis la position du Bleu |
| F | **Extension du territoire : Sphère de l'Infini** |
| Espace / Maj | Téléportation |
| Molette | Zoom |
| Échap | Pause |
| N | Nouvelle carte |
| M | Couper le son |
| H | Afficher / masquer l'aide |

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
- `js/audio.js` : bruitages synthétisés
- `js/main.js` : entrées, boucle de jeu, interface
