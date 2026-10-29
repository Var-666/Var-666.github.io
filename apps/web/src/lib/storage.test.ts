import test from 'node:test'
import assert from 'node:assert/strict'
import { preferenceStorage } from './storage'

test('blocked storage object and methods retain preferences in memory; successful writes recover', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('denied')
        },
      },
    })
    assert.equal(preferenceStorage.getItem('object-blocked'), null)
    preferenceStorage.setItem('object-blocked', 'dark')
    assert.equal(preferenceStorage.getItem('object-blocked'), 'dark')
    preferenceStorage.removeItem('object-blocked')
    assert.equal(preferenceStorage.getItem('object-blocked'), null)
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem() {
            throw new Error('denied')
          },
          setItem() {
            throw new Error('quota')
          },
          removeItem() {
            throw new Error('denied')
          },
        },
      },
    })
    preferenceStorage.setItem('methods-blocked', 'value')
    assert.equal(preferenceStorage.getItem('methods-blocked'), 'value')
    preferenceStorage.removeItem('methods-blocked')
    assert.equal(preferenceStorage.getItem('methods-blocked'), null)
    const saved = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => saved.get(key) ?? null,
          setItem: (key: string, value: string) => saved.set(key, value),
          removeItem: (key: string) => saved.delete(key),
        },
      },
    })
    preferenceStorage.setItem('methods-blocked', 'persisted')
    assert.equal(saved.get('methods-blocked'), 'persisted')
    saved.set('methods-blocked', 'updated')
    assert.equal(preferenceStorage.getItem('methods-blocked'), 'updated')
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
