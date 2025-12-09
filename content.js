// content.js — versión final con Shadow DOM, highlights inline, includeAttrs y selección de idioma
(() => {
  const DEFAULTS = { autoOpen: true, openKey: '-', includeAttrs: false, language: 'es' };
  let settings = { ...DEFAULTS };
  let host = null;
  let shadow = null;
  let widget = null;
  let inputEl = null;
  let matches = [];
  let selectedIndex = 0;
  let searchTimer = null;
  let mutationObserver = null;
  let ignoreMutations = false;
  let lastQuery = '';

  let userIsInteracting = false;
  let userInteractTimer = null;
  let manualNavigationActive = false;
  let manualNavigationTimer = null;

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Translations
  const translations = {
    es: {
      placeholder: 'Escribe para buscar elementos clicables...',
      hint: 'Pulsa Enter para activar. Tab/↓ para siguiente.',
      typing: 'Escribe para buscar...',
      noResults: 'No se han encontrado coincidencias.',
      nResults: (n, idx) => `${n} coincidencia(s). Seleccionado: ${idx}`,
      activated: 'Elemento activado.',
      nothing: 'No hay nada para activar.',
      close: 'Cerrar'
    },
    en: {
      placeholder: 'Type to find clickable elements...',
      hint: 'Press Enter to activate. Tab/↓ for next.',
      typing: 'Type to search...',
      noResults: 'No results found.',
      nResults: (n, idx) => `${n} match(es). Selected: ${idx}`,
      activated: 'Element activated.',
      nothing: 'Nothing to activate.',
      close: 'Close'
    }
  };

  function t(key, ...args){
    const lang = (settings && settings.language) ? settings.language : DEFAULTS.language;
    const val = translations[lang] && translations[lang][key];
    if(typeof val === 'function') return val(...args);
    return val || translations['es'][key] || '';
  }

  /* ----------------- Inline highlight helpers ----------------- */
  function _storePrevStyle(el, prop, dataKey) {
    try {
      if (el.dataset && el.dataset[dataKey] === undefined) {
        el.dataset[dataKey] = el.style[prop] || '';
      }
    } catch (e) {}
  }
  function _restorePrevStyle(el, prop, dataKey) {
    try {
      if (el.dataset && dataKey in el.dataset) {
        el.style[prop] = el.dataset[dataKey] || '';
        delete el.dataset[dataKey];
      } else {
        el.style[prop] = '';
      }
    } catch (e) {}
  }

  function setHighlightInline(el) {
    if(!el) return;
    _storePrevStyle(el, 'outline', 'qcPrevOutline');
    _storePrevStyle(el, 'boxShadow', 'qcPrevBoxShadow');
    el.style.outline = '3px solid rgba(20,120,220,0.35)';
    if(!el.dataset.qcPrevBoxShadow) el.style.boxShadow = '';
  }

  function clearHighlightInline(el) {
    if(!el) return;
    _restorePrevStyle(el, 'outline', 'qcPrevOutline');
    _restorePrevStyle(el, 'boxShadow', 'qcPrevBoxShadow');
  }

  function setSelectedInline(el) {
    if(!el) return;
    _storePrevStyle(el, 'outline', 'qcPrevOutline');
    _storePrevStyle(el, 'boxShadow', 'qcPrevBoxShadow');
    el.style.outline = '5px solid rgba(0,102,204,0.9)';
    el.style.boxShadow = '0 0 8px rgba(0,102,204,0.45)';
  }

  function clearSelectedInline(el) {
    if(!el) return;
    if(matches.includes(el)) {
      el.style.outline = '3px solid rgba(20,120,220,0.35)';
      if(el.dataset && el.dataset.qcPrevBoxShadow) {
        // keep stored prev
      } else {
        el.style.boxShadow = '';
      }
    } else {
      _restorePrevStyle(el, 'outline', 'qcPrevOutline');
      _restorePrevStyle(el, 'boxShadow', 'qcPrevBoxShadow');
    }
  }

  /* ----------------- DOM utilities & search ----------------- */
  function isElementVisible(el){
    try{
      const cs = window.getComputedStyle(el);
      if(!el || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      if(r.width <= 0 || r.height <= 0) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      if(!txt && !settings.includeAttrs) return false; // if not including attrs, require visible text
      return true;
    }catch(e){
      return false;
    }
  }

  function isClickable(el){
    if(!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    if(tag === 'a' && el.href) return true;
    if(['button','input'].includes(tag) && (tag !== 'input' || (el.type && (el.type === 'button' || el.type === 'submit' || el.type === 'checkbox' || el.type === 'radio')) )) return true;
    if(el.getAttribute('role') === 'button') return true;
    if(typeof el.onclick === 'function') return true;
    if(el.hasAttribute('onclick')) return true;
    try{
      const cs = window.getComputedStyle(el);
      if(cs && cs.cursor && cs.cursor.includes('pointer')) return true;
    }catch(e){}
    return false;
  }

  function gatherClickableElements(){
    const all = Array.from(document.querySelectorAll('a, button, input, [role="button"], *'));
    const unique = [];
    for(const el of all){
      if(isClickable(el) && !unique.includes(el)){
        const rect = el.getBoundingClientRect();
        if(rect.width < 3 || rect.height < 3) continue;
        unique.push(el);
      }
    }
    return unique;
  }

  function textOfElementVisible(el){
    if(!el) return '';
    try{
      return (el.innerText || el.textContent || '').trim();
    }catch(e){
      return '';
    }
  }

  function searchMatches(query){
    if(!query) return [];
    const q = query.trim().toLowerCase();
    if(!q) return [];
    const candidates = gatherClickableElements();
    const res = [];
    for(const el of candidates){
      if(!isElementVisible(el)) {
        if(!settings.includeAttrs) continue;
      }
      const text = textOfElementVisible(el).toLowerCase();
      if(text && text.includes(q)) {
        res.push({el, text});
        continue;
      }
      if(settings.includeAttrs){
        const attrs = ['title','aria-label','placeholder'];
        for(const a of attrs){
          try{
            const v = (el.getAttribute && el.getAttribute(a)) || '';
            if(v && v.toLowerCase().includes(q)){
              res.push({el, text: v});
              break;
            }
          }catch(e){}
        }
      }
    }
    return res;
  }

  // keep only innermost elements (avoid marking ancestor + descendant)
  function keepInnermost(elementArray){
    const unique = Array.from(new Set(elementArray));
    return unique.filter(el => !unique.some(other => other !== el && el.contains(other)));
  }

  /* ----------------- apply highlights inline (diff) ----------------- */
  function applyHighlightsInline(newEls){
    const toAdd = newEls.filter(e => !matches.includes(e));
    const toRemove = matches.filter(e => !newEls.includes(e));

    if(toAdd.length === 0 && toRemove.length === 0) return;

    ignoreMutations = true;

    for(const el of toRemove){
      try{ clearHighlightInline(el); }catch(e){}
    }
    for(const el of toAdd){
      try{ setHighlightInline(el); }catch(e){}
    }

    matches = newEls.slice();
    setTimeout(()=> { ignoreMutations = false; }, 160);
  }

  /* ----------------- Shadow DOM widget ----------------- */
  function createWidgetShadow(){
    if(host) return;

    host = document.createElement('div');
    host.id = '__qc_host';
    host.style.position = 'fixed';
    host.style.left = (window.innerWidth/2 - 180) + 'px';
    host.style.top = (window.innerHeight - 120) + 'px';
    host.style.zIndex = 2147483647;
    host.style.pointerEvents = 'auto';
    host.style.transform = 'none';

    shadow = host.attachShadow({mode:'open'});

    const innerStyles = `
      :host { all: initial; display:block; }
      .__qc_floating{ position:relative; min-width: 280px; max-width: 80vw; background: rgba(240,240,240,0.70); color: #111; border-radius: 10px; box-shadow: 0 6px 22px rgba(0,0,0,0.25); padding: 8px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial; backdrop-filter: blur(4px); user-select: auto; }
      .__qc_handle{ width:48px;height:6px;margin:4px auto 8px auto;border-radius:4px;background:rgba(0,0,0,0.12);cursor:grab; }
      .__qc_floating.dragging{ cursor:grabbing; user-select:none; }
      .__qc_input{ width:100%; padding:8px 10px; border-radius:8px; border:1px solid rgba(0,0,0,0.12); font-size:14px; background: rgba(255,255,255,0.9); color: #111; box-sizing: border-box; }
      .__qc_status{ margin-top:6px;font-size:12px;color:#333; text-align:center; }
      .__qc_hint{ font-size:11px;color:#333;opacity:0.9;margin-top:6px;text-align:center; }
      .__qc_close {
        position: absolute;
        top: 2px;
        right: 4px;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: rgba(0,0,0,0);
        color: rgba(90, 90, 90, 0.95);
        font-size: 12px;
        line-height: 24px;
        text-align: center;
        cursor: pointer;
      }
      .__qc_close:hover { background: rgba(0,0,0,0.08); }
      .__qc_close:active { transform: translateY(1px); }
    `;

    shadow.innerHTML = `<style>${innerStyles}</style>
      <div class="__qc_floating" part="floating">
        <button class="__qc_close" part="close" aria-label="${t('close')}" title="${t('close')}">✕</button>
        <div class="__qc_handle" part="handle" title="Arrastrar"></div>
        <input class="__qc_input" part="input" placeholder="${t('placeholder')}" />
        <div class="__qc_status __qc_hint">${t('hint')}</div>
      </div>`;

    document.documentElement.appendChild(host);

    widget = shadow.querySelector('.__qc_floating');
    inputEl = shadow.querySelector('.__qc_input');

    // botón cerrar
    const closeBtn = shadow.querySelector('.__qc_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        removeWidgetShadow();
      });
    }

    inputEl.addEventListener('keydown', onWidgetKeyDown);
    inputEl.addEventListener('input', onInputChange);
    setTimeout(()=> inputEl.focus(), 0);

    const handle = shadow.querySelector('.__qc_handle');
    handle.addEventListener('mousedown', startDragMouse);
    handle.addEventListener('touchstart', startDragTouch, {passive:false});

    mutationObserver = new MutationObserver((mutations) => {
      if(ignoreMutations) return;
      scheduleSearch();
    });
    mutationObserver.observe(document.body || document.documentElement, { childList:true, subtree:true, attributes:true });
  }

  function removeWidgetShadow(){
    if(!host) return;
    if(mutationObserver) mutationObserver.disconnect();
    ignoreMutations = true;
    for(const el of matches){
      try{ clearHighlightInline(el); }catch(e){}
    }
    matches = [];
    selectedIndex = 0;
    setTimeout(()=> { ignoreMutations = false; }, 160);

    document.removeEventListener('mousemove', onDragMouse);
    document.removeEventListener('mouseup', endDragMouse);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);

    host.remove();
    host = null;
    shadow = null;
    widget = null;
    inputEl = null;
  }

  /* ----------------- Search scheduling & logic ----------------- */
  function scheduleSearch(){
    if(manualNavigationActive){
      if(searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { doSearch(inputEl ? inputEl.value : ''); }, 300);
      return;
    }
    if(searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      doSearch(inputEl ? inputEl.value : '');
    }, 120);
  }

  function doSearch(query){
    const q = (query || '').trim();
    if(q === ''){
      applyHighlightsInline([]);
      lastQuery = '';
      updateStatus(t('typing'));
      return;
    }

    const results = searchMatches(q);
    let newEls = results.map(r => r.el);
    newEls = keepInnermost(newEls);

    const prevSelectedEl = (matches && matches[selectedIndex]) ? matches[selectedIndex] : null;
    applyHighlightsInline(newEls);

    if(newEls.length === 0){
      selectedIndex = 0;
      updateStatus(t('noResults'));
      return;
    }

    if(manualNavigationActive){
      if(selectedIndex >= newEls.length) selectedIndex = newEls.length - 1;
    } else {
      if(prevSelectedEl && newEls.includes(prevSelectedEl)){
        selectedIndex = newEls.indexOf(prevSelectedEl);
      } else {
        selectedIndex = 0;
      }
    }

    updateSelected(false);
    updateStatus(t('nResults', newEls.length, selectedIndex+1));
    lastQuery = q;
  }

  function updateStatus(text){
    if(!widget) return;
    const s = shadow.querySelector('.__qc_status');
    if(s) s.textContent = text;
  }

  function updateSelected(wantScroll = true){
    for(let i=0;i<matches.length;i++){
      try{ clearSelectedInline(matches[i]); }catch(e){}
    }
    if(matches.length === 0) return;
    try{
      setSelectedInline(matches[selectedIndex]);
      const shouldScroll = wantScroll && !userIsInteracting && manualNavigationActive;
      if(shouldScroll){
        const el = matches[selectedIndex];
        if(el && typeof el.scrollIntoView === 'function'){
          el.scrollIntoView({behavior:'smooth', block:'center', inline:'nearest'});
        }
      }
    }catch(e){}
  }

  /* ----------------- Keyboard handling inside widget ----------------- */
  function onWidgetKeyDown(e){
    function startManualNavigation(){
      manualNavigationActive = true;
      if(manualNavigationTimer) clearTimeout(manualNavigationTimer);
      manualNavigationTimer = setTimeout(()=> { manualNavigationActive = false; }, 900);
    }

    if(e.key === 'Tab' || e.key === 'ArrowDown'){
      e.preventDefault();
      startManualNavigation();
      if(matches.length === 0){
        scheduleSearch();
        return;
      }
      if(searchTimer) clearTimeout(searchTimer);
      selectedIndex = (selectedIndex + 1) % matches.length;
      updateSelected(true);
      updateStatus(t('nResults', matches.length, selectedIndex+1));
      return;
    }

    if(e.key === 'ArrowUp'){
      e.preventDefault();
      startManualNavigation();
      if(matches.length === 0) return;
      if(searchTimer) clearTimeout(searchTimer);
      selectedIndex = (selectedIndex - 1 + matches.length) % matches.length;
      updateSelected(true);
      updateStatus(t('nResults', matches.length, selectedIndex+1));
      return;
    }

    if(e.key === 'Enter'){
      e.preventDefault();
      if(matches.length > 0){
        clickElement(matches[selectedIndex]);
      }else{
        const fresh = searchMatches(inputEl.value);
        if(fresh.length>0){
          clickElement(fresh[0].el);
        } else {
          updateStatus(t('nothing'));
        }
      }
      return;
    }

    scheduleSearch();
  }

  function onInputChange(){
    scheduleSearch();
  }

  function clickElement(el){
    if(!el) return;
    try{ el.focus && el.focus({preventScroll:false}); }catch(e){}
    try{
      const ev = new MouseEvent('click', { bubbles:true, cancelable:true, view:window });
      el.dispatchEvent(ev);
      updateStatus(t('activated'));
    }catch(e){
      try{ el.click(); updateStatus(t('activated')); }catch(err){ updateStatus(t('nothing')); }
    }
  }

  /* ----------------- Drag handlers (mouse + touch) ----------------- */
  function startDragMouse(ev){
    ev.preventDefault();
    if(!host) return;
    const rect = host.getBoundingClientRect();
    host.style.left = rect.left + 'px';
    host.style.top = rect.top + 'px';
    host.style.bottom = 'auto';
    isDragging = true;
    dragOffsetX = ev.clientX - rect.left;
    dragOffsetY = ev.clientY - rect.top;
    widget.classList.add('dragging');
    document.addEventListener('mousemove', onDragMouse);
    document.addEventListener('mouseup', endDragMouse);
  }
  function onDragMouse(ev){
    if(!isDragging || !host) return;
    ev.preventDefault();
    const wRect = host.getBoundingClientRect();
    const w = wRect.width;
    const h = wRect.height;
    const margin = 8;
    let nx = ev.clientX - dragOffsetX;
    let ny = ev.clientY - dragOffsetY;
    nx = Math.max(margin, Math.min(nx, window.innerWidth - w - margin));
    ny = Math.max(margin, Math.min(ny, window.innerHeight - h - margin));
    host.style.left = nx + 'px';
    host.style.top = ny + 'px';
  }
  function endDragMouse(){
    if(!isDragging || !host) return;
    isDragging = false;
    widget.classList.remove('dragging');
    document.removeEventListener('mousemove', onDragMouse);
    document.removeEventListener('mouseup', endDragMouse);
  }

  function startDragTouch(ev){
    ev.preventDefault();
    if(!host) return;
    const touch = ev.touches[0];
    const rect = host.getBoundingClientRect();
    host.style.left = rect.left + 'px';
    host.style.top = rect.top + 'px';
    host.style.bottom = 'auto';
    isDragging = true;
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;
    widget.classList.add('dragging');
    document.addEventListener('touchmove', onDragTouch, {passive:false});
    document.addEventListener('touchend', endDragTouch);
  }
  function onDragTouch(ev){
    if(!isDragging || !host) return;
    ev.preventDefault();
    const touch = ev.touches[0];
    const wRect = host.getBoundingClientRect();
    const w = wRect.width;
    const h = wRect.height;
    const margin = 8;
    let nx = touch.clientX - dragOffsetX;
    let ny = touch.clientY - dragOffsetY;
    nx = Math.max(margin, Math.min(nx, window.innerWidth - w - margin));
    ny = Math.max(margin, Math.min(ny, window.innerHeight - h - margin));
    host.style.left = nx + 'px';
    host.style.top = ny + 'px';
  }
  function endDragTouch(){
    if(!isDragging || !host) return;
    isDragging = false;
    widget.classList.remove('dragging');
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
  }

  /* ----------------- Page key toggle (works even if autoOpen=true) ----------------- */
  function onPageKeydown(e){
    const k = e.key === ' ' ? 'Space' : e.key;
    if(k === settings.openKey){
      if(host) removeWidgetShadow();
      else createWidgetShadow();
      e.preventDefault();
    }
  }

  /* ----------------- user interaction detection ----------------- */
  function markUserInteracting(){
    userIsInteracting = true;
    if(userInteractTimer) clearTimeout(userInteractTimer);
    userInteractTimer = setTimeout(()=> { userIsInteracting = false; }, 600);
  }
  window.addEventListener('wheel', markUserInteracting, {passive:true});
  window.addEventListener('touchstart', markUserInteracting, {passive:true});
  window.addEventListener('touchmove', markUserInteracting, {passive:true});
  window.addEventListener('mousedown', (ev) => {
    if(!host) return;
    if(!host.contains(ev.target)) markUserInteracting();
  }, {passive:true});

  /* ----------------- settings listener + init ----------------- */
  chrome.runtime.onMessage.addListener((msg) => {
    if(msg && msg.type === 'settingsUpdated'){
      chrome.storage.local.get(DEFAULTS, (items) => {
        settings = {...DEFAULTS, ...items};
        if(settings.autoOpen) {
          if(!host) createWidgetShadow();
        } else {
          if(host) removeWidgetShadow();
        }
        // update texts if widget present
        if(host && inputEl && shadow){
          try{
            inputEl.placeholder = t('placeholder');
            const statusEl = shadow.querySelector('.__qc_status');
            if(statusEl) statusEl.textContent = t('hint');
          }catch(e){}
        }
      });
    }
  });

  chrome.storage.local.get(DEFAULTS, (items) => {
    settings = {...DEFAULTS, ...items};
    if(settings.autoOpen) createWidgetShadow();
    window.addEventListener('keydown', onPageKeydown, true);
  });

  window.addEventListener('beforeunload', () => {
    if(mutationObserver) mutationObserver.disconnect();
  });

})();
