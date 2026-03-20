(() => {
  'use strict';

  // ── State ──

  let state = {
    tabs: [],
    activeTabId: null,
    settings: { theme: 'system', githubPat: '' }
  };

  let saveTimeout = null;

  // ── DOM ──

  const $ = (s) => document.querySelector(s);
  const editor = $('#editor');
  const tabsContainer = $('#tabs-container');
  const statsEl = $('#stats');

  // ── Init ──

  async function init() {
    await loadState();
    if (state.tabs.length === 0) createTab();
    render();
    applyTheme();
    setupListeners();
  }

  // ── Persistence ──

  async function loadState() {
    try {
      const data = await chrome.storage.local.get(['scratchpad_state']);
      if (data.scratchpad_state) {
        state = { ...state, ...data.scratchpad_state };
      }
    } catch {
      // First run or storage unavailable
    }
  }

  function saveState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        chrome.storage.local.set({ scratchpad_state: state });
      } catch { /* ignore */ }
    }, 300);
  }

  function saveStateImmediate() {
    clearTimeout(saveTimeout);
    try {
      chrome.storage.local.set({ scratchpad_state: state });
    } catch { /* ignore */ }
  }

  // ── Tab Operations ──

  function createTab() {
    const tab = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      created: Date.now(),
      updated: Date.now()
    };
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    saveState();
    return tab;
  }

  function getActiveTab() {
    return state.tabs.find(t => t.id === state.activeTabId) || state.tabs[0];
  }

  function switchTab(id) {
    // Save current editor content first
    const current = getActiveTab();
    if (current) {
      current.content = editor.value;
      current.updated = Date.now();
    }
    state.activeTabId = id;
    render();
    saveState();
    editor.focus();
  }

  function closeTab(id) {
    if (state.tabs.length === 1) {
      // Don't close last tab — clear it instead
      const tab = state.tabs[0];
      tab.content = '';
      tab.title = '';
      tab.updated = Date.now();
      render();
      saveState();
      return;
    }

    const idx = state.tabs.findIndex(t => t.id === id);
    state.tabs.splice(idx, 1);

    if (state.activeTabId === id) {
      state.activeTabId = state.tabs[Math.min(idx, state.tabs.length - 1)].id;
    }
    render();
    saveState();
  }

  function deriveTitle(content) {
    const firstLine = content.split('\n')[0].trim();
    if (!firstLine) return 'Untitled';
    return firstLine.length > 24 ? firstLine.slice(0, 24) + '…' : firstLine;
  }

  // ── Rendering ──

  function render() {
    renderTabs();
    const tab = getActiveTab();
    if (tab) {
      editor.value = tab.content;
    }
    updateStats();
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';
    for (const tab of state.tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === state.activeTabId ? ' active' : '');
      el.dataset.id = tab.id;

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || deriveTitle(tab.content);
      el.appendChild(title);

      const close = document.createElement('button');
      close.className = 'tab-close';
      close.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/></svg>';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      el.appendChild(close);

      el.addEventListener('click', () => switchTab(tab.id));
      el.addEventListener('dblclick', () => startRenameTab(tab.id, el));

      tabsContainer.appendChild(el);
    }
  }

  function startRenameTab(id, tabEl) {
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return;

    const titleEl = tabEl.querySelector('.tab-title');
    const input = document.createElement('input');
    input.className = 'tab-title-input';
    input.value = tab.title || deriveTitle(tab.content);
    input.addEventListener('blur', () => finishRename(tab, input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = tab.title || deriveTitle(tab.content); input.blur(); }
    });

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  function finishRename(tab, input) {
    tab.title = input.value.trim();
    tab.updated = Date.now();
    saveState();
    renderTabs();
  }

  function updateStats() {
    const text = editor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    statsEl.textContent = `${chars} char${chars !== 1 ? 's' : ''} · ${words} word${words !== 1 ? 's' : ''}`;
  }

  // ── Theme ──

  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = state.settings.theme;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    $('#theme-icon-light').style.display = isDark ? 'none' : 'block';
    $('#theme-icon-dark').style.display = isDark ? 'block' : 'none';
  }

  function toggleTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = state.settings.theme;

    if (current === 'system') {
      state.settings.theme = prefersDark ? 'light' : 'dark';
    } else if (current === 'dark') {
      state.settings.theme = 'light';
    } else {
      state.settings.theme = 'dark';
    }

    applyTheme();
    saveState();
  }

  // ── Gist Sharing ──

  async function shareAsGist() {
    const pat = state.settings.githubPat;
    if (!pat) {
      showModal('settings-modal');
      toast('Set up your GitHub token first');
      return;
    }

    const tab = getActiveTab();
    if (!tab || !tab.content.trim()) {
      toast('Nothing to share');
      return;
    }

    const shareBtn = $('#share-btn');
    shareBtn.disabled = true;
    shareBtn.textContent = 'Sharing…';

    try {
      const filename = (tab.title || deriveTitle(tab.content)).replace(/[^a-zA-Z0-9._-]/g, '_') + '.md';
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${pat}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          description: tab.title || deriveTitle(tab.content),
          public: false,
          files: { [filename]: { content: tab.content } }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const gistUrl = data.html_url;
      const rawUrl = Object.values(data.files)[0].raw_url;

      $('#gist-url').value = gistUrl;
      $('#raw-url').value = rawUrl;
      showModal('share-modal');

      // Auto-copy raw URL (most useful for LLMs)
      await copyToClipboard(rawUrl);
      toast('Raw URL copied to clipboard');

    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      shareBtn.disabled = false;
      shareBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share';
    }
  }

  // ── Modals ──

  function showModal(id) {
    $('#' + id).classList.remove('hidden');
  }

  function hideModal(id) {
    $('#' + id).classList.add('hidden');
  }

  // ── Toast ──

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden', 'fade-out');

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.classList.add('hidden'), 200);
    }, 2000);
  }

  // ── Clipboard ──

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  // ── Event Listeners ──

  function setupListeners() {
    // Editor input
    editor.addEventListener('input', () => {
      const tab = getActiveTab();
      if (tab) {
        tab.content = editor.value;
        tab.updated = Date.now();
        // Update tab title in real-time if no custom title
        if (!tab.title) renderTabs();
        updateStats();
        saveState();
      }
    });

    // Tab key inserts spaces
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        editor.dispatchEvent(new Event('input'));
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'n') {
        e.preventDefault();
        createTab();
        render();
        editor.focus();
      }
      if (mod && e.key === 'w') {
        e.preventDefault();
        closeTab(state.activeTabId);
      }
      if (mod && e.key === 's') {
        e.preventDefault();
        shareAsGist();
      }
    });

    // Share button
    $('#share-btn').addEventListener('click', shareAsGist);

    // New tab button
    $('#new-tab-btn').addEventListener('click', () => {
      createTab();
      render();
      editor.focus();
    });

    // Theme toggle
    $('#theme-btn').addEventListener('click', toggleTheme);

    // System theme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.theme === 'system') applyTheme();
    });

    // Settings
    $('#settings-btn').addEventListener('click', () => {
      $('#github-pat').value = state.settings.githubPat || '';
      showModal('settings-modal');
    });

    $('#settings-close').addEventListener('click', () => hideModal('settings-modal'));

    $('#save-settings').addEventListener('click', () => {
      state.settings.githubPat = $('#github-pat').value.trim();
      saveStateImmediate();
      hideModal('settings-modal');
      toast('Settings saved');
    });

    // Share modal
    $('#share-close').addEventListener('click', () => hideModal('share-modal'));

    $('#copy-gist-url').addEventListener('click', async () => {
      await copyToClipboard($('#gist-url').value);
      toast('Gist URL copied');
    });

    $('#copy-raw-url').addEventListener('click', async () => {
      await copyToClipboard($('#raw-url').value);
      toast('Raw URL copied');
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    // Save on unload
    window.addEventListener('beforeunload', () => {
      const tab = getActiveTab();
      if (tab) {
        tab.content = editor.value;
        tab.updated = Date.now();
      }
      saveStateImmediate();
    });
  }

  // ── Go ──

  init();
})();
