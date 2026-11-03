import './styles.css';
import { App } from './app.ts';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app');
try {
  new App(root);
} catch (e) {
  root.textContent = `Wizard's Gambit failed to start: ${e instanceof Error ? e.message : String(e)}`;
  throw e;
}
