import './style.css';
import { Soundscape } from './audio/audio';
import { Game } from './game/Game';
import { Hud } from './ui/hud';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #app');
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const audio = new Soundscape();
const hud = new Hud(root);

if (!webglAvailable()) {
  hud.showError();
} else {
  try {
    const game = new Game(hud, audio);
    void game.start();
    if (import.meta.env.DEV) {
      (window as Window & { __bowl?: () => unknown }).__bowl = () => game.debugState();
    }
    if (import.meta.hot) import.meta.hot.dispose(() => game.destroy());
  } catch (error) {
    console.error(error);
    hud.showError();
  }
}
