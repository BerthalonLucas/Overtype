import type { Server, Settings } from '../types';

// The servers of the Settings (docs/PLAN-0.6.md §1): one by default, « Ajouter un serveur » for a
// second; the interface shows two at most (Rust accepts up to eight, ids [a-z0-9-]{1,32}, unique,
// and defaultServerId always names one of them).
export const shownServers = 2;
export const emptyServer = (id: string): Server => ({
  id,
  name: '',
  endpoint: '',
  apiKey: '',
  noKey: false,
  model: '',
});
export function newServerId(servers: readonly Pick<Server, 'id'>[]): string {
  for (let n = 1; ; n += 1) {
    const id = `s${n}`;
    if (!servers.some((server) => server.id === id)) return id;
  }
}
export const canAddServer = (settings: Pick<Settings, 'servers'>) => settings.servers.length < shownServers;
export function addServer(settings: Settings): { settings: Settings; id: string | null } {
  if (!canAddServer(settings)) return { settings, id: null };
  const id = newServerId(settings.servers);
  return { settings: { ...settings, servers: [...settings.servers, emptyServer(id)] }, id };
}
// The last server is never removed; removing the default one hands the default to the first left.
export function removeServer(settings: Settings, id: string): Settings {
  if (settings.servers.length <= 1 || !settings.servers.some((server) => server.id === id)) return settings;
  const servers = settings.servers.filter((server) => server.id !== id);
  return {
    ...settings,
    servers,
    defaultServerId: settings.defaultServerId === id ? servers[0].id : settings.defaultServerId,
  };
}
// A server the menu and the shortcuts can use: an address and a model.
export const usable = (server: Pick<Server, 'endpoint' | 'model'>) =>
  server.endpoint.trim() !== '' && server.model.trim() !== '';
// Never a server that is not set up: every shortcut would end in « Adresse du serveur erronée ».
export function setDefaultServer(settings: Settings, id: string): Settings {
  const server = settings.servers.find((item) => item.id === id);
  return server && usable(server) ? { ...settings, defaultServerId: id } : settings;
}
// noKey true drops the key (Rust would too); the id never changes.
export function updateServer(settings: Settings, id: string, patch: Partial<Omit<Server, 'id'>>): Settings {
  return {
    ...settings,
    servers: settings.servers.map((server) => {
      if (server.id !== id) return server;
      const next = { ...server, ...patch };
      return next.noKey ? { ...next, apiKey: '' } : next;
    }),
  };
}
