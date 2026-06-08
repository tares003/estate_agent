import { describe, expect, it } from 'vitest';
import { StorageError, isSafeKey } from './backend.js';

describe('StorageError', () => {
  it('is an Error subclass carrying its name and message', () => {
    const error = new StorageError('object not found');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.name).toBe('StorageError');
    expect(error.message).toBe('object not found');
  });
});

describe('isSafeKey', () => {
  it('accepts plain relative keys', () => {
    expect(isSafeKey('property/aa/photo.jpg')).toBe(true);
    expect(isSafeKey('a.txt')).toBe(true);
    expect(isSafeKey('nested/deep/file.bin')).toBe(true);
  });

  it('rejects empty keys', () => {
    expect(isSafeKey('')).toBe(false);
  });

  it('rejects absolute / leading-slash keys', () => {
    expect(isSafeKey('/etc/passwd')).toBe(false);
    expect(isSafeKey('\\windows\\system32')).toBe(false);
  });

  it('rejects Windows drive-letter absolute keys', () => {
    expect(isSafeKey('C:/secret.txt')).toBe(false);
  });

  it('rejects path-traversal keys', () => {
    expect(isSafeKey('..')).toBe(false);
    expect(isSafeKey('../escape')).toBe(false);
    expect(isSafeKey('a/../../escape')).toBe(false);
    expect(isSafeKey('a/..')).toBe(false);
    expect(isSafeKey('..\\escape')).toBe(false);
  });

  it('rejects keys containing a NUL byte', () => {
    expect(isSafeKey('a\u0000b')).toBe(false);
  });

  it('accepts a key that merely contains dots without being a traversal segment', () => {
    expect(isSafeKey('file..name.txt')).toBe(true);
    expect(isSafeKey('a/b.c/d')).toBe(true);
  });
});
