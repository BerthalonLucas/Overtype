import type { Language } from '../types';

// Strings of the first-run setup, merged into the one dictionary of src/i18n.ts. French is the
// design lab's text, word for word (design-lab/reglages/src/journey); the app's name is `{app}`.
export const setupMessages = {
  'setup.windowTitle': { en: 'Setting up {app}', fr: 'Configuration de {app}' },
  'setup.progress': { en: 'Step {n} of {total}', fr: 'Étape {n} sur {total}' },
  'setup.back': { en: 'Back', fr: 'Retour' },
  'setup.continue': { en: 'Continue', fr: 'Continuer' },
  'setup.skip': { en: 'Skip', fr: 'Passer' },
  'setup.later': { en: 'Later', fr: 'Plus tard' },
  'setup.loading': { en: 'Reading your settings…', fr: 'Lecture de vos réglages…' },
  'setup.loadError': { en: 'Your settings could not be read.', fr: 'Impossible de lire vos réglages.' },
  'setup.notSaved': { en: 'This choice could not be saved.', fr: 'Ce choix n’a pas pu être enregistré.' },
  'setup.notFinished': { en: 'The setup could not be saved.', fr: 'L’accueil n’a pas pu être enregistré.' },
  // Welcome.
  'setup.welcome.title': { en: 'Welcome to {app}', fr: 'Bienvenue sur {app}' },
  'setup.welcome.text': {
    en: 'Fix, translate and rephrase the selected text, in any application.',
    fr: 'Corrigez, traduisez et reformulez le texte sélectionné, dans n’importe quelle application.',
  },
  'setup.welcome.start': { en: 'Start the setup', fr: 'Commencer le setup' },
  'setup.recovered': {
    en: 'Your settings could not be read: they are kept in {file}, and {app} starts again from the default settings.',
    fr: 'Vos réglages étaient illisibles : ils sont gardés dans {file}, et {app} repart des réglages par défaut.',
  },
  'setup.welcome.note': {
    en: '3 questions and a short demo, about a minute.',
    fr: '3 questions et une courte démo, environ une minute.',
  },
  // Question 1: appearance.
  'setup.look.title': { en: 'How do you want to see {app}?', fr: 'Comment voulez‑vous voir {app} ?' },
  'setup.look.text': {
    en: 'Choose a theme. You can change it at any time.',
    fr: 'Choisissez un thème. Vous pourrez le changer à tout moment.',
  },
  'setup.look.label': { en: 'Appearance of the application', fr: 'Apparence de l’application' },
  'setup.look.system': { en: 'System', fr: 'Système' },
  'setup.look.systemHint': { en: 'Follows Windows', fr: 'Suit Windows' },
  'setup.look.light': { en: 'Light', fr: 'Clair' },
  'setup.look.lightHint': { en: 'Always light', fr: 'Toujours clair' },
  'setup.look.dark': { en: 'Dark', fr: 'Sombre' },
  'setup.look.darkHint': { en: 'Always dark', fr: 'Toujours sombre' },
  'setup.look.note': {
    en: 'The change is immediate. Other applications do not move.',
    fr: 'Le changement est immédiat. Les autres applications ne bougent pas.',
  },
  'setup.look.language': { en: 'Language', fr: 'Langue' },
  // Question 2: shortcut and menu.
  'setup.shortcut.title': { en: 'Which shortcut do you want?', fr: 'Quel raccourci voulez-vous ?' },
  'setup.shortcut.text': {
    en: 'The keys that open {app} on the selected text.',
    fr: 'Les touches qui ouvrent {app} sur le texte sélectionné.',
  },
  'setup.shortcut.label': { en: 'Shortcut', fr: 'Raccourci' },
  'setup.shortcut.note': {
    en: 'Select some text anywhere, then press these keys.',
    fr: 'Sélectionnez du texte n’importe où, puis appuyez sur ces touches.',
  },
  'setup.shortcut.restore': { en: 'Restore {shortcut}', fr: 'Rétablir {shortcut}' },
  'setup.shortcut.change': { en: 'Change', fr: 'Changer' },
  'setup.shortcut.press': { en: 'Press the new combination…', fr: 'Appuyez sur la nouvelle combinaison…' },
  'setup.shortcut.escape': { en: 'Escape to cancel.', fr: 'Échap pour annuler.' },
  'setup.shortcut.when': { en: 'When you press these keys', fr: 'Quand vous appuyez sur ces touches' },
  'setup.shortcut.menu': { en: 'Open the menu', fr: 'Ouvrir le menu' },
  'setup.shortcut.menuText': { en: 'You choose the action each time.', fr: 'Vous choisissez l’action à chaque fois.' },
  'setup.shortcut.direct': { en: 'Run an action directly', fr: 'Lancer directement une action' },
  'setup.shortcut.directText': { en: 'Always the same one, without a menu.', fr: 'Toujours la même, sans menu.' },
  'setup.shortcut.action': { en: 'Action run by the shortcut', fr: 'Action lancée par le raccourci' },
  'setup.shortcut.sample': { en: 'Hello, I am sending', fr: 'Bonjour, je vous envoie' },
  'setup.shortcut.sampleRest': { en: 'the quote', fr: 'le devis' },
  // Question 3: the model.
  'setup.model.title': { en: 'Which model to use?', fr: 'Quel modèle utiliser ?' },
  'setup.model.text': {
    en: 'Your server’s address and its key. We check at once.',
    fr: 'L’adresse de votre serveur et sa clé. On vérifie aussitôt.',
  },
  'setup.model.wait': {
    en: 'Continue as soon as the connection is checked.',
    fr: 'Continuer dès que la connexion est vérifiée.',
  },
  'setup.model.try': { en: 'Try with a sentence', fr: 'Essayer avec une phrase' },
  'setup.model.tryFailed': { en: 'The try failed: {title}. {fix}', fr: 'L’essai a échoué : {title}. {fix}' },
  'setup.model.tryStalled': {
    en: 'The try got no answer. Check the server, then try again.',
    fr: 'L’essai n’a reçu aucune réponse. Vérifiez le serveur, puis réessayez.',
  },
  'setup.model.log': { en: 'Connection journal', fr: 'Journal de connexion' },
  'setup.model.logClose': { en: 'Close the journal', fr: 'Fermer le journal' },
  // Before the demo.
  'setup.demo.title': { en: 'Shall we watch how it works?', fr: 'On regarde comment ça marche ?' },
  'setup.demo.text': {
    en: 'A demonstration of twenty seconds, in three gestures.',
    fr: 'Une démonstration de vingt secondes, en trois gestes.',
  },
  'setup.demo.start': { en: 'Watch the demo', fr: 'Voir la démo' },
  'setup.demo.skip': { en: 'Skip the demo', fr: 'Passer la démo' },
  'setup.demo.select': { en: 'Select', fr: 'Sélectionnez' },
  'setup.demo.selectText': { en: 'some text, anywhere', fr: 'du texte, n’importe où' },
  'setup.demo.press': { en: 'Press', fr: 'Appuyez' },
  'setup.demo.choose': { en: 'Choose', fr: 'Choisissez' },
  'setup.demo.chooseText': { en: 'an action of the menu', fr: 'une action du menu' },
  'setup.demo.note': {
    en: 'This window steps aside while the demo plays, then comes back. You have nothing to do.',
    fr: 'Cette fenêtre s’efface le temps de la démo, puis revient. Vous n’avez rien à faire.',
  },
  'setup.demo.failed': {
    en: 'The demo could not open. You can go on without it.',
    fr: 'La démo n’a pas pu s’ouvrir. Vous pouvez continuer sans elle.',
  },
  // « C'est prêt ».
  'setup.ready.title': { en: 'All set', fr: 'C’est prêt' },
  'setup.ready.text': {
    en: 'You can change everything in Settings.',
    fr: 'Vous pouvez tout modifier dans les Réglages.',
  },
  'setup.ready.open': { en: 'Open Settings', fr: 'Ouvrir les Réglages' },
  'setup.ready.close': { en: 'Close', fr: 'Fermer' },
  'setup.ready.look': { en: 'Appearance', fr: 'Apparence' },
  'setup.ready.shortcut': { en: 'Shortcut', fr: 'Raccourci' },
  'setup.ready.model': { en: 'Model', fr: 'Modèle' },
  'setup.ready.opensMenu': { en: 'opens the menu', fr: 'ouvre le menu' },
  'setup.ready.runs': { en: 'runs “{action}”', fr: 'lance « {action} »' },
  'setup.ready.on': { en: 'on {host}', fr: 'sur {host}' },
  'setup.ready.todo': { en: 'To set up in Settings', fr: 'À configurer dans les Réglages' },
  'setup.ready.edit': { en: 'Edit', fr: 'Modifier' },
  'setup.ready.editOf': { en: 'Edit: {label}', fr: 'Modifier : {label}' },
} satisfies Record<string, Record<Language, string>>;
