import type { MessageKey, Translate } from '../i18n';

// Rust still refuses a save with a French sentence (lot 10 turns errors into codes). The
// refusals the Settings window can meet are shown in the interface's language; any other
// message stays as Rust wrote it (it never holds a payload or a secret).
const refusals: Record<string, MessageKey> = {
  'Le raccourci est déjà utilisé ou indisponible.': 'shortcuts.taken',
  'Deux raccourcis actifs utilisent la même combinaison.': 'shortcuts.duplicate',
  'Le raccourci n’est pas reconnu.': 'shortcuts.unknown',
  'Le raccourci est trop long.': 'shortcuts.unknown',
  'La touche Windows est réservée au système.': 'shortcuts.windowsKey',
  'F12 est réservée par Windows.': 'shortcuts.f12',
  'Ajoutez Ctrl ou Alt à la combinaison.': 'shortcuts.needModifier',
  'Cette combinaison est réservée à Windows.': 'shortcuts.system',
  'La touche d’une action est une seule lettre.': 'grid.lettersInvalid',
  'La touche d’une action est une lettre, différente pour chaque action.': 'grid.lettersInvalid',
  'La grille du menu contient six actions au plus.': 'grid.tooMany',
  'La consigne doit contenir de 1 à 8 000 caractères, sans caractère nul.': 'actions.promptInvalid',
  'Démarrage automatique indisponible.': 'settings.autostartUnavailable',
  // The refusals of 0.6 (settings::validate, actions::validate).
  'L’adresse du serveur est invalide.': 'refusal.address',
  'L’adresse du serveur ne doit pas contenir d’identifiants.': 'refusal.addressCredentials',
  'L’adresse du serveur doit commencer par https:// ou http://.': 'refusal.addressScheme',
  'Il faut de 1 à 8 serveurs.': 'refusal.servers',
  'Le modèle d’un serveur est invalide.': 'refusal.model',
  'Le nom d’un serveur est invalide.': 'refusal.serverName',
  'La clé d’un serveur est invalide.': 'refusal.key',
  'L’identifiant d’un serveur est invalide.': 'refusal.servers',
  'Le serveur par défaut n’existe pas.': 'refusal.servers',
  'La durée d’annulation doit être comprise entre 2 et 20 secondes.': 'refusal.undoSeconds',
  'La durée des mots changés doit être comprise entre 5 et 120 secondes.': 'refusal.wordsSeconds',
  'Le nom d’une action doit contenir de 1 à 60 caractères.': 'refusal.actionName',
  'Configurez entre 1 et 24 actions.': 'refusal.actions',
};

export function describeRefusal(message: string, t: Translate): string {
  const key = refusals[message.trim()];
  return key ? t(key) : message;
}
