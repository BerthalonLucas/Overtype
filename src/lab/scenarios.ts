// Each entry opens in the Îlot journey, the app's default, unless it asks for the 0.4 one (`ui`).
export const scenarios = [
  {
    id: 'short',
    label: 'Traduction courte',
    issue: 'UI-003',
    expected:
      'Verre court de 380 px (huit lignes au plus) ouvert depuis la pilule d’attente ; Copier · ⋯ · Fermer ; texte #e8eaef 16/24 sur un seul graphite, sans reflet.',
  },
  {
    id: 'long',
    label: 'Traduction longue (lecteur)',
    issue: 'UI-021',
    expected:
      'Bande centrée en bas, moitié de la largeur de la zone (450 px ici), 22/33, hauteur au plus 45 % de l’écran puis défilement ; Copier · Épingler · ⋯ · Fermer ; aucun « Agrandir ».',
  },
  // The 0.4 journey, asked for (`ui`): the Îlot's wait is the working pill of the entries below.
  {
    id: 'pending',
    label: 'Attente du moteur (0.4)',
    issue: 'UI-023',
    ui: 'v4',
    expected:
      '0.4 (réglage caché uiVersion « v4 ») : pilule seule de 60 × 28 avec le spinner de shadcn (LoaderCircle 18 px, un tour par seconde), trait de progression après 1,5 s ; annulation possible ; le texte arrive d’un bloc. Dans l’Îlot, l’attente est la pilule de travail (entrées « Pilule de travail »).',
  },
  {
    id: 'partial',
    label: 'Réponse interrompue',
    issue: 'UI-003',
    expected: 'Texte partiel identifié ; copie et remplacement désactivés.',
  },
  {
    id: 'error',
    label: 'Erreur réseau',
    issue: 'UI-003',
    expected: 'Erreur courte, possibilité de réessayer et de fermer.',
  },
  {
    id: 'notice',
    label: 'Rien à traduire',
    issue: 'UI-020',
    expected:
      'Pilule seule à 13 px, « Rien à traduire dans la fenêtre active », aucune boîte de dialogue ; disparaît d’elle-même après quatre secondes (rejouée ici toutes les trois secondes).',
  },
  {
    id: 'settings',
    label: 'Réglages',
    issue: 'UI-005',
    expected: 'Surface cohérente sur toute la fenêtre ; thème Windows ; aucune marge blanche parasite.',
  },
  {
    id: 'history',
    label: 'Historique de démonstration',
    issue: 'UI-005',
    expected: 'Anciennes traductions accessibles et lisibles. Données fictives uniquement.',
  },
  // Îlot, lot 8 (docs/DA-PLAN.md §9 « Indicateurs »): the working pill in each indicator; the theme is the « Fond d’essai ».
  {
    id: 'working-perle',
    label: 'Pilule de travail · Perle',
    issue: 'Lot 8',
    expected:
      'Îlot : pilule de verre 44 × 28, rayon 14, vide pendant 250 ms puis la Perle (14 px, tour 3 s, respiration 0,9 ↔ 1 en 2,4 s) centrée, fondu 150 ms ; rien de textuel, la pilule ne grandit jamais ; orbe fixe en mouvements réduits.',
  },
  {
    id: 'working-nebuleuse',
    label: 'Pilule de travail · Nébuleuse',
    issue: 'Lot 8',
    expected:
      'Îlot : pilule 44 × 28, Nébuleuse 16 px (taches bleue, corail, ambre), mélange multiply en clair, screen en sombre ; après 250 ms, centrée.',
  },
  {
    id: 'working-ruban',
    label: 'Pilule de travail · Ruban',
    issue: 'Lot 8',
    expected:
      'Îlot : pilule 52 × 28 dès le départ (espace du Ruban 28 × 12 réservé), trois ondes bleue, corail, ambre, bords fondus ; après 250 ms, centré.',
  },
  {
    id: 'halo',
    label: 'Halo : mise en valeur du texte',
    issue: 'Îlot lot 6, choix du 25/09',
    expected:
      'phase=menu : la zone de texte cernée, une bande pâle par ligne entière, un calque sur le texte exact, immobiles. phase=work (défaut) : l’aurore tourne autour de la zone de texte, les bandes restent, un reflet de la couleur du fond passe sur les lettres d’une ligne à la suivante (1,8 s). phase=marks : une vague de lumière sur le nouveau texte (1 s), puis la lueur irisée sur les mots changés, plus profonde en clair. En animations réduites, tout est immobile (voile irisé fixe, pas de vague). La vraie fenêtre halo ne prend jamais un clic.',
  },
] as const;
export type Scenario = (typeof scenarios)[number]['id'];
export function scenarioFrom(value: string | null) {
  return scenarios.find((item) => item.id === value) ?? scenarios[0];
}

