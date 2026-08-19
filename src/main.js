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
    window.__SKY = { game, dbg: game.dbg };
    bootMsg.remove();
    game.start();
    console.log(`SKYFORGE ${VERSION} ready`);
  } catch (err) {
    console.error(err);
    bootMsg.textContent = 'Ошибка запуска';
    bootMsg.style.letterSpacing = '0';
    throw err;
  }
}

boot();

void Dbg;
