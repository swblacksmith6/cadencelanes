import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Newer Node versions ship their own (unusable) global localStorage that shadows jsdom's.
// An in-memory Storage keeps tests identical on every Node version.
class MemoryStorage {
  #data = new Map()
  get length() { return this.#data.size }
  key(i) { return [...this.#data.keys()][i] ?? null }
  getItem(k) { return this.#data.has(String(k)) ? this.#data.get(String(k)) : null }
  setItem(k, v) { this.#data.set(String(k), String(v)) }
  removeItem(k) { this.#data.delete(String(k)) }
  clear() { this.#data.clear() }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true })
Object.defineProperty(window, 'localStorage', { value: globalThis.localStorage, configurable: true, writable: true })

// React Router v6 prints v7 migration notices on every render; they are not test signal.
const warn = console.warn
console.warn = (...args) => {
  if (String(args[0]).includes('React Router Future Flag')) return
  warn(...args)
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
