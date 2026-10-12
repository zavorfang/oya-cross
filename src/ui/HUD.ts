import type { Action, GameSnapshot, Phase } from '../core/types';
import type { Preferences } from '../services/LocalSave';

const svg = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const icons = {
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  sound: svg('<path d="M11 5L6 9H3v6h3l5 4V5zM15 8a6 6 0 010 8M18 5a10 10 0 010 14"/>'),
  mute: svg('<path d="M11 5L6 9H3v6h3l5 4V5zM16 9l5 6m0-6l-5 6"/>'),
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  settings: svg('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--paper)"/><circle cx="15" cy="17" r="3" fill="var(--paper)"/>'),
  trophy: svg('<path d="M8 3h8v7a4 4 0 01-8 0V3zM8 5H4v3a4 4 0 004 4m8-7h4v3a4 4 0 01-4 4M12 14v5m-4 2h8"/>'),
  share: svg('<path d="M12 16V3m-5 5l5-5 5 5M5 13v7h14v-7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  pin: svg('<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z"/><circle cx="12" cy="10" r="2"/>'),
};
const busLogo = `<svg class="brand-bus" viewBox="0 0 48 36" aria-hidden="true"><rect x="3" y="4" width="42" height="25" rx="6" fill="#efbb32"/><path d="M8 10h10v8H8zm13 0h9v8h-9zm12 0h7v8h-7z" fill="#263d3b"/><path d="M3 22h42" stroke="#263d3b" stroke-width="3"/><circle cx="12" cy="30" r="5" fill="#263d3b"/><circle cx="36" cy="30" r="5" fill="#263d3b"/><circle cx="12" cy="30" r="2" fill="#f8f3e9"/><circle cx="36" cy="30" r="2" fill="#f8f3e9"/></svg>`;

export interface HUDCallbacks {
  start: () => void; pause: () => void; resume: () => void; share: () => void;
  preferences: (preferences: Preferences) => void; command: (action: Action) => void;
  settingsOpened: () => void;
}
export class HUD {
  readonly surface: HTMLElement;
  readonly viewport: HTMLElement;
  readonly dialog: HTMLDialogElement;
  private root: HTMLElement;
  private lastPhase?: Phase;
  private lastScore = -1;
  private controlsEnabled = false;
  private toastTimeout?: ReturnType<typeof setTimeout>;
  constructor(root: HTMLElement, preferences: Preferences, callbacks: HUDCallbacks) {
    this.root = root;
    root.innerHTML = `
      <div class="shell">
        <header class="masthead">
          <a class="brand" href="./" aria-label="Lagos Crossing home">${busLogo}<span>LAGOS<span class="brand-light"> CROSSING</span></span></a>
          <span class="header-note"><span class="live-dot"></span> A LITTLE LAGOS. A LOT OF LIFE.</span>
          <div class="header-actions"><button class="text-button" id="help-button">How to play <span>↗</span></button><button class="icon-button" id="settings-button" aria-label="Game settings">${icons.settings}</button></div>
        </header>
        <main class="main-layout">
          <aside class="intro">
            <div class="intro-top"><span class="eyebrow"><span class="dash"></span> THE STREETS ARE CALLING</span>
              <h1>LAGOS<br><span>CROSSING<span class="title-period">.</span></span></h1>
              <p class="tagline">One city.<br>No slow lane.</p>
              <p class="intro-copy">Dodge the danfos. Find your gap.<br>Just one more crossing.</p>
              <div class="record"><span class="record-icon">${icons.trophy}</span><div><span class="small-label">YOUR PERSONAL BEST</span><strong><span data-best>0</span> <small>steps</small></strong></div></div>
            </div>
            <div class="intro-bottom"><div class="instruction-row"><span class="key-cluster"><kbd>↑</kbd><span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span></span><p><strong>A little hop goes a long way.</strong><span>Arrow keys or WASD to move.<br>On your phone? Tap & swipe.</span></p></div><div class="district"><span class="district-icon">${icons.pin}</span><div><b>OSHODI INTERCHANGE</b><span>Inspired by the rhythm of Lagos</span></div><span class="district-number">01</span></div></div>
          </aside>
          <section class="game-frame" id="game-surface" aria-label="Lagos Crossing game. Tap to hop forward; swipe to move." tabindex="0">
            <div id="viewport"></div>
            <div class="scene-grain" aria-hidden="true"></div>
            <div class="game-top" data-ui><span class="location-tag"><span class="live-dot"></span> OSHODI, LAGOS</span><div class="scorebox"><span class="small-label">STEPS CROSSED</span><strong id="score">00</strong><span class="best-mini">BEST <span data-best>0</span></span></div><div class="game-actions"><button id="sound-button" class="icon-button glass" aria-label="Turn sound on" aria-pressed="false">${icons.mute}</button><button id="pause-button" class="icon-button glass" aria-label="Pause game" hidden>${icons.pause}</button></div></div>
            <div class="mobile-title" id="mobile-title"><span class="eyebrow">ONE CITY. NO SLOW LANE.</span><h2>LAGOS <span>CROSSING.</span></h2></div>
            <div class="screen screen-ready" id="ready-screen" data-ui><span class="ready-eyebrow">YOUR NEXT ADVENTURE IS ONE HOP AWAY</span><button class="primary-button" id="start-button">Let’s cross ${icons.arrow}</button><p>Tap to hop · Swipe to change direction</p></div>
            <div class="screen screen-paused" id="paused-screen" data-ui hidden><span class="eyebrow">TAKE YOUR TIME</span><h2>A little breather.</h2><p>The streets can wait.</p><button class="primary-button" id="resume-button">Keep crossing ${icons.arrow}</button></div>
            <div class="screen screen-result" id="result-screen" data-ui hidden><span class="result-sticker">END OF THE ROAD</span><span class="eyebrow" id="result-heading">YOU CROSSED</span><h2><span id="result-score">0</span><small>steps</small></h2><p class="result-quip" id="result-quip">That danfo had other plans.</p><div class="result-record">${icons.trophy}<span>PERSONAL BEST · <b data-best>0</b></span></div><button class="primary-button" id="retry-button">One more crossing ${icons.arrow}</button><button class="secondary-button" id="share-button">${icons.share} Challenge a friend</button><div id="manual-share" hidden><label for="share-text">Copy your challenge below</label><textarea id="share-text" readonly rows="3"></textarea></div></div>
            <div id="warning" class="warning" role="status" hidden>Keep up! Hop forward to stay in view.</div>
            <div id="near-miss" class="near-miss" aria-hidden="true">JUST MADE IT!</div>
            <div class="dpad" id="dpad" aria-label="Movement buttons" data-ui hidden><button data-direction="forward" aria-label="Hop forward">↑</button><button data-direction="left" aria-label="Hop left">←</button><button data-direction="back" aria-label="Hop backward">↓</button><button data-direction="right" aria-label="Hop right">→</button></div>
            <div class="game-bottom"><span class="scene-caption">EVERY GAP IS A NEW POSSIBILITY.</span><span class="seed-label" id="seed-label"></span></div>
            <span id="tutorial" class="tutorial" hidden>↑ / W to hop · ← → to find a gap</span>
            <div class="toast" id="toast" role="status" hidden></div>
          </section>
        </main>
        <footer class="footer"><span>A love letter to the daily commute.</span><span>MADE FOR THE <b>ONE MORE TRY.</b> <span class="footer-arrow">↗</span></span><span class="footer-version">LAGOS CROSSING · VOL. 01</span></footer>
      </div>
      <dialog id="settings-dialog"><div class="dialog-header"><span class="eyebrow">FIND YOUR RHYTHM</span><button id="close-settings" class="icon-button" aria-label="Close settings">${icons.close}</button></div><h2>Small hops.<br>Big city.</h2><p>Cross as many streets as you can. Each new row is one point. Find a gap, then make your move.</p><div class="help-controls"><div><strong>On a keyboard</strong><span>Arrow keys or WASD. P / Esc to pause.</span></div><div><strong>On your phone</strong><span>Tap to hop forward. Swipe left, right, or down to move. One gesture, one hop.</span></div><div><strong>Watch the danfos</strong><span>A waving conductor means a bus has stopped. Watch for the traffic to move again.</span></div></div><label class="toggle-row"><span>On-screen direction buttons<small>Bigger targets. Easier hopping.</small></span><input id="controls-toggle" type="checkbox"></label><label class="toggle-row"><span>Reduced motion<small>Gentler hops and effects.</small></span><input id="motion-toggle" type="checkbox"></label><button class="primary-button" id="done-settings">Got it ${icons.arrow}</button></dialog>`;
    this.surface = this.get('game-surface');
    this.viewport = this.get('viewport');
    this.dialog = this.get('settings-dialog');
    for (const id of ['start-button', 'retry-button']) this.get(id).addEventListener('click', () => callbacks.start());
    this.get('pause-button').addEventListener('click', callbacks.pause);
    this.get('resume-button').addEventListener('click', callbacks.resume);
    this.get('share-button').addEventListener('click', callbacks.share);
    const openSettings = () => { callbacks.settingsOpened(); this.dialog.showModal(); };
    this.get('settings-button').addEventListener('click', openSettings);
    this.get('help-button').addEventListener('click', openSettings);
    for (const id of ['close-settings', 'done-settings']) this.get(id).addEventListener('click', () => this.dialog.close());
    this.get('sound-button').addEventListener('click', () => { preferences.sound = !preferences.sound; callbacks.preferences(preferences); this.setPreferences(preferences); });
    this.get<HTMLInputElement>('controls-toggle').addEventListener('change', event => { preferences.controls = (event.target as HTMLInputElement).checked; callbacks.preferences(preferences); this.setPreferences(preferences); });
    this.get<HTMLInputElement>('motion-toggle').addEventListener('change', event => { preferences.reducedMotion = (event.target as HTMLInputElement).checked; callbacks.preferences(preferences); this.setPreferences(preferences); });
    root.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => button.addEventListener('click', () => callbacks.command(button.dataset.direction as Action)));
    this.setPreferences(preferences);
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector<T>(`#${id}`)!; }
  setPreferences(preferences: Preferences): void {
    this.get('sound-button').innerHTML = preferences.sound ? icons.sound : icons.mute;
    this.get('sound-button').setAttribute('aria-label', preferences.sound ? 'Turn sound off' : 'Turn sound on');
    this.get('sound-button').setAttribute('aria-pressed', String(preferences.sound));
    this.get<HTMLInputElement>('controls-toggle').checked = preferences.controls;
    this.get<HTMLInputElement>('motion-toggle').checked = preferences.reducedMotion;
    this.controlsEnabled = preferences.controls;
    this.get('dpad').hidden = !this.controlsEnabled || this.root.dataset.phase !== 'playing';
    this.root.classList.toggle('reduced-motion', preferences.reducedMotion);
  }
  update(snapshot: GameSnapshot, best: number, previousBest: number): void {
    const phase = snapshot.phase;
    if (phase !== this.lastPhase) {
      this.root.dataset.phase = phase;
      this.get('ready-screen').hidden = phase !== 'ready';
      this.get('paused-screen').hidden = phase !== 'paused';
      this.get('result-screen').hidden = phase !== 'result';
      this.get('mobile-title').hidden = phase !== 'ready';
      this.get('pause-button').hidden = phase !== 'playing';
      this.get('dpad').hidden = !this.controlsEnabled || phase !== 'playing';
      this.get('seed-label').textContent = `ROUTE ${String(snapshot.seed).slice(-6).padStart(6, '0')}`;
      if (phase === 'playing') { this.surface.focus({ preventScroll: true }); this.get('manual-share').hidden = true; }
      if (phase === 'paused') this.get('resume-button').focus({ preventScroll: true });
      if (phase === 'result') {
        this.get('result-score').textContent = String(snapshot.score);
        this.get('result-heading').textContent = snapshot.score > previousBest ? 'A NEW PERSONAL BEST!' : 'YOU CROSSED';
        this.get('result-quip').textContent = snapshot.deathReason === 'Keep up with the city.' ? 'The city kept moving.' : snapshot.deathReason;
        this.get('retry-button').focus({ preventScroll: true });
      }
      this.lastPhase = phase;
    }
    if (snapshot.score !== this.lastScore) {
      this.get('score').textContent = String(snapshot.score).padStart(2, '0');
      this.lastScore = snapshot.score;
    }
    this.root.querySelectorAll<HTMLElement>('[data-best]').forEach(element => { if (element.textContent !== String(best)) element.textContent = String(best); });
    this.get('warning').hidden = !snapshot.warning || phase !== 'playing';
    this.get('tutorial').hidden = phase !== 'playing' || snapshot.score >= 3 || this.controlsEnabled;
  }
  nearMiss(): void { const element = this.get('near-miss'); element.classList.remove('pop'); void element.offsetWidth; element.classList.add('pop'); }
  toast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.get('toast').textContent = message; this.get('toast').hidden = false;
    this.toastTimeout = setTimeout(() => { this.get('toast').hidden = true; }, 3500);
  }
  manualShare(text: string): void {
    this.get('manual-share').hidden = false;
    const input = this.get<HTMLTextAreaElement>('share-text'); input.value = text; input.focus(); input.select();
  }
  showFatal(message: string): void {
    this.viewport.innerHTML = `<div class="fatal"><h2>The street needs a moment.</h2><p></p><button class="primary-button" id="reload-button">Reload game ${icons.arrow}</button></div>`;
    this.viewport.querySelector('p')!.textContent = message;
    this.get('reload-button').addEventListener('click', () => location.reload());
    this.root.classList.add('has-error');
  }
}
