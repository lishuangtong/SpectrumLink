import assert from 'node:assert/strict';
import test from 'node:test';

import { canStartModuleDrag, createModuleFocusController, createPanelFocusController } from '../../web/src/module-focus.js';

class Classes {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function fixture() {
  const keyListeners = [];
  const documentRef = {
    createElement() {
      return {
        className: '', textContent: '', title: '', type: '', attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, fn) { this[name] = fn; },
        click() { this.click?.({ preventDefault() {}, stopPropagation() {} }); },
      };
    },
    addEventListener(name, fn) { if (name === 'keydown') keyListeners.push(fn); },
    removeEventListener() {},
  };
  const makeModule = (name) => {
    const title = { children: [], append(button) { this.children.push(button); } };
    return { dataset: { module: name }, classList: new Classes(), querySelector: () => title, title, style: { left: '123px', top: '45px', zIndex: '9' } };
  };
  return { documentRef, keyListeners, root: { classList: new Classes() }, modules: [makeModule('radar'), makeModule('terrain')] };
}

test('focus controller adds one control to every module and toggles the active module', () => {
  const setup = fixture();
  const controller = createModuleFocusController(setup);
  assert.equal(setup.modules[0].title.children.length, 1);
  assert.equal(setup.modules[1].title.children.length, 1);
  controller.open(setup.modules[0]);
  assert.equal(setup.modules[0].classList.contains('is-focused'), true);
  assert.equal(setup.root.classList.contains('module-focus-active'), true);
  controller.toggle(setup.modules[1]);
  assert.equal(setup.modules[0].classList.contains('is-focused'), false);
  assert.equal(setup.modules[1].classList.contains('is-focused'), true);
});

test('focus controller closes on Escape and restores the module state', () => {
  const setup = fixture();
  const controller = createModuleFocusController(setup);
  controller.open(setup.modules[0]);
  setup.keyListeners[0]({ key: 'Escape' });
  assert.equal(controller.activeModule, null);
  assert.equal(setup.modules[0].classList.contains('is-focused'), false);
  assert.equal(setup.root.classList.contains('module-focus-active'), false);
  assert.deepEqual(setup.modules[0].style, { left: '123px', top: '45px', zIndex: '9' });
});

test('drag guard rejects focused modules and any drag while focus mode is active', () => {
  const setup = fixture();
  const event = { button: 0, target: { closest: () => null } };
  assert.equal(canStartModuleDrag(setup.modules[0], setup.root, event), true);
  setup.modules[0].classList.add('is-focused');
  assert.equal(canStartModuleDrag(setup.modules[0], setup.root, event), false);
  setup.modules[0].classList.remove('is-focused'); setup.root.classList.add('module-focus-active');
  assert.equal(canStartModuleDrag(setup.modules[0], setup.root, event), false);
});

test('aircraft and flight-carousel panels can independently enter presentation mode', () => {
  const keyListeners = [];
  const documentRef = {
    addEventListener(name, fn) { if (name === 'keydown') keyListeners.push(fn); },
    removeEventListener() {},
  };
  const makePanel = (name) => {
    const button = {
      textContent: '', title: '', attributes: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(name, fn) { this[name] = fn; },
    };
    return {
      dataset: { focusPanel: name }, classList: new Classes(), button,
      querySelector(selector) { return selector === '[data-focus-toggle]' ? button : null; },
    };
  };
  const root = { classList: new Classes() };
  const panels = [makePanel('aircraft'), makePanel('flights')];
  const controller = createPanelFocusController({ panels, root, documentRef });
  controller.open(panels[0]);
  assert.equal(panels[0].classList.contains('is-panel-focused'), true);
  assert.equal(root.classList.contains('panel-focus-active'), true);
  controller.open(panels[1]);
  assert.equal(panels[0].classList.contains('is-panel-focused'), false);
  assert.equal(panels[1].classList.contains('is-panel-focused'), true);
  keyListeners[0]({ key: 'Escape' });
  assert.equal(controller.activePanel, null);
  assert.equal(root.classList.contains('panel-focus-active'), false);
});
