import { VERSION } from '../config.js';
import { PART_DEFS, PART_ORDER } from '../build/parts.js';
import { RESOURCE_DEFS } from '../craft/resources.js';
import { RECIPES, isRecipeOpen } from '../craft/recipes.js';

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.toastT = 0;
    this.holdNew = 0;
    this.holdingNew = false;
    this.aboutOpen = false;
    this._build();
    this._bind();
  }

  _el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  _build() {
    this.root.innerHTML = '';
    this.top = this._el(`<div class="hud-top">
      <div class="bars">
        <div class="bar hp"><i></i></div>
        <div class="bar hu"><i></i></div>
        <div class="bar th"><i></i></div>
      </div>
      <div class="meta"><span class="tod"></span><span class="vane"></span></div>
    </div>`);
    this.prompt = this._el(`<div class="prompt"></div>`);
    this.toastEl = this._el(`<div class="toast"></div>`);
    this.charge = this._el(`<div class="charge"></div>`);
    this.stick = this._el(`<div class="stick" data-ui><div class="stick-knob"></div></div>`);
    this.actions = this._el(`<div class="actions" data-ui>
      <button class="btn a hit" data-act="jump"><span>Прыжок</span></button>
      <button class="btn x hit" data-act="action"><span>Действие</span></button>
      <button class="btn b hit" data-act="build"><span>Сборка</span></button>
      <button class="btn atk hit" data-act="attack"><span>Удар</span></button>
    </div>`);
    this.invBtn = this._el(`<button class="btn inv hit" data-ui data-act="inventory"><span>Сумка</span></button>`);
    this.pauseBtn = this._el(`<button class="btn pause hit" data-ui data-act="pause"><span>Пауза</span></button>`);
    this.flashEl = this._el(`<div class="flash"></div>`);

    this.title = this._el(`<div class="overlay title hit" data-ui>
      <div class="panel">
        <div class="title-mark">SKYFORGE</div>
        <h1 class="title-name">SKYFORGE</h1>
        <div class="title-sub">Кузница Небес</div>
        <div class="title-hint">Коснитесь, чтобы начать</div>
        <div class="ver">${VERSION}</div>
      </div>
    </div>`);

    this.pause = this._el(`<div class="overlay menu" data-ui hidden>
      <div class="panel hit">
        <div class="title-mark">ПАУЗА</div>
        <button class="hit" data-menu="resume">Продолжить</button>
        <button class="hit" data-menu="build">Строительство</button>
        <button class="hit" data-menu="inv">Инвентарь</button>
        <button class="hit" data-menu="about">О мире</button>
        <button class="hit" data-menu="new">Новый мир</button>
        <div class="holdbar"><i></i></div>
        <div class="ver">${VERSION}</div>
      </div>
    </div>`);

    this.inv = this._el(`<div class="inv hit" data-ui hidden><div class="title-mark">ЗАПАС</div><div class="slots"></div></div>`);
    this.craft = this._el(`<div class="craft hit" data-ui hidden><div class="title-mark">ВЕРСТАК</div><div class="slots"></div></div>`);
    this.about = this._el(`<div class="about hit" data-ui hidden>
      <div class="title-mark">О МИРЕ</div>
      <p>Парящий архипелаг живёт своей погодой и весом. Дерево падает. Машина собирается из частей. Свет держит ночь.</p>
      <button class="rowbtn hit" data-menu="resume">Закрыть</button>
    </div>`);
    this.buildbar = this._el(`<div class="buildbar hit" data-ui hidden></div>`);
    this.buildTools = this._el(`<div class="build-tools" hidden>
      <button class="hit" data-build="rotL">Поворот</button>
      <button class="hit" data-build="rotR">Наклон</button>
      <button class="hit" data-build="cart">Чертёж: тележка</button>
      <button class="hit" data-build="launch">Пуск</button>
      <button class="hit" data-build="stop">Стоп</button>
      <button class="hit" data-build="clear">Сброс</button>
    </div>`);
    this.flip = this._el(`<button class="btn hit" data-ui data-act="flip" hidden style="left:50%;bottom:20%;transform:translateX(-50%);width:auto;padding:0 16px;border-radius:8px">Поставить на колёса</button>`);

    for (const n of [this.top, this.prompt, this.toastEl, this.charge, this.stick, this.actions, this.invBtn, this.pauseBtn, this.flashEl, this.title, this.pause, this.inv, this.craft, this.about, this.buildbar, this.buildTools, this.flip]) {
      this.root.appendChild(n);
    }
    this._fillBuild();
  }

  _fillBuild() {
    this.buildbar.innerHTML = '';
    for (const id of PART_ORDER) {
      const b = document.createElement('button');
      b.className = 'part hit';
      b.dataset.part = id;
      const n = this.game.buildStock?.[id] ?? 0;
      b.textContent = `${PART_DEFS[id].name}\n${n}`;
      this.buildbar.appendChild(b);
    }
  }

  _bind() {
    const act = (name, down) => {
      this.game.audio.resume();
      if (down) this.game.input.press(name);
      else this.game.input.release(name);
    };
    this.root.addEventListener('pointerdown', (e) => {
      const neu = e.target.closest('[data-menu="new"]');
      if (neu) {
        e.preventDefault();
        this.holdingNew = true;
        this.holdNew = 0.01;
        return;
      }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      act(btn.dataset.act, true);
    });
    const endHold = () => {
      this.holdingNew = false;
      this.holdNew = 0;
    };
    this.root.addEventListener('pointerup', (e) => {
      if (this.holdingNew) endHold();
      const btn = e.target.closest('[data-act]');
      if (btn) act(btn.dataset.act, false);
    });
    this.root.addEventListener('pointercancel', () => {
      if (this.holdingNew) endHold();
    });
    this.root.addEventListener('click', (e) => {
      const menu = e.target.closest('[data-menu]');
      if (menu) this._menu(menu.dataset.menu);
      const part = e.target.closest('[data-part]');
      if (part) this.game.build.setType(part.dataset.part);
      const bd = e.target.closest('[data-build]');
      if (bd) this.game.build.command(bd.dataset.build);
      const rec = e.target.closest('[data-recipe]');
      if (rec) this.game.tryCraft(rec.dataset.recipe);
    });
    this.title.addEventListener('pointerdown', () => {
      this.game.audio.resume();
      this.game.startFromTitle();
    });
  }

  _open(el, on) {
    if (!el) return;
    if (on) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  _menu(id) {
    this.game.audio.play('ui');
    if (id === 'resume') this.game.resume();
    if (id === 'build') {
      this.game.resume();
      this.game.enterBuild();
    }
    if (id === 'inv') {
      this.game.resume();
      this.game.toggleInventory();
    }
    if (id === 'about') {
      this.aboutOpen = true;
      this._open(this.about, true);
    }
    if (id === 'resume') this.aboutOpen = false;
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastT = 3.4;
  }

  flash() {
    this.flashEl.classList.add('on');
    setTimeout(() => this.flashEl.classList.remove('on'), 700);
  }

  update(dt) {
    const g = this.game;
    const s = g.survival;
    this.top.querySelector('.hp i').style.width = `${s.health}%`;
    this.top.querySelector('.hu i').style.width = `${s.hunger}%`;
    this.top.querySelector('.th i').style.width = `${s.thirst}%`;
    const tod = g.daynight.timeOfDay;
    const hh = String(Math.floor(tod * 24)).padStart(2, '0');
    const mm = String(Math.floor((tod * 24 * 60) % 60)).padStart(2, '0');
    this.top.querySelector('.tod').textContent = `${hh}:${mm}  ${g.weather.state}`;
    const ang = Math.atan2(g.wind.vector.x, g.wind.vector.z) * 180 / Math.PI;
    this.top.querySelector('.vane').style.setProperty('--rot', `${ang}deg`);
    this.prompt.textContent = g.interact.prompt || '';
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }
    const st = g.input._stickId != null;
    const knob = this.stick.querySelector('.stick-knob');
    knob.style.transform = st ? `translate(${g.input.move.x * 34}px, ${-g.input.move.y * 34}px)` : '';
    const ch = g.player.throwCharge || 0;
    this.charge.classList.toggle('on', ch > 0.02);
    this.charge.style.setProperty('--p', `${ch * 100}`);

    const explore = ['explore', 'grab', 'build', 'drive'].includes(g.state);
    this.stick.style.display = explore ? '' : 'none';
    this.actions.style.display = explore ? '' : 'none';
    this.invBtn.style.display = explore ? '' : 'none';
    this.pauseBtn.style.display = g.state === 'title' ? 'none' : '';
    this.top.style.display = g.state === 'title' ? 'none' : '';
    this._open(this.title, g.state === 'title');
    this._open(this.pause, g.state === 'pause');
    this._open(this.inv, g.state === 'inventory');
    this._open(this.craft, g.state === 'craft');
    this._open(this.buildbar, g.state === 'build');
    this._open(this.buildTools, g.state === 'build');
    this._open(this.flip, g.state === 'drive' && g.machine.flipTimer > 2.5);
    if (g.state !== 'pause') this._open(this.about, false);

    if (g.state === 'inventory') this._inv();
    if (g.state === 'craft') this._craft();
    if (g.state === 'build') this._buildStock();

    if (this.holdingNew && g.state === 'pause') {
      this.holdNew += dt;
      this.pause.querySelector('.holdbar i').style.width = `${Math.min(100, (this.holdNew / 2) * 100)}%`;
      if (this.holdNew >= 2) {
        this.holdingNew = false;
        this.holdNew = 0;
        g.newWorld();
      }
    } else {
      const hb = this.pause.querySelector('.holdbar i');
      if (hb && !this.holdingNew) hb.style.width = '0';
    }

    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const lock = document.getElementById('portrait-lock');
    if (lock) lock.hidden = !portrait;
    g.portraitLocked = portrait;
  }

  _inv() {
    const box = this.inv.querySelector('.slots');
    const items = [];
    for (const [k, v] of Object.entries(this.game.inventory)) {
      if (v > 0) items.push(`<div class="slot"><b>${RESOURCE_DEFS[k]?.name || k}</b>${v}</div>`);
    }
    for (const t of this.game.tools) items.push(`<div class="slot"><b>${t}</b>инструмент</div>`);
    box.innerHTML = items.join('') || '<div class="slot">Пусто</div>';
  }

  _craft() {
    const box = this.craft.querySelector('.slots');
    box.innerHTML = RECIPES.map((r) => {
      const open = isRecipeOpen(r, this.game.unlocks);
      const cost = Object.entries(r.cost).map(([k, n]) => `${RESOURCE_DEFS[k]?.name || k} ${n}`).join(', ');
      return `<button class="slot hit" data-recipe="${r.id}" ${open ? '' : 'disabled'}><b>${r.name}</b>${open ? cost : 'ещё не открыто'}</button>`;
    }).join('');
  }

  _buildStock() {
    for (const b of this.buildbar.querySelectorAll('[data-part]')) {
      const id = b.dataset.part;
      b.textContent = `${PART_DEFS[id].name}\n${this.game.buildStock[id] || 0}`;
      b.classList.toggle('on', this.game.build.type === id);
    }
  }
}
