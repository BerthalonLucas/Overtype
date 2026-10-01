import type { Settings } from '../types';

// « Restore default settings » (Lucas, 24/09; mirrors settings::reset in Rust, for the browser
// preview and the tests): a fresh install's settings, keeping what sets this device up, the
// connection (its servers and the default one), the setup already done, the history switch, the start at sign-in and
// the language of the interface.
export function resetFrom(fresh: Settings, current: Settings): Settings {
  return {
    ...structuredClone(fresh),
    servers: structuredClone(current.servers), defaultServerId: current.defaultServerId, setupDone: current.setupDone,
    historyEnabled: current.historyEnabled, autostart: current.autostart, language: current.language,
  };
}
