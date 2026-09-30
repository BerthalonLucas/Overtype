// The lab shell: toolbar + the current section. Each section is owned by one module (see
// README.md, « Points d'extension »); a crash in one section never takes the lab down.
import { Component } from 'react';
import { MotionConfig } from 'motion/react';
import { useLab } from './lab/store.jsx';
import { Scope } from './lab/Scope.jsx';
import { Toolbar } from './lab/Toolbar.jsx';
import { useClock } from './lib/motion.js';
import { Stage } from './stage/Desktop.jsx';
import Journey from './journey/Journey.jsx';
import Demo from './demo/Demo.jsx';
import SettingsWindow from './settings/SettingsWindow.jsx';
import Catalog from './catalog/Catalog.jsx';
import Effects from './effects/Effects.jsx';
import { HeroPortal } from './heroui/HeroDemo.jsx';

class SectionBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) return <div className="lab-error" role="alert"><strong>Cette section a planté.</strong><pre>{String(this.state.error?.stack || this.state.error)}</pre></div>;
    return this.props.children;
  }
}

// Sections that live on the desktop get a <Stage>; Journey owns its own (it drives the tray,
// the focus window and the transitions between setup, demo and Réglages).
function SectionView({ section }) {
  switch (section) {
    case 'parcours': return <Journey />;
    case 'reglages': return <Stage focus={{ w: 860, h: 600 }}><SettingsWindow standalone /></Stage>;
    case 'demo': return <Stage focus={{ w: 900, h: 740 }}><Demo standalone /></Stage>;
    case 'composants': return <div className="lab-page"><Catalog /></div>;
    case 'effets': return <div className="lab-page"><Effects /></div>;
    default: return null;
  }
}

export default function App() {
  const lab = useLab();
  const clock = useClock();
  const key = `${lab.section}-${lab.restartKey}`;
  return (
    <MotionConfig reducedMotion={clock.reduced ? 'always' : 'never'}>
      <Scope className="lab-app">
        <HeroPortal>
          <Toolbar />
          <main className="lab-main">
            <SectionBoundary resetKey={key}>
              <SectionView key={key} section={lab.section} />
            </SectionBoundary>
          </main>
        </HeroPortal>
      </Scope>
    </MotionConfig>
  );
}
