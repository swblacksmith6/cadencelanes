import { beforeEach, describe, expect, it } from 'vitest'
import { applyTextSize, getTextSize, setTextSize } from './textSize.js'

describe('text size', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.fontSize = ''
  })

  it('defaults to normal', () => {
    expect(getTextSize()).toBe('normal')
    applyTextSize()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('saves the choice and scales the root font size', () => {
    setTextSize('large')
    expect(document.documentElement.style.fontSize).toBe('18px')
    expect(getTextSize()).toBe('large')
  })

  it('ignores a saved value it does not know', () => {
    localStorage.setItem('text_size', 'huge')
    expect(getTextSize()).toBe('normal')
  })
})
