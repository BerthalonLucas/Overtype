import type { Language } from '../../types';

// Strings of the Settings window of 0.6 (sidebar and pages), merged into the one dictionary of
// src/i18n.ts. French is the design lab's wording (design-lab/reglages/src/settings); English
// says the same, to « you ». The app's name is never written: `{app}`.
export const settingsPagesMessages = {
  // Sidebar.
  'nav.updateAvailable': { en: 'Update available', fr: 'Mise à jour disponible' },
  'nav.general': { en: 'General', fr: 'Général' },
  'nav.shortcuts': { en: 'Shortcuts', fr: 'Raccourcis' },
  'nav.actions': { en: 'Actions', fr: 'Actions' },
  'nav.after': { en: 'After replacing', fr: 'Après remplacement' },
  'nav.appearance': { en: 'Appearance', fr: 'Apparence' },
  'nav.server': { en: 'Server', fr: 'Serveur' },
  'nav.data': { en: 'Data', fr: 'Données' },
  'nav.diagnostic': { en: 'Diagnostic', fr: 'Diagnostic' },
  'nav.pages': { en: 'Settings pages', fr: 'Pages des réglages' },
  'nav.search': { en: 'Search a setting', fr: 'Rechercher un réglage' },
  'nav.searchClear': { en: 'Clear the search', fr: 'Effacer la recherche' },
  'nav.results': { en: 'Results', fr: 'Résultats' },
  'nav.noResult': { en: 'No setting matches.', fr: 'Aucun réglage ne correspond.' },
  'nav.version': { en: 'Version {version}', fr: 'Version {version}' },
  'nav.serverFailing': { en: 'Connection failing', fr: 'Connexion en échec' },
  'nav.serverChecking': { en: 'Checking the connection', fr: 'Vérification en cours' },
  'nav.diagShown': { en: 'Diagnostic shown', fr: 'Diagnostic affiché' },
  'nav.diagHidden': { en: 'Diagnostic hidden', fr: 'Diagnostic masqué' },
  'nav.notSaved': { en: 'Not saved', fr: 'Non enregistré' },
  'nav.closeAnyway': {
    en: 'This change could not be saved. Close again to leave without it.',
    fr: 'Cette modification n’a pas pu être enregistrée. Fermez à nouveau pour quitter sans elle.',
  },
  // What each page is about (one line under its title).
  'page.general.about': { en: 'Startup, language and welcome.', fr: 'Démarrage, langue et accueil.' },
  'page.shortcuts.about': {
    en: 'The keys that open the menu or run an action.',
    fr: 'Les touches qui ouvrent le menu ou lancent une action.',
  },
  'page.actions.about': {
    en: 'What the menu offers, in which order, with which instruction.',
    fr: 'Ce que propose le menu, dans quel ordre, avec quelle consigne.',
  },
  'page.after.about': {
    en: 'What shows when the text has just been replaced.',
    fr: 'Ce qui s’affiche quand le texte vient d’être remplacé.',
  },
  'page.appearance.about': { en: 'Theme, indicator and motion.', fr: 'Thème, indicateur et mouvements.' },
  'page.server.about': { en: 'Where {app} sends the text.', fr: 'Où {app} envoie le texte.' },
  'page.data.about': {
    en: 'What stays on this device, and nothing else.',
    fr: 'Ce qui reste sur cet appareil, et rien d’autre.',
  },
  'page.diagnostic.about': {
    en: 'What happened at each connection, and how long it took. No text, no full key.',
    fr: 'Ce qui s’est passé à chaque connexion, et en combien de temps. Ni texte ni clé complète.',
  },
  // General.
  'page.general.startup': { en: 'Startup', fr: 'Démarrage' },
  'page.general.language': { en: 'Interface language', fr: 'Langue de l’interface' },
  'page.general.firstRun': { en: 'First run', fr: 'Premier lancement' },
  'page.general.replay': { en: 'See the welcome again', fr: 'Revoir l’accueil' },
  'page.general.replayHelp': {
    en: 'The first questions, then the animated demo.',
    fr: 'Les questions du début, puis la démo animée.',
  },
  'page.general.replayFailed': {
    en: 'The welcome could not be opened. Try again.',
    fr: 'L’accueil n’a pas pu s’ouvrir. Réessayez.',
  },
  'page.general.resetGroup': { en: 'Reset', fr: 'Réinitialiser' },
  'page.general.aboutGroup': { en: 'About', fr: 'À propos' },
  'page.general.version': { en: '{app} {version}', fr: '{app} {version}' },
  'page.general.updates': { en: 'Updates', fr: 'Mises à jour' },
  'page.general.updateCheck': { en: 'Check for updates', fr: 'Vérifier les mises à jour' },
  'page.general.updateInstall': { en: 'Update to {version}', fr: 'Mettre à jour vers {version}' },
  'page.general.updateAvailable': {
    en: 'Version {version} is out. {app} restarts once it is installed.',
    fr: 'La version {version} est sortie. {app} redémarre une fois installé.',
  },
  'page.general.updateUpToDate': { en: 'Up to date · checked at {time}', fr: 'À jour · vérifié à {time}' },
  'page.general.updateNever': {
    en: 'Checked at start, then every six hours.',
    fr: 'Vérifié au démarrage, puis toutes les six heures.',
  },
  'page.general.updateChecking': { en: 'Checking…', fr: 'Vérification…' },
  'page.general.updateFailed': {
    en: 'GitHub did not answer. Try again later.',
    fr: 'GitHub n’a pas répondu. Réessayez plus tard.',
  },
  'page.general.updateInstalling': { en: 'Downloading… {percent}%', fr: 'Téléchargement… {percent} %' },
  'page.general.updateInstallFailed': {
    en: 'The update failed. Try again.',
    fr: 'La mise à jour a échoué. Réessayez.',
  },
  'page.general.versionHelp': {
    en: 'Its icon stays in the notification area.',
    fr: 'Son icône reste dans la zone de notification.',
  },
  // Shortcuts.
  'page.shortcuts.actionGone': { en: 'Deleted action', fr: 'Action supprimée' },
  'page.shortcuts.replaces': { en: 'Replaces the selection', fr: 'Remplace la sélection' },
  'page.shortcuts.shows': { en: 'Shows in the bubble', fr: 'Affiche dans la bulle' },
  'page.shortcuts.enable': { en: 'Enable {name}', fr: 'Activer {name}' },
  'page.shortcuts.direct': { en: 'Direct shortcut', fr: 'Raccourci direct' },
  'page.shortcuts.footnote': {
    en: 'Ctrl or Alt required. The Windows key, F12 and system combinations are refused.',
    fr: 'Ctrl ou Alt requis. La touche Windows, F12 et les combinaisons du système sont refusées.',
  },
  'page.shortcuts.pressFor': { en: '{label}: press the combination', fr: '{label} : pressez la combinaison' },
  'page.shortcuts.full': { en: '12 shortcuts at most.', fr: 'Douze raccourcis au plus.' },
  'page.key.space': { en: 'Space', fr: 'Espace' },
  'page.key.shift': { en: 'Shift', fr: 'Maj' },
  'page.key.enter': { en: 'Enter', fr: 'Entrée' },
  'page.key.backspace': { en: 'Backspace', fr: 'Retour' },
  'page.key.delete': { en: 'Delete', fr: 'Suppr' },
  // Actions.
  'page.actions.previewLabel': { en: 'Menu preview', fr: 'Aperçu du menu' },
  'page.actions.preview': {
    en: 'The menu, as it opens beside the selection.',
    fr: 'Le menu, tel qu’il s’ouvre à côté de la sélection.',
  },
  'refusal.address': { en: 'The server address is invalid.', fr: 'L’adresse du serveur est invalide.' },
  'refusal.addressCredentials': {
    en: 'The server address must not hold credentials.',
    fr: 'L’adresse du serveur ne doit pas contenir d’identifiants.',
  },
  'refusal.addressScheme': {
    en: 'The server address must start with https:// or http://.',
    fr: 'L’adresse du serveur doit commencer par https:// ou http://.',
  },
  'refusal.servers': {
    en: 'The list of servers is invalid (1 to 8 servers).',
    fr: 'La liste des serveurs est invalide (1 à 8 serveurs).',
  },
  'refusal.model': { en: 'A server’s model is invalid.', fr: 'Le modèle d’un serveur est invalide.' },
  'refusal.serverName': { en: 'A server’s name is invalid.', fr: 'Le nom d’un serveur est invalide.' },
  'refusal.key': { en: 'A server’s key is invalid.', fr: 'La clé d’un serveur est invalide.' },
  'refusal.undoSeconds': {
    en: 'Undo must stay between 2 and 20 seconds.',
    fr: 'La durée d’annulation doit être comprise entre 2 et 20 secondes.',
  },
  'refusal.wordsSeconds': {
    en: 'Changed words must show between 5 and 120 seconds.',
    fr: 'La durée des mots changés doit être comprise entre 5 et 120 secondes.',
  },
  'refusal.actionName': {
    en: 'An action’s name must hold 1 to 60 characters.',
    fr: 'Le nom d’une action doit contenir de 1 à 60 caractères.',
  },
  'refusal.actions': { en: 'Keep between 1 and 24 actions.', fr: 'Configurez entre 1 et 24 actions.' },
  'page.actions.fillFirst': { en: 'Name the new action first.', fr: 'Nommez d’abord la nouvelle action.' },
  'page.after.sampleBye': { en: 'Have a nice day,', fr: 'Bonne journée,' },
  'page.actions.sampleHello': { en: 'Hi Julie,', fr: 'Bonjour Julie,' },
  'page.actions.sampleMarked': {
    en: 'i have send you the file yesterday evening',
    fr: 'je vous est envoyé le fichier hier soir',
  },
  'page.actions.sampleRest': { en: ', tell me if its ok.', fr: ', dite moi si sa convient.' },
  'page.actions.grid': { en: 'Actions in the menu', fr: 'Actions dans le menu' },
  'page.actions.inMenu': { en: '{name} in the menu', fr: '{name} dans le menu' },
  'page.actions.free': { en: 'Free instruction:', fr: 'Consigne libre :' },
  'page.actions.or': { en: 'or', fr: 'ou' },
  'page.actions.freeEnd': {
    en: ', and the last tile while there is room.',
    fr: ', et la dernière tuile tant qu’il reste de la place.',
  },
  'page.actions.full': {
    en: ' The menu is full: remove an action to add another.',
    fr: ' Le menu est plein : retirez une action pour en ajouter une autre.',
  },
  'page.actions.modified': { en: 'Modified', fr: 'Modifiée' },
  'page.actions.count': { en: '{count} / 8,000', fr: '{count} / 8 000' },
  'page.actions.countInvalid': { en: '1 to 8,000 characters.', fr: 'De 1 à 8 000 caractères.' },
  'page.actions.instructionNote': {
    en: 'Write the language you want in the instruction. The selected text is sent after it.',
    fr: 'Écrivez la langue voulue dans la consigne. Le texte sélectionné est envoyé après elle.',
  },
  'page.actions.limit': { en: '24 actions at most.', fr: 'Vingt-quatre actions au plus.' },
  // After replacing.
  'page.after.preview': { en: 'Preview after replacing', fr: 'Aperçu après remplacement' },
  'page.after.s1': { en: 'I ', fr: 'Je vous ' },
  'page.after.w1': { en: 'have', fr: 'ai' },
  'page.after.s2': { en: ' sent you the file last night. ', fr: ' envoyé le fichier hier soir. ' },
  'page.after.w2': { en: 'Tell', fr: 'Dites' },
  'page.after.s3': { en: ' me if ', fr: '-moi si ' },
  'page.after.w3': { en: 'that', fr: 'ça' },
  'page.after.s4': { en: ' works for you on Thursday.', fr: ' vous convient pour jeudi.' },
  'page.after.confirmation': { en: 'Confirmation', fr: 'Confirmation' },
  'page.after.undoGroup': { en: 'Undo', fr: 'Annuler' },
  'page.after.undoButton': { en: 'Undo button', fr: 'Bouton Annuler' },
  'page.after.words': { en: 'Changed words', fr: 'Mots changés' },
  'page.after.style': { en: 'Style', fr: 'Style' },
  'page.after.encre': { en: 'Iridescent ink', fr: 'Encre irisée' },
  'page.after.encreHint': {
    en: 'The text itself lights up, in a soft gradient.',
    fr: 'Le texte lui-même s’allume, en dégradé doux.',
  },
  'page.after.eclat': { en: 'Glow', fr: 'Éclat' },
  'page.after.eclatHint': {
    en: 'A thin line and a halo: easy to tell even when colours are hard to distinguish.',
    fr: 'Un trait fin et un halo : lisible aussi quand les couleurs se distinguent mal.',
  },
  'page.after.minSec': { en: '{min} min {sec} s', fr: '{min} min {sec} s' },
  // Appearance.
  'page.appearance.perleHint': { en: 'Iridescent, it breathes', fr: 'Irisée, elle respire' },
  'page.appearance.nebulaHint': { en: 'Three colours mingled', fr: 'Trois couleurs mêlées' },
  'page.appearance.ribbonHint': { en: 'Three waves gliding', fr: 'Trois ondes qui glissent' },
  'page.appearance.motion': { en: 'Motion', fr: 'Mouvement' },
  'page.appearance.motionHelp': {
    en: 'How the menu opens. Hover a preview to replay it.',
    fr: 'Comment le menu s’ouvre. Survolez un aperçu pour le rejouer.',
  },
  'page.appearance.smoothHint': {
    en: 'The menu opens and settles, without overshoot.',
    fr: 'Le menu s’ouvre et se pose, sans dépasser.',
  },
  'page.appearance.bouncyHint': {
    en: 'The menu overshoots a little, then comes back.',
    fr: 'Le menu dépasse un peu, puis revient.',
  },
  'page.appearance.miniAction': { en: 'Fix', fr: 'Corriger' },
  'page.appearance.sample': {
    en: 'Could you send me the signed quote before Friday?',
    fr: 'Could you send me the signed quote before Friday?',
  },
  // Server.
  'page.server.new': { en: 'New server', fr: 'Nouveau serveur' },
  'page.server.default': { en: 'Default', fr: 'Par défaut' },
  'page.server.edit': { en: 'Edit', fr: 'Modifier' },
  'page.server.searching': { en: 'Looking…', fr: 'Recherche…' },
  'page.server.keyNone': { en: 'None', fr: 'Aucune' },
  'page.server.keyMissing': { en: 'Needed', fr: 'À renseigner' },
  'page.server.remove': { en: 'Remove this server', fr: 'Retirer ce serveur' },
  'page.server.removeConfirm': {
    en: 'This server and its key will be removed from this device.',
    fr: 'Ce serveur et sa clé seront retirés de cet appareil.',
  },
  'page.server.removeConfirmDefault': {
    en: 'This server and its key will be removed from this device. {server} becomes the default server.',
    fr: 'Ce serveur et sa clé seront retirés de cet appareil. {server} devient le serveur par défaut.',
  },
  'page.server.removeAction': { en: 'Remove', fr: 'Retirer' },
  'page.server.removeKeep': { en: 'Keep', fr: 'Garder' },
  'page.server.defaultPending': {
    en: '{server} can become the default once it has an address and a model.',
    fr: '{server} pourra devenir le serveur par défaut une fois son adresse et son modèle renseignés.',
  },
  'page.server.defaultTitle': { en: 'Default server', fr: 'Serveur par défaut' },
  'page.server.defaultHelp': {
    en: 'The one the menu and the shortcuts use.',
    fr: 'Celui qu’utilisent le menu et les raccourcis.',
  },
  'page.server.add': { en: 'Add a server', fr: 'Ajouter un serveur' },
  'page.server.addHelp': {
    en: 'A second server, for example a local model for private texts.',
    fr: 'Un second serveur, par exemple un modèle local pour les textes privés.',
  },
  // Data.
  'page.data.historyKeep': { en: 'Keep encrypted history', fr: 'Conserver l’historique chiffré' },
  'page.data.history': { en: 'History', fr: 'Historique' },
  'page.data.off': {
    en: 'Off: the next texts will not be kept.',
    fr: 'Désactivé : les prochains textes ne seront pas gardés.',
  },
  'page.data.confirmOne': {
    en: 'Delete the entry of the history? This cannot be undone.',
    fr: 'Supprimer l’entrée de l’historique ? Cette action est définitive.',
  },
  'page.data.confirmOther': {
    en: 'Delete the {count} entries of the history? This cannot be undone.',
    fr: 'Supprimer les {count} entrées de l’historique ? Cette action est définitive.',
  },
  'page.data.keep': { en: 'Keep', fr: 'Garder' },
  'page.data.cleared': { en: 'History deleted', fr: 'Historique supprimé' },
  'page.data.empty': { en: 'No saved text.', fr: 'Aucun texte enregistré.' },
  'page.data.countOne': {
    en: '{count} entry · the oldest one goes after 7 days.',
    fr: '{count} entrée · la plus ancienne s’efface après 7 jours.',
  },
  'page.data.countOther': {
    en: '{count} entries · the oldest one goes after 7 days.',
    fr: '{count} entrées · la plus ancienne s’efface après 7 jours.',
  },
} satisfies Record<string, Record<Language, string>>;
