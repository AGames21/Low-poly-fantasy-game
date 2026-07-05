// Launch screen (PC / Mobile), HUD, and the Armory customization panel.
import { HELMETS, ARMOR_MATERIALS, TINTS, WEAPONS, DEFAULT_CONFIG } from './knight.js';

const CONFIG_KEY = 'knightfall.config';
const PLATFORM_KEY = 'knightfall.platform';

// storage can be unavailable in sandboxed/embedded contexts — never crash
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* not persisted */ }
}

export function loadConfig() {
  try {
    const raw = storageGet(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* corrupted storage — fall through to defaults */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  storageSet(CONFIG_KEY, JSON.stringify(config));
}

export function createUI({ onStart, onConfigChange, onPlatformChange }) {
  const launch = document.getElementById('launch');
  const hud = document.getElementById('hud');
  const touchUI = document.getElementById('touch-ui');
  const customize = document.getElementById('customize');
  const customizeBtn = document.getElementById('customize-btn');
  const hint = document.getElementById('controls-hint');

  let config = loadConfig();
  let platform = storageGet(PLATFORM_KEY) || (isTouchDevice() ? 'mobile' : 'pc');

  // ---------- launch screen ----------
  const pcBtn = document.getElementById('choose-pc');
  const mobileBtn = document.getElementById('choose-mobile');
  (platform === 'mobile' ? mobileBtn : pcBtn).classList.add('selected');

  function start(chosen) {
    platform = chosen;
    storageSet(PLATFORM_KEY, chosen);
    launch.style.display = 'none';
    hud.style.display = 'block';
    applyPlatform();
    onStart(chosen);
  }
  pcBtn.addEventListener('click', () => start('pc'));
  mobileBtn.addEventListener('click', () => start('mobile'));

  function applyPlatform() {
    touchUI.style.display = platform === 'mobile' ? 'block' : 'none';
    hint.textContent = platform === 'mobile'
      ? 'joystick to move · touch-drag to look · tap Customize up top'
      : 'WASD move · SPACE jump · drag mouse to look · scroll to zoom · C to customize';
    onPlatformChange(platform);
  }

  // ---------- customize panel ----------
  const groups = {
    helmet: HELMETS,
    material: ARMOR_MATERIALS,
    weapon: WEAPONS,
  };

  for (const [groupName, options] of Object.entries(groups)) {
    const row = customize.querySelector(`.options[data-group="${groupName}"]`);
    for (const [key, label] of Object.entries(options)) {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.dataset.value = key;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        config = { ...config, [groupName]: key };
        saveConfig(config);
        markSelected(row, key);
        onConfigChange(config);
      });
      row.appendChild(btn);
    }
    markSelected(row, config[groupName]);
  }

  // tint swatches
  const tintRow = customize.querySelector('.options[data-group="tint"]');
  for (const tint of TINTS) {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.dataset.value = tint;
    btn.style.background = tint;
    btn.addEventListener('click', () => {
      config = { ...config, tint };
      saveConfig(config);
      markSelected(tintRow, tint);
      onConfigChange(config);
    });
    tintRow.appendChild(btn);
  }
  markSelected(tintRow, config.tint);

  // platform switcher inside the panel
  const platformRow = customize.querySelector('.options[data-group="platform"]');
  for (const [key, label] of Object.entries({ pc: 'PC', mobile: 'Mobile' })) {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.dataset.value = key;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      platform = key;
      storageSet(PLATFORM_KEY, key);
      markSelected(platformRow, key);
      applyPlatform();
    });
    platformRow.appendChild(btn);
  }
  markSelected(platformRow, platform);

  function markSelected(row, value) {
    for (const child of row.children) {
      child.classList.toggle('selected', child.dataset.value === value);
    }
  }

  let panelOpen = false;
  function togglePanel(force) {
    panelOpen = force !== undefined ? force : !panelOpen;
    customize.style.display = panelOpen ? 'block' : 'none';
  }
  customizeBtn.addEventListener('click', () => togglePanel());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') togglePanel();
    if (e.code === 'Escape') togglePanel(false);
  });

  return {
    getConfig: () => ({ ...config }),
    getPlatform: () => platform,
  };
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
