# Jalon atelier UI — 9 septembre 2026

> Document historique (atelier UI, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

## Vérifié

- Build TypeScript/Vite réussi ; dist contient l’entrée de production, pas lab.html/lab-frame.html.
- 7 tests unitaires réussis.
- 40 tests d’interaction réussis, dont 4 nouveaux pour relecture, attente annulable,
  réponse interrompue non copiable et isolation de l’historique fictif.
- 17 scénarios visuels / 19 captures de référence générées puis comparées avec succès.
- Après ajustement de l’accès direct à l’historique : nouvelle capture des deux fonds
  et tests de l’atelier rejoués.
- Atelier ouvert dans Codex ; capture de l’atelier et historique examinés.
- Enregistrement du parcours du lecteur généré par ui:motion, dans release/material-preview.
  Ce fichier est un support de revue, pas une mesure de fluidité.
- ui:native exécuté contre l’exécutable installé 0.1.5 : connexion à sa vraie WebView2,
  texte de démo complet, menu ouvert, disparition du DOM après Fermer.
  Le lanceur ferme son propre processus en sortie ; aucune instance de test ne reste ouverte.

## Limites

- Capture Windows Computer Use noire ; reprise échouée avec GetCursorPos / 0x80070005.
- Dépoli sur le bureau, focus, capture de sélection, clic extérieur, déplacement,
  moniteurs/DPI et temps de trame natifs non validés par ce jalon.
- Aucun correctif de capsule au survol livré ; aucun changement Rust ni réinstallation.
- La direction visuelle reste à implémenter. Les références initiales conservent les défauts.
- Pas d’agent Claude Code/Fable lancé.

## Prochain correctif

UI-001 : reproduire et éliminer la surface résiduelle dans une instance de développement,
avec la capture WebView2 désormais disponible et une preuve native complémentaire.
Puis UI-002 : construire repos/survol/menu de la capsule dans le même atelier.
