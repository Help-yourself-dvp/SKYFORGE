import { VERSION } from './config.js';
import { Game } from './game.js';
import { Dbg } from './dbg.js';

async function boot() {
  const canvas = document.getElementById('c');
  const bootMsg = document.createElement('div');
  bootMsg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#e6dcc8;font:15px system-ui;letter-spacing:.18em;background:#0b1220;z-index:5';
  bootMsg.textContent = 'SKYFORGE';
  document.body.appendChild(bootMsg);
  const game = new Game(canvas);
  try {
    await game.init();
    window.__SKY = {
      game,
      dbg: game.dbg,
      getDiagnostics: () => game.getDiagnostics(),
    };
    bootMsg.remove();
    game.start();
    console.log(`SKYFORGE ${VERSION} ready`);
  } catch (err) {
    console.error(err);
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
    bootMsg.style.cssText = 'position:fixed;inset:0;padding:24px;overflow:auto;color:#e6dcc8;font:13px/1.4 ui-monospace,monospace;background:#0b1220;z-index:5;white-space:pre-wrap';
    bootMsg.textContent = `Ошибка запуска\n\n${msg}`;
  }
}

boot();

void Dbg;
