import { createRoot } from 'react-dom/client';
import { injectTokens } from './tokens/index.js';
import { LabProvider } from './lab/store.jsx';
import App from './App.jsx';
import './lab/lab.css';

injectTokens();
createRoot(document.getElementById('root')).render(<LabProvider><App /></LabProvider>);
