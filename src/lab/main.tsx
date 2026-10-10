import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, ExternalLink, FlaskConical } from 'lucide-react';
import {
  ilotScenarioFrom,
  ilotScenarios,
  resultScenarioFrom,
  resultScenarios,
  scenarios,
  scenarioFrom,
} from './scenarios';
import { BugWorkbench } from './bugs';
import './workbench.css';

const labScenarioFrom = (value: string | null) =>
  ilotScenarioFrom(value) ?? resultScenarioFrom(value) ?? scenarioFrom(value);

function Workbench() {
  const initial = new URLSearchParams(location.search);
  const [scenario, setScenario] = useState<string>(labScenarioFrom(initial.get('scenario')).id);
  const [preset, setPreset] = useState(initial.get('preset') === 'bouncy' ? 'bouncy' : 'smooth');
  const [theme, setTheme] = useState(initial.get('theme') === 'light' ? 'light' : 'dark');
  const requestedSize = initial.get('size') ?? '900x600';
  const [size, setSize] = useState(
    ['900x600', '620x640', '480x640', '1280x800'].includes(requestedSize) ? requestedSize : '900x600',
  );
  const [reduced, setReduced] = useState(initial.get('motion') === 'reduce');
  const [run, setRun] = useState(0);
  const [width, height] = size.split('x').map(Number);
  const selected = labScenarioFrom(scenario);
  // The frame opens in the Îlot, the app's default; a state of the 0.4 journey asks for it (`ui`).
  const query = new URLSearchParams({
    scenario,
    theme,
    motion: reduced ? 'reduce' : 'full',
    ...(preset === 'bouncy' ? { preset } : {}),
    ...('ui' in selected ? { ui: selected.ui } : {}),
  });
  const src = `/lab-frame.html?${query}`;
  function remember(next: Record<string, string>) {
    const params = new URLSearchParams({
      view: 'states',
      scenario,
      theme,
      size,
      motion: reduced ? 'reduce' : 'full',
      preset,
      ...next,
    });
    history.replaceState(null, '', `/lab.html?${params}`);
  }
  return (
    <main className="workbench">
      <header>
        <div>
          <span className="eyebrow">
            <FlaskConical size={15} /> Overtype / Développement
          </span>
          <h1>Atelier d’interface</h1>
          <p>Un scénario, un défaut, une correction vérifiable.</p>
        </div>
        <span className="local-badge">Local · données fictives</span>
      </header>
      <div className="workspace">
        <nav aria-label="Scénarios">
          <a href="/lab.html">← Défauts signalés</a>
          <span className="section-label">ÉTATS TECHNIQUES</span>
          {scenarios.map((item) => (
            <button
              key={item.id}
              aria-current={scenario === item.id ? 'page' : undefined}
              onClick={() => {
                setScenario(item.id);
                remember({ scenario: item.id });
              }}
            >
              <span>{item.label}</span>
              <small>{item.issue}</small>
            </button>
          ))}
          <span className="section-label">ÎLOT (LOT 7)</span>
          {ilotScenarios.map((item) => (
            <button
              key={item.id}
              aria-current={scenario === item.id ? 'page' : undefined}
              onClick={() => {
                setScenario(item.id);
                remember({ scenario: item.id });
              }}
            >
              <span>{item.label}</span>
              <small>{item.issue}</small>
            </button>
          ))}
          <span className="section-label">RÉSULTAT (LOTS 9-10)</span>
          {resultScenarios.map((item) => (
            <button
              key={item.id}
              aria-current={scenario === item.id ? 'page' : undefined}
              onClick={() => {
                setScenario(item.id);
                remember({ scenario: item.id });
              }}
            >
              <span>{item.label}</span>
              <small>{item.issue}</small>
            </button>
          ))}
        </nav>
        <section className="review" aria-label="Zone de revue">
          <div className="controls">
            <label>
              Fenêtre
              <select
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  remember({ size: e.target.value });
                }}
              >
                <option value="900x600">900 × 600</option>
                <option value="620x640">620 × 640</option>
                <option value="480x640">480 × 640</option>
                <option value="1280x800">1280 × 800</option>
              </select>
            </label>
            <label>
              Fond d’essai
              <select
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  remember({ theme: e.target.value });
                }}
              >
                <option value="dark">Sombre</option>
                <option value="light">Clair</option>
              </select>
            </label>
            <label>
              Mouvement
              <select
                value={preset}
                onChange={(e) => {
                  setPreset(e.target.value);
                  remember({ preset: e.target.value });
                }}
              >
                <option value="smooth">Apple « smooth »</option>
                <option value="bouncy">Apple « bouncy »</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={reduced}
                onChange={(e) => {
                  setReduced(e.target.checked);
                  remember({ motion: e.target.checked ? 'reduce' : 'full' });
                }}
              />
              Mouvements réduits
            </label>
            <button className="replay" onClick={() => setRun(run + 1)}>
              <RotateCcw size={15} />
              Rejouer
            </button>
            <a href={src} target="_blank" rel="noreferrer" aria-label="Ouvrir le scénario seul">
              <ExternalLink size={17} />
            </a>
          </div>
          <div className="canvas">
            <iframe key={`${src}-${run}`} title="Scénario Overtype" src={src} width={width} height={height} />
          </div>
          <footer>
            <strong>
              {selected.issue} · {selected.label}
            </strong>
            <p>{selected.expected}</p>
            <small>
              Taille réelle, sans mise à l’échelle. Faire défiler l’atelier si nécessaire. Ce rendu web ne valide ni le
              dépoli du bureau ni le focus Windows.
            </small>
          </footer>
        </section>
      </div>
    </main>
  );
}
if (import.meta.env.DEV)
  createRoot(document.getElementById('root')!).render(
    new URLSearchParams(location.search).get('view') === 'states' ? <Workbench /> : <BugWorkbench />,
  );
