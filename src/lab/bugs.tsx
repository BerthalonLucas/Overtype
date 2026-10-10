import { useState } from 'react';
import './bugs.css';

const defects = [
  {
    id: 'settings',
    title: 'Marges blanches des réglages',
    code: 'UI-005a',
    scope: 'Web + Windows',
    image: 'settings-reported.png',
    observed: 'Le panneau sombre est entouré de grandes bandes blanches quand la fenêtre est élargie.',
    steps: [
      'Afficher les réglages en 960 × 450.',
      'Observer les bords gauche et droit, puis passer à 620 × 640.',
      'Le fond doit couvrir toute la fenêtre, sans modifier la largeur de lecture.',
    ],
    cause:
      'Le fond est défini sur .settings-window (620 px maximum). Le document autour reste transparent et laisse apparaître le fond blanc de la WebView.',
    boundary:
      'Cette reproduction utilise les réglages réels, sans thème ni fond de démonstration. Elle ne valide pas la barre de titre Windows.',
    scenario: 'settings',
  },
  {
    id: 'residual',
    title: 'Grand rectangle gris résiduel',
    code: 'UI-001',
    scope: 'Windows uniquement',
    image: 'residual-reported.png',
    observed: 'Une grande surface grise reste visible au-dessus de la capsule, même sans texte.',
    steps: [
      'Lancer la vraie fenêtre Tauri en démo.',
      'Afficher une traduction, ouvrir puis fermer le menu, fermer la traduction.',
      'Contrôler la visibilité des fenêtres natives et leur composition sur le bureau.',
    ],
    cause:
      'Établie pour la fermeture : host::show affiche le HWND via SetWindowPos(SWP_SHOWWINDOW) sans passer par Tao, dont le cache de visibilité rend ensuite window.hide() sans effet. Correctif host::hide (ShowWindow SW_HIDE au niveau HWND, sans repasser par Tao dont le rebuild des styles rétablit WS_CAPTION). La composition du fond gris sur le bureau n’est pas encore mesurée.',
    boundary:
      'Le probe natif (npm run ui:native) prouve la fermeture des HWND sur trois cycles ; il ne mesure ni le dépoli ni un éventuel résidu de composition. Dessiner un rectangle gris en CSS ne reproduirait pas ce défaut.',
    scenario: null,
  },
  {
    id: 'hover',
    title: 'La capsule ne se replie pas',
    code: 'UI-002a',
    scope: 'Comportement manquant',
    image: 'overlay-reported.png',
    observed:
      'Les commandes restent affichées ; le petit trait au repos et le déploiement au survol ne sont pas implémentés.',
    steps: [
      'Survoler la capsule actuelle.',
      'Éloigner la souris.',
      'Constater que les commandes restent affichées : il n’existe pas encore de transition repos/survol.',
    ],
    cause:
      'Sans objet depuis l’Îlot : la fenêtre capsule est retirée (docs/DA-PLAN.md §4.2, lot 6). Défaut conservé pour mémoire.',
    boundary: 'Plus de reproduction : la capsule n’existe plus dans l’application.',
    scenario: null,
  },
  {
    id: 'drag',
    title: 'Déplacement et focus',
    code: 'UI-002b',
    scope: 'Windows uniquement',
    image: 'overlay-reported.png',
    observed:
      'Déplacement impossible rapporté sur les premières versions. Le comportement de la version installée doit être revérifié.',
    steps: [
      'Lancer une traduction dans la vraie application.',
      'Faire glisser une zone non interactive, puis ouvrir le menu.',
      'Mesurer la position avant/après ; vérifier la sélection et le focus de la source.',
    ],
    cause:
      'Non établie pour la version actuelle. Dans un navigateur, le pont de déplacement est simulé : cela ne teste pas le déplacement de la fenêtre.',
    boundary:
      'À vérifier nativement. Un composant que l’on déplace dans une page web ne validerait pas cette correction.',
    scenario: null,
  },
  {
    id: 'band',
    title: 'Bandeau « FlowTranslate » sur le verre',
    code: 'UI-016',
    scope: 'Windows uniquement',
    image: 'band-reported.png',
    observed:
      'À l’ouverture des Réglages ou quand une autre fenêtre prend le focus, une barre de titre basique apparaît en haut de la bulle et y reste.',
    steps: [
      'Lancer la vraie application, afficher une traduction.',
      'Ouvrir les Réglages depuis le menu, ou cliquer dans une autre fenêtre.',
      'Observer le haut de la bulle : aucune barre de titre ne doit apparaître, ni maintenant ni au retour du focus.',
    ],
    cause:
      'Établie le 13/09/2026 (release/ui-evidence/band-repro) : le style du HWND ne change pas ; Tao transmet WM_NCACTIVATE à DefWindowProc, qui repeint une barre de titre dans la surface de la fenêtre, avec ou sans WS_CAPTION, et rien ne la repeint avant un redimensionnement. Le même message avec lParam = -1 ne peint rien. Correctif : sous-classe du HWND (host::silence_frame) qui répond WM_NCACTIVATE avec lParam = -1 et ignore WM_NCPAINT.',
    boundary:
      'Le probe natif (npm run ui:native) envoie WM_NCACTIVATE(FALSE) à la fenêtre et compare la bande haute avant/après. Une page web ne possède pas de cadre Windows : rien à reproduire ici.',
    scenario: null,
  },
  {
    id: 'reader',
    title: '« Agrandir » ne sert à rien',
    code: 'UI-021',
    scope: 'Web + Windows',
    image: 'grace-reported.png',
    observed:
      'Un long texte arrivait dans une bulle de 300 px, trois ou quatre mots par ligne sur un 27", et il fallait ouvrir le menu pour l’agrandir.',
    steps: [
      'Traduire un texte de plus de huit lignes.',
      'Regarder le bas de l’écran : une bande centrée, moitié de la largeur de la zone de travail (480 px dans ce cadre de 960), texte à 22 px sur 33.',
      'Ouvrir le menu ⋯ : ni « Agrandir » ni « Réduire » ; Copier, Épingler, ⋯ et Fermer dans la pilule.',
    ],
    cause:
      'La forme est décidée une fois, sur le vrai résultat mesuré hors écran à 380 px : huit lignes au plus, verre court près de la sélection ; au-delà, lecteur en bande (src/layout.ts : readerMetrics prend la moitié de la largeur et 45 % de la hauteur de l’écran fourni par Rust, jamais une valeur en dur).',
    boundary:
      'Ce cadre tient lieu d’écran : la bande fait la moitié de sa largeur. L’écran réel, son échelle DPI et le suivi de la souris d’un écran à l’autre ne se vérifient que dans l’application.',
    scenario: 'long',
  },
  {
    id: 'duration',
    title: 'La bulle reste trop longtemps',
    code: 'UI-022',
    scope: 'Web + Windows',
    image: 'grace-reported.png',
    observed:
      'Après lecture, le verre restait puis se repliait en onglet ; Lucas veut qu’il s’efface de lui-même, « juste assez longtemps pour être lisible ».',
    steps: [
      'Lire la traduction courte en la survolant au moins une seconde, puis éloigner la souris.',
      'Compter : le verre s’assombrit au plus quatre secondes après le départ, puis disparaît.',
      'Revenir dessus pendant l’assombrissement : il revient à 100 % et accorde cinq secondes ; molette, clic ou touche remettent tout le budget.',
    ],
    cause:
      'Budget de lecture estimé (1 s + 350 ms par mot, entre 5 s et 30 s pour le verre court, 90 s pour le lecteur, réglable ×0,7 · ×1 · ×1,5 · jamais), raccourci à 4 s après une visite et une sortie, jamais moins de 2,5 s ; sortie en deux temps (55 % en 600 ms, 1,4 s, fondu 300 ms). Plus d’onglet ni de repli.',
    boundary:
      'Le budget et l’assombrissement se voient ici. La proximité mesurée nativement (glass-near) et la libération d’Échap pendant l’assombrissement (overlay_dimming) ne se vérifient que par le pont IPC et l’application.',
    scenario: 'short',
  },
  {
    id: 'loading',
    title: 'Chargement en anneau dans une grande fenêtre',
    code: 'UI-023',
    scope: 'Web + Windows',
    image: 'overlay-reported.png',
    observed:
      'Pendant l’inférence, une bulle entière s’ouvrait pour un simple anneau ; Lucas veut « des pointillés qui sautent » dans un petit encart.',
    steps: [
      'Lancer une traduction dont le moteur ne répond pas.',
      'Une pilule de verre seule de 44 × 28 (52 × 28 pour le Ruban), là où la pilule d’actions se posera : vide pendant 250 ms, puis l’indicateur choisi dans les Réglages (la Perle par défaut) ; rien de textuel, la pilule ne grandit jamais.',
      'Échap annule. Le parcours 0.4 (réglage caché uiVersion « v4 ») garde sa pilule de 60 × 28 et le spinner de shadcn, avec un trait de progression après 1,5 s.',
    ],
    cause:
      'Le verre n’existe plus avant le résultat : la pilule d’attente est publiée seule à Rust, qui ancre l’empreinte du futur verre (frame) et non la pilule ; le verre court s’ouvre depuis cette ligne (clip-path 260 ms), la bande monte de 8 px en fondu. Depuis l’Îlot (lot 8), cette pilule est la pilule de travail.',
    boundary:
      'La pilule et son indicateur se voient ici ; le parcours 0.4 dans le même cadre avec ui=v4. La réservation de la fenêtre native et l’ouverture sans second placement se vérifient par le pont IPC.',
    scenario: 'pending',
  },
  {
    id: 'screens',
    title: 'La bande du bas suit la souris d’un écran à l’autre',
    code: 'UI-024',
    scope: 'Windows uniquement',
    image: 'overlay-reported.png',
    observed:
      '« Si la souris est sur l’écran X, l’overlay est sur l’écran X, et si la souris se déplace vers l’écran Y, l’overlay revient sur l’écran Y. » Une bande ouverte sur un écran restait là quand la souris passait sur l’autre.',
    steps: [
      'Ouvrir un lecteur (texte long) avec la souris sur l’écran principal.',
      'Déplacer la souris sur un autre écran : la bande s’y déplace, à la moitié de sa largeur, en bas au centre.',
      'Revenir : elle revient. Un verre court ancré à sa sélection ne suit jamais.',
    ],
    cause:
      'Le sondeur du curseur (host::start_hit_tester, 8 ms) relève MonitorFromPoint ; au changement, lib.rs::screen_changed met à jour la zone de travail, émet work-area {width, height, scale} et repositionne la fenêtre ; le frontend recalcule la largeur de la bande.',
    boundary:
      'Aucune reproduction web : il n’y a qu’un écran dans une page. Preuve native : curseur déplacé d’un écran à l’autre par PowerShell, rect de la fenêtre relevé avant/après.',
    scenario: null,
  },
  {
    id: 'notice',
    title: 'Boîte de dialogue quand il n’y a rien à traduire',
    code: 'UI-020',
    scope: 'Web + Windows',
    image: 'overlay-reported.png',
    observed:
      'Sans sélection ni copie récente, Ctrl+Alt+T ouvrait une boîte de dialogue Windows « FlowTranslate » modale, à fermer à la main.',
    steps: [
      'Presser le raccourci sans rien sélectionner, dans une application où rien ne peut être copié.',
      'Regarder le bas de l’écran de la souris : une pilule « Rien à traduire dans la fenêtre active » apparaît seule.',
      'Ne rien faire : elle disparaît après quatre secondes ; un raccourci suivant la remplace.',
    ],
    cause:
      'capture_error appelait MessageBoxW. Correctif (0.1.8) : Rust place la fenêtre de la bulle en pilule seule (420 × 64, bas centre de l’écran du curseur, aucune surface cliquable) et émet capture-notice ; dans une bulle déjà ouverte, l’avis s’affiche comme retour d’action.',
    boundary:
      'La pilule et sa disparition se voient ici. Le placement natif, la copie synthétique (Ctrl+Insert) et la règle des trois secondes ne se vérifient que dans l’application.',
    scenario: 'notice',
  },
  {
    id: 'selection',
    title: 'Sélection → traduction directe',
    code: 'UI-007',
    scope: 'Windows uniquement',
    image: 'overlay-reported.png',
    observed: 'Le parcours doit traduire la sélection par Ctrl+Alt+T sans copie manuelle ni confirmation.',
    steps: [
      'Sélectionner un texte fictif dans Edge, Word, Teams, Discord ou VS Code.',
      'Appuyer sur Ctrl+Alt+T sans copier d’abord.',
      'Vérifier une traduction directe dans la langue réglée : par UIA, sinon par la copie synthétique (Ctrl+Insert, presse-papiers restauré), sinon par une copie de moins de trois secondes ; sans rien, l’avis « Rien à traduire ».',
    ],
    cause:
      'Jusqu’en 0.1.7 la capture ne lisait que la sélection UIA de l’élément focalisé puis, en silence, le presse-papiers existant : d’où le réflexe Ctrl+C. Depuis 0.1.8 elle copie elle-même (capture.rs : synthetic_copy) et date les copies de l’utilisateur (host::track_clipboard).',
    boundary:
      'Fournir un texte déjà capturé à la démo contourne précisément la partie à tester. Ce cas ne sera pas déclaré vérifié par un test web.',
    scenario: null,
  },
] as const;

