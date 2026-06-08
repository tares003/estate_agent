import { describe, expect, it } from 'vitest';
import { defineMessages } from './messages.js';
import { createTranslator, t } from './t.js';

describe('t (default en-GB catalogue accessor)', () => {
  it('resolves a known key to its en-GB default string', () => {
    expect(t('common.submit')).toBe('Submit');
    expect(t('validation.email.invalid')).toBe('Enter a valid email address');
  });

  it('returns the key itself for an unknown key (deterministic fallback)', () => {
    // Cast through unknown: the runtime fallback must hold even off the typed map.
    expect(t('does.not.exist' as unknown as 'common.submit')).toBe('does.not.exist');
  });
});

describe('createTranslator (custom catalogue)', () => {
  const catalogue = defineMessages({
    'greeting.hello': 'Hello {name}',
    'greeting.fullName': '{first} {last}',
    'greeting.repeat': '{word} {word}',
    'greeting.plain': 'Welcome',
    'common.submit': 'Submit',
  });
  const translate = createTranslator(catalogue);

  it('resolves a key with no placeholders', () => {
    expect(translate('greeting.plain')).toBe('Welcome');
    expect(translate('common.submit')).toBe('Submit');
  });

  it('interpolates a single placeholder', () => {
    expect(translate('greeting.hello', { name: 'Olive' })).toBe('Hello Olive');
  });

  it('interpolates multiple distinct placeholders', () => {
    expect(translate('greeting.fullName', { first: 'Ada', last: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('interpolates a repeated placeholder everywhere it appears', () => {
    expect(translate('greeting.repeat', { word: 'echo' })).toBe('echo echo');
  });

  it('accepts numeric argument values and stringifies them', () => {
    expect(translate('greeting.hello', { name: 42 })).toBe('Hello 42');
  });

  it('leaves the {token} in place when its arg is missing (deterministic)', () => {
    // No args object at all.
    expect(translate('greeting.hello')).toBe('Hello {name}');
    // Args object present but the needed key absent.
    expect(translate('greeting.hello', { other: 'x' })).toBe('Hello {name}');
  });

  it('ignores extra args that the template does not reference', () => {
    expect(translate('greeting.plain', { unused: 'x' })).toBe('Welcome');
  });

  it('returns the key itself for an unknown key', () => {
    expect(translate('greeting.missing' as unknown as 'greeting.plain')).toBe('greeting.missing');
  });
});
