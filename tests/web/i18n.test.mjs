import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  createI18n,
  normalizeLocale,
} from '../../web/src/i18n.js';

test('simplified Chinese is always the default locale', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
  assert.equal(normalizeLocale(), 'zh-CN');
  assert.equal(normalizeLocale('unsupported'), 'zh-CN');
});

test('language menu offers a broad set of explicitly supported locales', () => {
  assert.deepEqual(
    SUPPORTED_LOCALES.map(({ code }) => code),
    ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi'],
  );
});

test('translator switches locale, interpolates values and falls back to Chinese', () => {
  const i18n = createI18n('en');
  assert.equal(i18n.t('settings.title'), 'Dashboard settings');
  assert.equal(i18n.t('radar.liveCount', { count: 12 }), 'Live · 12');
  assert.equal(i18n.t('missing.key'), 'missing.key');

  i18n.setLocale('ja');
  assert.equal(i18n.locale, 'ja');
  assert.equal(i18n.t('settings.title'), 'ダッシュボード設定');
  assert.equal(i18n.t('language.name'), '言語');
});

test('every locale translates the primary navigation and connection controls', () => {
  for (const { code } of SUPPORTED_LOCALES) {
    const i18n = createI18n(code);
    for (const key of ['language.name', 'settings.title', 'connection.title', 'connection.connect', 'connection.demo', 'connection.disconnect']) {
      assert.notEqual(i18n.t(key), key, `${code} is missing ${key}`);
      assert.ok(i18n.t(key).trim(), `${code} has an empty ${key}`);
    }
  }
});

test('settings include the language selector and translatable dashboard landmarks', async () => {
  const html = await readFile(new URL('../../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="languageInput"/);
  assert.match(html, /data-i18n="language\.name"/);
  assert.match(html, /data-i18n="settings\.title"/);
  assert.match(html, /data-i18n="modules\.terrain"/);
  assert.match(html, /data-i18n="radar\.nearby"/);
});
