import { useSyncExternalStore } from 'react';
import type { Language } from './types';
import { setupMessages } from './setup/messages.i18n';
import { connectionMessages } from './connection/messages.i18n';
import { settingsPagesMessages } from './settings/pages/messages.i18n';
import { componentsMessages } from './components/messages.i18n';
import { demoMessages } from './demo/messages.i18n';
import { appName } from './brand';

// The interface language (docs/DA-PLAN.md, lot 1): English by default, French complete.
// No dependency: one typed dictionary, `t(key, params)`, and a hook that follows
// settings.language. Action names are user data and never pass through here; the
// French messages Rust sends stay as they are until the error codes of lot 10.
const dictionary = {
  ...setupMessages,
  ...connectionMessages,
  ...settingsPagesMessages,
  ...componentsMessages,
  ...demoMessages,
  // Overlay: the glass, its pill and its menu.
  'glass.copy': { en: 'Copy translation', fr: 'Copier la traduction' },
  'glass.more': { en: 'More options', fr: 'Plus d’options' },
  'glass.close': { en: 'Close', fr: 'Fermer' },
  'glass.pin': { en: 'Pin', fr: 'Épingler' },
  'glass.unpin': { en: 'Unpin', fr: 'Détacher' },
  'glass.actions': { en: 'Translation actions', fr: 'Actions de traduction' },
  'glass.menu': { en: 'Translation options', fr: 'Options de traduction' },
  'glass.document': { en: 'Translation', fr: 'Traduction' },
  'glass.original': { en: 'Original', fr: 'Original' },
  'glass.working': { en: 'Translating', fr: 'Traduction en cours' },
  'glass.replaced': { en: 'Selection replaced', fr: 'Sélection remplacée' },
  'glass.complete': { en: 'Translation complete', fr: 'Traduction terminée' },
  'glass.copied': { en: 'Translation copied', fr: 'Traduction copiée' },
  'glass.errorHint': { en: 'Settings and Try again are in the ⋯ menu.', fr: 'Réglages et Réessayer dans le menu ⋯.' },
  // The Îlot's working pill (lot 8): its accessible name, never shown (design-lab/src/data.js:17-18).
  'pill.working': { en: 'Working', fr: 'En cours' },
  'pill.cancel': { en: 'Working — click to cancel', fr: 'En cours, cliquez pour annuler' },
  'menu.showOriginal': { en: 'Show original', fr: 'Afficher l’original' },
  'menu.hideOriginal': { en: 'Hide original', fr: 'Masquer l’original' },
  'menu.replace': { en: 'Replace', fr: 'Remplacer' },
  'menu.retry': { en: 'Try again', fr: 'Réessayer' },
  'menu.rerun': { en: 'Run again with {server}', fr: 'Relancer avec {server}' },
  'menu.settings': { en: 'Settings', fr: 'Réglages' },
  'menu.close': { en: 'Close', fr: 'Fermer' },
  // The Îlot (lot 7): wording of the design lab (design-lab/src/data.js:11, 17-18) where it has one.
  'ilot.menu': { en: 'Actions on the selection', fr: 'Actions sur la sélection' },
  'ilot.ask': { en: 'Ask', fr: 'Consigne' },
  'ilot.askName': { en: 'Custom…', fr: 'Consigne…' },
  'ilot.describe': { en: 'Describe your change…', fr: 'Décrivez la modification…' },
  'ilot.unavailable': { en: 'Instructions need the keyboard, which stayed with the other app', fr: 'La consigne demande le clavier, resté dans l’autre application' },
  'feedback.pasted': { en: 'Result pasted into the selection.', fr: 'Résultat collé dans la sélection.' },
  'feedback.copyRefused': { en: 'Copy was refused.', fr: 'La copie a été refusée.' },
  'feedback.replaceUnavailable': { en: 'Replace is unavailable; use Copy.', fr: 'Remplacement indisponible; utilisez Copier.' },
  'feedback.displayUnavailable': { en: 'Display unavailable. Try again.', fr: 'Affichage indisponible. Réessayez.' },
  'feedback.moveUnavailable': { en: 'Moving unavailable. Try again.', fr: 'Déplacement indisponible. Réessayez.' },
  'feedback.openSettingsFromTray': { en: 'Open the settings from the {app} icon.', fr: 'Ouvrez les réglages depuis l’icône {app}.' },
  'error.failed': { en: 'The translation did not complete.', fr: 'La traduction n’a pas abouti.' },
  'error.startFailed': { en: 'The action could not start.', fr: 'L’action n’a pas pu démarrer.' },
  'error.deliveryTimeout': { en: 'The replacement did not answer; the result stays in the bubble.', fr: 'Le remplacement n’a pas répondu; le résultat reste dans la bulle.' },
  // After the replacement and its errors (lots 9 and 10, src/result/): the lab's wording where it
  // has one (design-lab/src/data.js:17-18, 66-72; Simulator.jsx:264, 285, 292), at most six words.
  'result.undo': { en: 'Undo', fr: 'Annuler' },
  'result.undone': { en: 'Undone', fr: 'Annulé' },
  // An Undo that could not be done (lot 9, `undo_result`): refused before anything was sent, or
  // sent and not read back. Nothing else is ever pasted.
  'result.undo.target_changed': { en: 'Text changed — can’t undo', fr: 'Texte modifié, annulation impossible' },
  'result.undo.keys_held': { en: 'Keys held down — can’t undo', fr: 'Touches enfoncées, annulation impossible' },
  'result.undo.paste_blocked': { en: 'This app blocked Undo', fr: 'L’application a bloqué l’annulation' },
  'result.undo.internal': { en: 'Can’t undo now', fr: 'Annulation indisponible' },
  'result.undo.sent': { en: 'Undo not confirmed — check text', fr: 'Annulation non confirmée, vérifiez' },
  'result.copied': { en: 'Copied', fr: 'Copié' },
  'result.action.endpoint': { en: 'Open endpoint', fr: 'Voir l’adresse' },
  'result.action.apiKey': { en: 'Fix key', fr: 'Corriger la clé' },
  'result.action.model': { en: 'Choose model', fr: 'Choisir le modèle' },
  'result.action.copy': { en: 'Copy result', fr: 'Copier le résultat' },
  'result.error.unreachable': { en: 'Can’t reach the server', fr: 'Serveur injoignable' },
  'result.error.bad_endpoint': { en: 'Wrong server address', fr: 'Adresse du serveur erronée' },
  'result.error.unauthorized': { en: 'API key rejected', fr: 'Clé API refusée' },
  'result.error.model_not_found': { en: 'Model not found', fr: 'Modèle introuvable' },
  'result.error.model_not_found_named': { en: 'Model not found: {model}', fr: 'Modèle introuvable : {model}' },
  'result.error.timeout': { en: 'Server took too long', fr: 'Le serveur a trop tardé' },
  'result.error.busy': { en: 'Server busy — try again', fr: 'Serveur occupé, réessayez' },
  'result.error.server_error': { en: 'Server error', fr: 'Erreur du serveur' },
  'result.error.stream_broken': { en: 'Answer interrupted', fr: 'Réponse interrompue' },
  'result.error.length': { en: 'Answer cut off, not replaced', fr: 'Réponse tronquée, rien remplacé' },
  'result.error.internal': { en: 'Something went wrong', fr: 'Un problème est survenu' },
  'result.error.paste_blocked': { en: 'Can’t edit this app’s text', fr: 'Impossible de modifier ce texte' },
  'result.error.target_changed': { en: 'Text changed — not replaced', fr: 'Texte modifié, rien remplacé' },
  'result.error.not_editable': { en: 'Read-only text, not replaced', fr: 'Texte non modifiable, rien remplacé' },
  'result.error.keys_held': { en: 'Keys held down, not replaced', fr: 'Touches enfoncées, rien remplacé' },
  // 0.6: the paste changed nothing (a PDF in a browser); the window runs as administrator.
  'result.error.read_only': { en: 'Read-only text, not replaced', fr: 'Texte en lecture seule, rien remplacé' },
  'result.error.protected_window': { en: 'Administrator window — can’t be read', fr: 'Fenêtre administrateur, lecture impossible' },
  'result.error.too_long': { en: 'Selection too long (max 6,000 characters)', fr: 'Sélection trop longue (6 000 caractères max)' },
  'result.error.no_selection': { en: 'Select some text first', fr: 'Sélectionnez d’abord du texte' },
  'result.error.protected_field': { en: 'Protected field, not read', fr: 'Champ protégé, rien lu' },
  // Capture notices with a code of their own: the Settings window was in front, the tray's
  // « Revoir » found nothing recent.
  'result.error.settings_open': { en: 'Close Settings first', fr: 'Fermez d’abord les Réglages' },
  'result.error.setup_open': { en: 'Finish the setup first', fr: 'Terminez d’abord l’accueil' },
  'result.error.nothing_recent': { en: 'No recent translation', fr: 'Aucune traduction récente' },
  'result.error.cancelled': { en: 'Cancelled', fr: 'Annulé' },
  // A capture Rust refused (capture-notice), where the request's words would mislead: the source
  // window changed during the capture, nothing was tried (src/result/errors.ts, source 'capture').
  'result.notice.target_changed': { en: 'Window changed — try again', fr: 'Fenêtre changée, réessayez' },
  'init.connection': { en: 'The connection to {app} is unavailable.', fr: 'La connexion à {app} est indisponible.' },
  'init.close': { en: 'Closing failed. Try again.', fr: 'La fermeture a échoué. Réessayez.' },
  'init.restart': { en: 'Restart the app if the problem persists.', fr: 'Relancez l’application si le problème persiste.' },
  'common.retry': { en: 'Try again', fr: 'Réessayer' },
  'common.close': { en: 'Close', fr: 'Fermer' },
  'common.settings': { en: 'Settings', fr: 'Réglages' },
  // Browser preview.
  'preview.label': { en: 'Browser preview · simulated response', fr: 'Aperçu navigateur · réponse simulée' },
  'preview.backgrounds': { en: 'Preview background', fr: 'Fond de l’aperçu' },
  'preview.light': { en: 'Light', fr: 'Clair' },
  'preview.dark': { en: 'Dark', fr: 'Sombre' },
  'preview.color': { en: 'Color', fr: 'Coloré' },
  'demo.mail': { en: 'Mail', fr: 'Courrier' },
  'demo.messages': { en: 'Messages', fr: 'Messages' },
  'demo.settings': { en: 'Settings', fr: 'Réglages' },
  'demo.newMessage': { en: '✉ New message', fr: '✉ Nouveau message' },
  'demo.search': { en: 'Search', fr: 'Rechercher' },
  'demo.send': { en: 'Send', fr: 'Envoyer' },
  'demo.to': { en: 'To', fr: 'À' },
  'demo.badge': { en: 'Browser preview', fr: 'Aperçu navigateur' },
  'demo.intro': { en: 'Simulated responses. This preview checks the components; Windows rendering, focus and moving are tested in the app.', fr: 'Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.' },
  'demo.scenario': { en: 'Scenario', fr: 'Scénario' },
  'demo.selection': { en: 'Selection', fr: 'Sélection' },
  'demo.clipboard': { en: 'Clipboard', fr: 'Presse-papiers' },
  'demo.long': { en: 'Long text', fr: 'Texte long' },
  'demo.veryLong': { en: 'Very long text', fr: 'Texte très long' },
  'demo.error': { en: 'Network error', fr: 'Erreur réseau' },
  'demo.start': { en: 'Simulate Ctrl + Alt + T', fr: 'Simuler Ctrl + Alt + T' },
  'demo.openSettings': { en: 'Open settings', fr: 'Voir les réglages' },
  // Settings window.
  'settings.title': { en: 'Settings', fr: 'Réglages' },
  'settings.windowTitle': { en: '{app} Settings', fr: 'Réglages {app}' },
  'settings.animations': { en: 'Animations', fr: 'Animations' },
  'settings.animationsHelp': { en: 'Reduced: short fades only, no spring and no movement.', fr: 'Réduites : fondus courts seulement, sans ressort ni déplacement.' },
  'settings.animationsSystemReduces': { en: 'Windows asks to reduce animations.', fr: 'Windows demande de réduire les animations.' },
  'settings.animationsSystem': { en: 'Follow Windows', fr: 'Suivre Windows' },
  'settings.animationsFull': { en: 'Always', fr: 'Toujours' },
  'settings.animationsReduced': { en: 'Reduced', fr: 'Réduites' },
  'settings.loading': { en: 'Loading settings…', fr: 'Chargement des réglages…' },
  'settings.loadError': { en: 'Settings are unavailable. Try again or restart {app}.', fr: 'Les réglages sont indisponibles. Réessayez ou redémarrez {app}.' },
  'settings.notSaved': { en: 'Settings were not saved.', fr: 'Les réglages n’ont pas été enregistrés.' },
  'settings.language': { en: 'Language', fr: 'Langue' },
  'settings.languageHelp': { en: 'Menus, messages and settings. The actions you renamed keep their names.', fr: 'Menus, messages et réglages. Les actions que vous avez renommées gardent leur nom.' },
  'settings.theme': { en: 'Theme', fr: 'Thème' },
  'settings.themeSystem': { en: 'Follow Windows', fr: 'Suivre Windows' },
  'settings.themeLight': { en: 'Light', fr: 'Clair' },
  'settings.themeDark': { en: 'Dark', fr: 'Sombre' },
  'settings.indicator': { en: 'Indicator', fr: 'Indicateur' },
  'settings.indicatorHelp': { en: 'In the pill while the model works.', fr: 'Dans la pilule, pendant que le modèle travaille.' },
  'settings.indicatorPerle': { en: 'Perle', fr: 'Perle' },
  'settings.indicatorNebula': { en: 'Nebula', fr: 'Nébuleuse' },
  'settings.indicatorRibbon': { en: 'Ribbon', fr: 'Ruban' },
  'settings.motionPreset': { en: 'Motion style', fr: 'Style de mouvement' },
  'settings.motionSmooth': { en: 'Smooth', fr: 'Fluide' },
  'settings.motionBouncy': { en: 'Bouncy', fr: 'Rebondi' },
  'settings.menu': { en: 'Menu', fr: 'Menu' },
  'settings.menuShortcutField': { en: 'Menu shortcut', fr: 'Raccourci du menu' },
  'settings.menuShortcutHelp': { en: 'Select some text, then press these keys: the menu opens beside it.', fr: 'Sélectionnez du texte, puis appuyez sur ces touches : le menu s’ouvre à côté.' },
  'settings.menuShortcutHelpV4': { en: 'Runs the default action on the selected text.', fr: 'Lance l’action par défaut sur le texte sélectionné.' },
  'settings.menuShortcutOff': { en: 'Off. Record a combination to turn it on.', fr: 'Désactivé. Enregistrez une combinaison pour l’activer.' },
  'settings.defaultAction': { en: 'Default action', fr: 'Action par défaut' },
  'settings.defaultActionHelp': { en: 'The menu starts on the last action used in each app, or on this one.', fr: 'Le menu propose la dernière action utilisée dans chaque application, sinon celle-ci.' },
  'settings.defaultActionHelpV4': { en: 'What the shortcut runs.', fr: 'Ce que lance le raccourci.' },
  'settings.bubble': { en: 'Result bubble', fr: 'Bulle de résultat' },
  'settings.bubbleIntro': { en: 'When a shortcut shows the result, or a paste fails.', fr: 'Quand un raccourci affiche le résultat, ou qu’un collage échoue.' },
  'settings.autostartUnavailable': { en: 'Starting at sign-in is unavailable.', fr: 'Démarrage automatique indisponible.' },
  // After replacing (lot 9's settings).
  'after.check': { en: 'Check mark', fr: 'Coche' },
  'after.checkHelp': { en: 'Shows that the text was replaced.', fr: 'Montre que le texte a été remplacé.' },
  'after.undo': { en: 'Undo', fr: 'Annuler' },
  'after.undoHelp': { en: 'A button that puts the original text back.', fr: 'Un bouton qui remet le texte d’origine.' },
  'after.undoSeconds': { en: 'Undo time', fr: 'Durée d’Annuler' },
  'after.undoSecondsHelp': { en: '2 to 20 seconds. Hovering pauses it.', fr: 'De 2 à 20 secondes. Le survol la met en pause.' },
  'after.seconds': { en: '{count} s', fr: '{count} s' },
  'after.minutes': { en: '{count} min', fr: '{count} min' },
  'after.strategy': { en: 'How to undo', fr: 'Méthode' },
  'after.strategyHelp': { en: 'Ctrl+Z in the app, or {app} pastes the original back.', fr: 'Ctrl+Z dans l’application, ou {app} recolle l’original.' },
  'after.strategyKeystroke': { en: 'Ctrl+Z', fr: 'Ctrl+Z' },
  'after.strategyRepaste': { en: 'Paste original', fr: 'Recoller l’original' },
  'after.changedWords': { en: 'Highlight changed words', fr: 'Mettre en valeur les mots changés' },
  'after.changedWordsHelp': { en: 'The words the model changed, until your next action in the text.', fr: 'Les mots changés par le modèle, jusqu’à votre prochaine action dans le texte.' },
  'after.changedWordsSeconds': { en: 'Highlight time', fr: 'Durée de la mise en valeur' },
  'after.changedWordsSecondsHelp': { en: 'The longest it stays without an action.', fr: 'Le plus longtemps qu’il reste sans action.' },
  'after.placement': { en: 'Pill position', fr: 'Position de la pilule' },
  'after.placementHelp': { en: 'Never over the new text.', fr: 'Jamais sur le nouveau texte.' },
  'after.placementBelow': { en: 'Below the text', fr: 'Sous le texte' },
  'after.placementMargin': { en: 'In the margin', fr: 'Dans la marge' },
  // The Îlot's grid.
  'grid.title': { en: 'In the menu', fr: 'Dans le menu' },
  'grid.intro': { en: 'Up to 6, in this order. A letter runs one from the menu.', fr: 'Six au plus, dans cet ordre. Une lettre en lance une depuis le menu.' },
  'grid.list': { en: 'Menu actions', fr: 'Actions du menu' },
  'grid.letter': { en: 'Letter for {name}', fr: 'Lettre de {name}' },
  'grid.up': { en: 'Move {name} up', fr: 'Monter {name}' },
  'grid.down': { en: 'Move {name} down', fr: 'Descendre {name}' },
  'grid.letterInvalid': { en: 'Use a single letter.', fr: 'Une seule lettre.' },
  'grid.letterTaken': { en: '{letter} is already used by {name}.', fr: '{letter} est déjà utilisée par {name}.' },
  'grid.lettersInvalid': { en: 'Each action takes one letter, different from the others.', fr: 'Chaque action prend une lettre, différente des autres.' },
  'grid.tooMany': { en: 'The menu holds 6 actions at most.', fr: 'Le menu contient six actions au plus.' },
  'settings.textSize': { en: 'Text size', fr: 'Taille du texte' },
  'settings.textSizeHelp': { en: 'Short glass 16, 18 or 20 px; reader 22, 24 or 26 px.', fr: 'Verre court 16, 18 ou 20 px ; lecteur 22, 24 ou 26 px.' },
  'settings.textNormal': { en: 'Normal', fr: 'Normale' },
  'settings.textLarge': { en: 'Large', fr: 'Grande' },
  'settings.textXLarge': { en: 'Extra large', fr: 'Très grande' },
  'settings.autoClose': { en: 'Auto close', fr: 'Fermeture automatique' },
  'settings.autoCloseHelp': { en: 'The estimated reading time, then a fade. Hovering or pinning holds it.', fr: 'Le temps de lecture estimé, puis un fondu. Survoler ou épingler la retient.' },
  'settings.closeFast': { en: 'Fast', fr: 'Rapide' },
  'settings.closeNormal': { en: 'Normal', fr: 'Normale' },
  'settings.closeSlow': { en: 'Slow', fr: 'Lente' },
  'settings.closeNever': { en: 'Never', fr: 'Jamais' },
  'settings.device': { en: 'On this device', fr: 'Sur cet appareil' },
  'settings.historyHelp': { en: '7 days, 100 entries, protected by Windows. Nothing leaves the device.', fr: '7 jours, 100 entrées, protégé par Windows. Rien ne quitte l’appareil.' },
  'settings.historyRemove': { en: 'Delete this entry', fr: 'Supprimer cette entrée' },
  'settings.historyCountOther': { en: '{count} entries', fr: '{count} entrées' },
  'settings.historyClear': { en: 'Delete all', fr: 'Tout supprimer' },
  'settings.deleteFailed': { en: 'Deletion failed.', fr: 'La suppression a échoué.' },
  'settings.autostart': { en: 'Start when you sign in', fr: 'Lancer à l’ouverture de session' },
  'settings.autostartHelp': { en: 'Only the notification area icon shows at rest.', fr: 'Seule l’icône de la zone de notification est visible au repos.' },
  'settings.reset': { en: 'Default settings', fr: 'Réglages par défaut' },
  'settings.resetHelp': { en: 'Everything goes back to a fresh install, except your connection, history, language and start at sign-in.', fr: 'Tout revient à une nouvelle installation, sauf votre connexion, l’historique, la langue et le lancement à l’ouverture de session.' },
  'settings.resetAction': { en: 'Restore…', fr: 'Rétablir…' },
  'settings.resetConfirm': { en: 'Your own actions and shortcuts will be removed. Restore the default settings?', fr: 'Vos propres actions et raccourcis seront supprimés. Rétablir les réglages par défaut ?' },
  'settings.resetConfirmAction': { en: 'Restore default settings', fr: 'Rétablir les réglages par défaut' },
  'settings.resetKeep': { en: 'Keep my settings', fr: 'Garder mes réglages' },
  'settings.resetDone': { en: 'Default settings restored.', fr: 'Réglages par défaut rétablis.' },
  'settings.resetDoneKept': { en: 'Default settings restored, except the menu shortcut: Windows did not give {default}, so the menu keeps {shortcut}.', fr: 'Réglages par défaut rétablis, sauf le raccourci du menu : Windows n’a pas donné {default}, le menu garde {shortcut}.' },
  'settings.resetFailed': { en: 'The default settings could not be restored. Try again.', fr: 'Impossible de rétablir les réglages par défaut. Réessayez.' },
  'settings.previewConnection': { en: 'Browser preview · simulated connection', fr: 'Aperçu navigateur · connexion simulée' },
  'settings.saveRetry': { en: 'Not saved — try again', fr: 'Non enregistré — réessayer' },
  'settings.saving': { en: 'Saving…', fr: 'Enregistrement…' },
  'settings.saved': { en: 'Saved', fr: 'Enregistré' },
  'settings.quit': { en: 'Quit {app}', fr: 'Quitter {app}' },
  // Actions and shortcuts.
  'actions.instructions': { en: 'Instructions', fr: 'Consignes' },
  'actions.intro': { en: 'The instruction alone; the selected text is sent after it.', fr: 'La consigne seule ; le texte sélectionné est envoyé après elle.' },
  'actions.add': { en: 'Add an action', fr: 'Ajouter une action' },
  'actions.newName': { en: 'New action', fr: 'Nouvelle action' },
  'actions.shortName': { en: 'Tile label', fr: 'Nom sur la tuile' },
  'actions.untitled': { en: 'Untitled action', fr: 'Action sans nom' },
  'actions.builtIn': { en: 'Built-in', fr: 'Prédéfinie' },
  'actions.custom': { en: 'Custom', fr: 'Personnalisée' },
  'actions.name': { en: 'Action name', fr: 'Nom de l’action' },
  'actions.instruction': { en: 'Instruction', fr: 'Consigne' },
  'actions.instructionFor': { en: 'Instruction {name}', fr: 'Consigne {name}' },
  'actions.promptInvalid': { en: 'The instruction must hold 1 to 8,000 characters, without a null character.', fr: 'La consigne doit contenir de 1 à 8 000 caractères, sans caractère nul.' },
  'actions.restore': { en: 'Restore the instruction', fr: 'Rétablir la consigne' },
  'actions.inUseHint': { en: 'First change the shortcuts and the default action that use it.', fr: 'Changez d’abord les raccourcis et l’action par défaut qui l’utilisent.' },
  'actions.delete': { en: 'Delete action', fr: 'Supprimer l’action' },
  'actions.inUse': { en: ' · in use', fr: ' · utilisée' },
  'shortcuts.title': { en: 'Direct shortcuts', fr: 'Raccourcis directs' },
  'shortcuts.intro': { en: 'One combination runs one action, without the menu.', fr: 'Une combinaison lance une action, sans passer par le menu.' },
  'shortcuts.none': { en: 'No direct shortcut.', fr: 'Aucun raccourci direct.' },
  'shortcuts.opensMenu': { en: 'Opens the menu.', fr: 'Ouvre le menu.' },
  'shortcuts.taken': { en: 'Another app already uses this shortcut, or Windows refused it. Choose another one.', fr: 'Une autre application utilise déjà ce raccourci, ou Windows l’a refusé. Choisissez-en un autre.' },
  // Lot 10: what Windows answered for a saved chord (`shortcut_status`), under its row.
  'shortcuts.stateTaken': { en: 'Another app is already using {shortcut}, so Windows did not give it to {app}. Record another combination, or close that app.', fr: 'Une autre application utilise déjà {shortcut} : Windows ne l’a pas donné à {app}. Enregistrez une autre combinaison, ou fermez cette application.' },
  'shortcuts.stateFailed': { en: 'Windows refused {shortcut}: it does nothing for now. Record another combination.', fr: 'Windows a refusé {shortcut} : il ne fait rien pour l’instant. Enregistrez une autre combinaison.' },
  'shortcuts.duplicate': { en: 'Another {app} shortcut already uses this combination.', fr: 'Un autre raccourci de {app} utilise déjà cette combinaison.' },
  'shortcuts.unknown': { en: 'This combination is not recognized.', fr: 'Cette combinaison n’est pas reconnue.' },
  'shortcuts.altGrConflict': { en: '{shortcut} is also AltGr+{key} on this keyboard: you could no longer type {character}.', fr: '{shortcut} est aussi AltGr+{key} sur ce clavier : vous ne pourriez plus taper {character}.' },
  'shortcuts.altGrConflictKey': { en: '{shortcut} is also AltGr+{key} on this keyboard: that key would no longer type its character.', fr: '{shortcut} est aussi AltGr+{key} sur ce clavier : cette touche ne taperait plus son caractère.' },
  'shortcuts.add': { en: 'Add a shortcut', fr: 'Ajouter un raccourci' },
  'shortcuts.off': { en: 'Off', fr: 'Désactivé' },
  'shortcuts.delete': { en: 'Delete this shortcut', fr: 'Supprimer ce raccourci' },
  'shortcuts.field': { en: 'Shortcut', fr: 'Raccourci' },
  'shortcuts.press': { en: 'Press the combination…', fr: 'Pressez la combinaison…' },
  'shortcuts.unset': { en: 'Not set', fr: 'À définir' },
  'shortcuts.cancel': { en: 'Cancel', fr: 'Annuler' },
  'shortcuts.change': { en: 'Change', fr: 'Modifier' },
  'shortcuts.action': { en: 'Action', fr: 'Action' },
  'shortcuts.result': { en: 'Result', fr: 'Résultat' },
  'shortcuts.display': { en: 'Show in the bubble', fr: 'Afficher dans la bulle' },
  'shortcuts.replace': { en: 'Replace the selection', fr: 'Remplacer la sélection' },
  'shortcuts.saved': { en: 'Shortcut saved.', fr: 'Raccourci enregistré.' },
  'shortcuts.useSuggestion': { en: 'Use {shortcut}', fr: 'Utiliser {shortcut}' },
  'shortcuts.windowsKey': { en: 'The Windows key is reserved for the system.', fr: 'La touche Windows est réservée au système.' },
  'shortcuts.altGr': { en: 'AltGr cannot be part of a global shortcut.', fr: 'AltGr ne peut pas servir de raccourci global.' },
  'shortcuts.needModifier': { en: 'Add Ctrl or Alt to the combination.', fr: 'Ajoutez Ctrl ou Alt à la combinaison.' },
  'shortcuts.f12': { en: 'F12 is reserved by Windows.', fr: 'F12 est réservée par Windows.' },
  'shortcuts.system': { en: 'This combination is reserved by Windows.', fr: 'Cette combinaison est réservée à Windows.' },
  'shortcuts.badKey': { en: 'This key cannot be part of a global shortcut.', fr: 'Cette touche ne peut pas servir de raccourci global.' },
} satisfies Record<string, Record<Language, string>>;