export function BugWorkbench() {
  const params = new URLSearchParams(location.search);
  const [id, setId] = useState(params.get('issue') ?? 'settings');
  const defect = defects.find((item) => item.id === id) ?? defects[0];
  const [size, setSize] = useState('960x450');
  const [run, setRun] = useState(0);
  const [width, height] = size.split('x').map(Number);
  const [missing, setMissing] = useState(false);
  return (
    <main className="workbench bug-board">
      <header>
        <div>
          <span className="eyebrow">Overtype / Diagnostic</span>
          <h1>Défauts signalés</h1>
          <p>Reproduire le problème avant de déclarer un correctif.</p>
        </div>
        <a href="/lab.html?view=states">États techniques →</a>
      </header>
      <div className="workspace">
        <nav aria-label="Défauts signalés">
          {defects.map((item) => (
            <button
              key={item.id}
              aria-current={defect.id === item.id ? 'page' : undefined}
              onClick={() => {
                setId(item.id);
                setMissing(false);
                history.replaceState(null, '', `/lab.html?issue=${item.id}`);
              }}
            >
              <span>{item.title}</span>
              <small>{item.code}</small>
            </button>
          ))}
        </nav>
        <section className="review">
          <div className="defect-heading">
            <span>
              {defect.code} · {defect.scope}
            </span>
            <h2>{defect.title}</h2>
            <p>{defect.observed}</p>
          </div>
          <details className="reported" open={defect.scenario === null} key={defect.id}>
            <summary>Capture signalée par Lucas — conservée localement</summary>
            {missing ? (
              <p>Capture locale indisponible sur cette machine. Voir le signalement original.</p>
            ) : (
              <img
                src={`/release/ui-evidence/${defect.image}`}
                alt={defect.observed}
                onError={() => setMissing(true)}
              />
            )}
          </details>
          <div className="repro-steps">
            <strong>Reproduction à effectuer</strong>
            <ol>
              {defect.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <strong>Diagnostic : </strong>
              {defect.cause}
            </p>
          </div>
          {defect.id === 'settings' && (
            <section className="patch-evidence" aria-label="Preuves du correctif des marges">
              <strong>Correction frontend vérifiée — même fenêtre de 960 × 450</strong>
              <div>
                <figure>
                  <figcaption>Avant : défaut reproduit, test en échec</figcaption>
                  <img
                    src="/release/ui-evidence/settings-before.png"
                    alt="Avant correction, grandes marges blanches autour du panneau sombre"
                  />
                </figure>
                <figure>
                  <figcaption>Après : fond continu, test réussi</figcaption>
                  <img
                    src="/release/ui-evidence/settings-after.png"
                    alt="Après correction, le fond sombre couvre toute la fenêtre"
                  />
                </figure>
              </div>
              <p>
                Capture du navigateur avec les composants de production. Installation Windows non mise à jour par cette
                comparaison.
              </p>
            </section>
          )}
          {defect.scenario ? (
            <>
              <div className="controls">
                <label>
                  Taille du cas
                  <select value={size} onChange={(e) => setSize(e.target.value)}>
                    <option value="960x450">960 × 450 — fenêtre élargie</option>
                    <option value="620x640">620 × 640</option>
                    <option value="480x640">480 × 640</option>
                  </select>
                </label>
                <button className="replay" onClick={() => setRun(run + 1)}>
                  Rejouer le cas
                </button>
                <a
                  href={`/lab-frame.html?scenario=${defect.scenario}&surface=production`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir seul ↗
                </a>
              </div>
              <div className="canvas">
                <iframe
                  key={`${defect.id}-${size}-${run}`}
                  title="Reproduction du défaut"
                  src={`/lab-frame.html?scenario=${defect.scenario}&surface=production`}
                  width={width}
                  height={height}
                />
              </div>
            </>
          ) : (
            <div className="native-required">
              <strong>Pas de reproduction web pour ce défaut.</strong>
              <p>
                Le test doit piloter la fenêtre Windows réelle. La commande <code>npm run ui:native</code> vérifie le
                cas de fermeture disponible ; elle ne couvre pas à elle seule tous les gestes ci-dessus.
              </p>
            </div>
          )}
          <footer>{defect.boundary}</footer>
        </section>
      </div>
    </main>
  );
}
