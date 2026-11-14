export function canStartModuleDrag(module, root, event) {
  return event.button === 0
    && !event.target.closest('button,a,input')
    && !module.classList.contains('is-focused')
    && !root.classList.contains('module-focus-active');
}

export function createModuleFocusController({ modules, root, documentRef = document }) {
  let activeModule = null;
  const buttons = new Map();

  const syncButton = (module, active) => {
    const button = buttons.get(module);
    if (!button) return;
    button.textContent = active ? '×' : '⛶';
    button.title = active ? '退出放大（Esc）' : '放大模块';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(active));
  };

  const close = () => {
    if (!activeModule) return;
    activeModule.classList.remove('is-focused');
    syncButton(activeModule, false);
    activeModule = null;
    root.classList.remove('module-focus-active');
  };

  const open = (module) => {
    if (!module || module === activeModule) return;
    close();
    activeModule = module;
    activeModule.classList.add('is-focused');
    root.classList.add('module-focus-active');
    syncButton(activeModule, true);
  };

  const toggle = (module) => {
    if (module === activeModule) close();
    else open(module);
  };

  modules.forEach((module) => {
    const title = module.querySelector(':scope > .module-title');
    if (!title) return;
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'module-focus-btn';
    buttons.set(module, button);
    syncButton(module, false);
    button.addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation(); toggle(module);
    });
    title.append(button);
  });

  const onKeydown = (event) => { if (event.key === 'Escape') close(); };
  documentRef.addEventListener('keydown', onKeydown);

  return {
    open,
    close,
    toggle,
    get activeModule() { return activeModule; },
    destroy() { close(); documentRef.removeEventListener('keydown', onKeydown); },
  };
}

export function createPanelFocusController({ panels, root, documentRef = document }) {
  let activePanel = null;

  const syncButton = (panel, active) => {
    const button = panel?.querySelector('[data-focus-toggle]');
    if (!button) return;
    button.textContent = active ? '×' : '⛶';
    button.title = active ? '退出演示（Esc）' : '放大演示';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(active));
  };

  const close = () => {
    if (!activePanel) return;
    activePanel.classList.remove('is-panel-focused');
    syncButton(activePanel, false);
    activePanel = null;
    root.classList.remove('panel-focus-active');
  };

  const open = (panel) => {
    if (!panel || panel === activePanel) return;
    close();
    activePanel = panel;
    activePanel.classList.add('is-panel-focused');
    root.classList.add('panel-focus-active');
    syncButton(activePanel, true);
  };

  const toggle = (panel) => panel === activePanel ? close() : open(panel);

  panels.forEach((panel) => {
    const button = panel.querySelector('[data-focus-toggle]');
    if (!button) return;
    syncButton(panel, false);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle(panel);
    });
  });

  const onKeydown = (event) => { if (event.key === 'Escape') close(); };
  documentRef.addEventListener('keydown', onKeydown);

  return {
    open,
    close,
    toggle,
    get activePanel() { return activePanel; },
    destroy() { close(); documentRef.removeEventListener('keydown', onKeydown); },
  };
}
