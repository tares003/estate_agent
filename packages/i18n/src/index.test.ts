import { describe, expect, it } from 'vitest';
import * as i18n from './index.js';

describe('@estate/i18n public entry', () => {
  it('re-exports the runtime accessors and registry helpers', () => {
    expect(typeof i18n.t).toBe('function');
    expect(typeof i18n.createTranslator).toBe('function');
    expect(typeof i18n.defineMessages).toBe('function');
    expect(typeof i18n.MESSAGES).toBe('object');
  });

  it('the re-exported t resolves a shared-catalogue key', () => {
    expect(i18n.t('common.cancel')).toBe('Cancel');
  });

  it('the re-exported MESSAGES is the shared en-GB catalogue', () => {
    expect(i18n.MESSAGES['common.submit']).toBe('Submit');
  });
});
