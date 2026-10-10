import type { ProfileField, SettingsField } from '../types';
import type { PageId } from './nav';

// Direct links to one field of the Settings window (lot 13, for the configuration errors of
// lot 10), after the lab's MockSettings (design-lab/src/Simulator.jsx): scroll to the field,
// focus it, and make it pulse for 2.8 s (two pulses of 1.4 s); in reduced motion the scroll
// jumps and the highlight holds still for the same time. Every field that can be targeted
// carries data-field with one of these stable identifiers.
export type FieldId = 'menuShortcut' | `${string}.${ProfileField}`;
export const highlightMs = 2800;
const profileFields: readonly ProfileField[] = ['endpoint', 'apiKey', 'model'];

// A bare server field (what lot 10 sends for an error of the running request) means the
// default server's; `<serverId>.<field>` names one of the servers; anything unknown is ignored.
export function resolveField(
  field: string | null | undefined,
  servers: readonly { id: string }[],
  defaultServerId: string,
): FieldId | null {
  if (!field) return null;
  if (field === 'menuShortcut') return field;
  if ((profileFields as readonly string[]).includes(field)) return `${defaultServerId}.${field as ProfileField}`;
  const [id, name, extra] = field.split('.');
  if (
    extra === undefined &&
    servers.some((server) => server.id === id) &&
    (profileFields as readonly string[]).includes(name)
  )
    return `${id}.${name as ProfileField}`;
  return null;
}
export const isProfileField = (id: FieldId): id is `${string}.${ProfileField}` => id !== 'menuShortcut';
// Since 0.6 every field lives on one page: the window opens that page first, and for a server
// field unfolds that server's card (src/settings/SettingsWindow.tsx).
export const pageOfField = (id: FieldId): PageId => (isProfileField(id) ? 'server' : 'shortcuts');
export const serverOfField = (id: FieldId): string | null =>
  isProfileField(id) ? id.slice(0, id.lastIndexOf('.')) : null;
// The field asked for when the window opened (`?window=settings&field=…`).
export const fieldFromLocation = (search: string): SettingsField | null =>
  new URLSearchParams(search).get('field') as SettingsField | null;

const entry =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])';
const focusable = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';
// Scrolls to the field, focuses its control and restarts its highlight; returns a function
// that removes the highlight at once, or null when the field is not rendered.
export function revealField(root: ParentNode, id: FieldId, reduced: boolean): (() => void) | null {
  const element = root.querySelector<HTMLElement>(`[data-field="${id}"]`);
  if (!element) return null;
  element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  // The field itself before any button beside it (« My server has no key » sits above the key).
  const control = element.matches(focusable)
    ? element
    : (element.querySelector<HTMLElement>(entry) ?? element.querySelector<HTMLElement>(focusable));
  control?.focus({ preventScroll: true });
  // Asked again while it still pulses: start over.
  delete element.dataset.target;
  void element.offsetWidth;
  element.dataset.target = 'true';
  const timer = window.setTimeout(() => {
    delete element.dataset.target;
  }, highlightMs);
  return () => {
    window.clearTimeout(timer);
    delete element.dataset.target;
  };
}