// The Îlot (lot 7), apart from the list above: visual-tests/ keeps a reference image of each entry
// of `scenarios`, in the 0.4 journey or the Îlot's. Theme, preset (smooth / bouncy) and motion are
// parameters of the frame.
export const ilotScenarios = [
  {
    id: 'ilot-compact',
    label: 'Îlot au repos',
    issue: 'Lot 7',
    expected:
      'Compact, 32 px de haut : dernière action (Entrée la relance) · pastille ✦. Tab, ↓ ou un survol de 450 ms déplient la grille ; F T P S E lancent ; 1-6 choisissent une tuile ; Espace ou / ouvrent la consigne ; une lettre libre ouvre la consigne déjà tapée ; Échap ferme. Un choix transforme l’Îlot en pilule (contenu factice), puis il revient.',
  },
  {
    id: 'ilot-grid',
    label: 'Îlot en grille',
    issue: 'Lot 7',
    expected:
      'Grille 3 × 2 de tuiles 66 × 50 (218 × 116, rayon 16), surbrillance sur la dernière action ; flèches, Tab, Entrée, lettres, chiffres ; Échap revient au compact, puis ferme.',
  },
  {
    id: 'ilot-prompt',
    label: 'Îlot : consigne libre',
    issue: 'Lot 7',
    expected:
      'Champ de 283 × 34 (saisie de 230) : un vrai champ, accents, AltGr et touches mortes compris ; Entrée envoie, Échap revient au compact. La consigne n’est affichée nulle part ailleurs.',
  },
  {
    id: 'ilot-injected',
    label: 'Îlot sans le clavier (repli natif)',
    issue: 'Lot 7',
    expected:
      'Les touches arrivent de Rust (menu-key) : boutons « Touche reçue » en bas. La consigne libre est indisponible, pastille et tuile estompées, Espace ignoré.',
  },
  {
    id: 'ilot-pill',
    label: 'Îlot → pilule',
    issue: 'Lot 7',
    expected:
      'La même surface, jamais démontée, devient la pilule de 44 × 28 (rayon 14) sur le ressort « morph », contenu centré ; bouton « Menu ⇄ pilule » en bas. Contenu factice : le vrai indicateur vient du lot 8.',
  },
] as const;
export type IlotScenario = (typeof ilotScenarios)[number]['id'];
export function ilotScenarioFrom(value: string | null) {
  return ilotScenarios.find((item) => item.id === value);
}

// The result pill (lots 9 and 10), apart as well: coche + Annuler, each family of errors, and
// what the halo will mark. Theme, preset and motion are parameters of the frame.
export const resultScenarios = [
  {
    id: 'result-done',
    label: 'Coche et Annuler',
    issue: 'Lot 9',
    expected:
      'Pilule de travail 44 × 28 (Perle après 250 ms), puis sur la même surface la coche tracée (260 ms après 80 ms) et Annuler avec son anneau de 8 s, en pause au survol et au focus ; à la fin la pilule part (les mots changés avec elle). Annuler : « Annulé » 0,9 s. Réduit : fondus seuls, coche d’un coup, anneau par pas d’une seconde.',
  },
  {
    id: 'result-error-config',
    label: 'Erreur de configuration',
    issue: 'Lot 10',
    expected:
      'Pilule d’erreur de 30 px : triangle rouge (#D14343, #FF8A80 en sombre), six mots au plus, un bouton qui ouvre le champ exact des Réglages (clé, adresse ou modèle), ✕. Même surface et même mouvement que la pilule de travail, sans secousse.',
  },
  {
    id: 'result-error-transient',
    label: 'Erreur passagère',
    issue: 'Lot 10',
    expected:
      'Serveur occupé, délai dépassé, erreur du serveur, réponse coupée : Réessayer relance le travail sur la même surface.',
  },
  {
    id: 'result-error-paste',
    label: 'Collage refusé',
    issue: 'Lot 10',
    expected:
      'Rien n’est remplacé : Copier le résultat, puis « Copié » à la même place, sans que la pilule grandisse, et elle part après 0,9 s.',
  },
  {
    id: 'result-error-content',
    label: 'Sélection inutilisable',
    issue: 'Lot 10',
    expected: 'Sélection trop longue, rien de sélectionné, champ protégé : le message et ✕, aucun bouton.',
  },
  {
    id: 'result-diff',
    label: 'Mots changés (calcul)',
    issue: 'Lot 9',
    expected:
      'Ce que le halo marquera : mot à mot pour Corriger, Pro et Raccourcir, bloc entier pour Traduire, Mail et la consigne libre, décidé par le diff pour une action créée. Bleu rgba(141,159,255,.32), 260 ms, tenu 8 s, fondu 900 ms.',
  },
] as const;
export type ResultScenario = (typeof resultScenarios)[number]['id'];
export function resultScenarioFrom(value: string | null) {
  return resultScenarios.find((item) => item.id === value);
}
