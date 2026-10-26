# JJK Battle Clash

Jeu perso en pixel art isométrique : on incarne **Satoru Gojo** dans une grande prairie
et on détruit le décor avec ses techniques.

Aucune dépendance, aucune image externe : tout le pixel art est généré par le code.
Il suffit d'ouvrir `index.html` dans un navigateur (ou de passer par GitHub Pages).

## Commandes

| Touche | Action |
|---|---|
| ZQSD / flèches | Se déplacer |
| Souris | Viser |
| A / clic gauche | **Bleu** : aspire débris et arbres puis les écrase |
| E / clic droit | **Rouge** : projectile qui explose et repousse tout |
| R (maintenir puis relâcher) | **Violet** : sphère qui efface tout sur son passage |
| Espace / Maj | Téléportation |
| Molette | Zoom |
| N | Nouvelle carte |
| M | Couper le son |
| H | Afficher / masquer l'aide |

**Infinité** (passive) : les débris qui s'approchent de Gojo ralentissent et restent en suspension.

Options d'URL : `?seed=42` pour une carte précise, `?demo` pour que Gojo joue tout seul.

## Structure

- `js/util.js` : constantes, projection isométrique, bruit, tampon de pixels
- `js/sprites.js` : génération du pixel art (Gojo, tuiles, arbres, rochers)
- `js/world.js` : carte, relief, destruction du terrain et des objets
- `js/particles.js` : débris, étincelles, objets projetés
- `js/abilities.js` : Bleu, Rouge, Violet, téléportation
- `js/player.js` : déplacements et Infinité
- `js/render.js` : rendu isométrique
- `js/audio.js` : bruitages synthétisés
- `js/main.js` : entrées, boucle de jeu, interface
