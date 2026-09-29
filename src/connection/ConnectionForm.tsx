// Address, key, the live check and the model picker: one component for the setup (step 3) and
// Settings > Server (docs/DESIGN-REGLAGES.md, « Connexion »). Stub with its final props.
export type ConnectionValue = { endpoint: string; apiKey: string; model: string };
export type ConnectionFormProps = {
  value: ConnectionValue;
  // immediate: false while typing (the caller saves after a pause), true for a choice.
  onChange: (next: ConnectionValue, immediate: boolean) => void;
  variant: 'setup' | 'settings';
  // « Voir le journal »: open the Diagnostic filtered on one check (run id), when the host has it.
  onOpenLog?: (run?: string) => void;
  // Whether a model is chosen on a server that answered: the setup's « Continue » waits for it.
  onReady?: (ready: boolean) => void;
};
export function ConnectionForm(_props: ConnectionFormProps) { return <div className="connection-form" />; }
