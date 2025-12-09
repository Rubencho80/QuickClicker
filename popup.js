// popup.js (versión con soporte de idioma)
const autoOpenEl = document.getElementById('autoOpen');
const keySection = document.getElementById('keySection');
const keyInput = document.getElementById('keyInput');
const resetBtn = document.getElementById('resetBtn');
const includeAttrsEl = document.getElementById('includeAttrs');
const langSelect = document.getElementById('langSelect');

const DEFAULTS = {
  autoOpen: true,
  openKey: '-',
  includeAttrs: true,
  language: 'es'
};

// Traducciones para la UI del popup
const translations = {
  es: {
    title: 'QuickClicker — Config',
    heading: 'QuickClicker',
    autoOpen: 'Abrir automáticamente',
    openWithKeyLabel: 'Abrir con tecla:',
    includeAttrs: 'Incluir atributos (title, aria-label, placeholder)',
    langLabel: 'Idioma:',
    resetBtn: 'Restablecer a valores por defecto',
    version: 'Versión 1.0'
  },
  en: {
    title: 'QuickClicker — Config',
    heading: 'QuickClicker',
    autoOpen: 'Open automatically',
    openWithKeyLabel: 'Open with key:',
    includeAttrs: 'Include attributes (title, aria-label, placeholder)',
    langLabel: 'Language:',
    resetBtn: 'Reset to defaults',
    version: 'Version 1.0'
  }
};

function tPopup(key) {
  const lang = currentSettings.language || DEFAULTS.language;
  return (translations[lang] && translations[lang][key]) || translations['es'][key] || '';
}

let currentSettings = { ...DEFAULTS };

function saveSettings(settings){
  chrome.storage.local.set(settings, () => {
    // actualizar currentSettings parcialmente
    currentSettings = { ...currentSettings, ...settings };
  });
}

function notifyTabs() {
  chrome.tabs.query({active:true,currentWindow:true}, tabs => {
    if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, {type:'settingsUpdated'});
  });
}

function updatePopupTexts() {
  // actualiza todos los elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // si es elemento <title>, cambiar document.title también
    if(el.tagName.toLowerCase() === 'title') {
      document.title = tPopup(key);
    }
    // si el elemento contiene HTML (ej. hint con <strong>), setear innerHTML en vez de textContent
    if(el.id === 'keyHint') {
      el.innerHTML = tPopup('keyHint');
    } else {
      el.textContent = tPopup(key);
    }
  });
  // version simple:
  const versionEl = document.getElementById('versionText');
  if(versionEl) versionEl.textContent = tPopup('version');
}

function loadSettings(){
  chrome.storage.local.get(DEFAULTS, (items) => {
    currentSettings = {...DEFAULTS, ...items};
    autoOpenEl.checked = !!currentSettings.autoOpen;
    keyInput.value = currentSettings.openKey || DEFAULTS.openKey;
    includeAttrsEl.checked = !!currentSettings.includeAttrs;
    langSelect.value = currentSettings.language || DEFAULTS.language;
    keySection.classList.toggle('hidden', autoOpenEl.checked);
    updatePopupTexts();
  });
}

autoOpenEl.addEventListener('change', () => {
  const val = autoOpenEl.checked;
  keySection.classList.toggle('hidden', val);
  saveSettings({autoOpen: val});
  notifyTabs();
});

// captura de la tecla
keyInput.addEventListener('focus', () => {
  keyInput.value = '';
  const onKey = (e) => {
    e.preventDefault();
    let k = e.key;
    if(k === ' ') k = 'Space';
    keyInput.value = k;
    saveSettings({openKey: k});
    keyInput.blur();
    document.removeEventListener('keydown', onKey, true);
    notifyTabs();
  };
  document.addEventListener('keydown', onKey, true);
});

keyInput.addEventListener('blur', () => {
  chrome.storage.local.get(DEFAULTS, (items) => {
    keyInput.value = items.openKey || DEFAULTS.openKey;
  });
});

// includeAttrs listener
includeAttrsEl.addEventListener('change', () => {
  const val = includeAttrsEl.checked;
  saveSettings({ includeAttrs: val });
  notifyTabs();
});

// language listener
langSelect.addEventListener('change', () => {
  const val = langSelect.value;
  saveSettings({ language: val });
  updatePopupTexts();
  notifyTabs();
});

resetBtn.addEventListener('click', () => {
  saveSettings(DEFAULTS);
  // actualizar UI inmediatamente
  currentSettings = { ...DEFAULTS };
  loadSettings();
  notifyTabs();
});

loadSettings();