export type MessageKey = keyof typeof dictionary;
// A message as it is written, its parameters unfilled (the tests read it).
export const rawMessage = (language: Language, key: MessageKey): string => dictionary[key][language];
export const messageKeys = Object.keys(dictionary) as MessageKey[];
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export const languages: readonly Language[] = ['en', 'fr'];
export const locales: Record<Language, string> = { en: 'en-US', fr: 'fr-FR' };

// The app's name is never written in a message: `{app}` reads it from src/brand.ts.
export function translate(language: Language, key: MessageKey, params?: Params): string {
  const text = dictionary[key][language] ?? dictionary[key].en;
  if (!params && !text.includes('{')) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => params && name in params ? String(params[name]) : name === 'app' ? appName : whole);
}

// The active language of this window: set by useDocumentPreferences from settings.language;
// every useT() re-renders at once when it changes (no reload).
let active: Language = 'en';
const listeners = new Set<() => void>();
export function setLanguage(language: Language) {
  if (language === active || !languages.includes(language)) return;
  active = language;
  listeners.forEach(listener => listener());
}
export function currentLanguage(): Language { return active; }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

// For messages composed outside a render (a timer's notice): the language at that moment.
export const t: Translate = (key, params) => translate(active, key, params);

const bound: Record<Language, Translate> = {
  en: (key, params) => translate('en', key, params),
  fr: (key, params) => translate('fr', key, params),
};
export function useLanguage(): Language { return useSyncExternalStore(subscribe, currentLanguage, currentLanguage); }
export function useT(): Translate { return bound[useLanguage()]; }
