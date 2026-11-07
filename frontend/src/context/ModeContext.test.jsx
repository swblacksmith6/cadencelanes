import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModeProvider, useMode } from './ModeContext.jsx'

function Probe() {
  const { mode, preferred, narrow } = useMode()
  return <div data-testid="p">{`${mode}|${preferred}|${narrow}`}</div>
}

function stubMatchMedia(matches) {
  window.matchMedia = () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

describe('ModeProvider', () => {
  const original = window.matchMedia
  beforeEach(() => localStorage.clear())
  afterEach(() => { window.matchMedia = original })

  it('forces coach layout on a phone-width screen even if analytics was saved', () => {
    localStorage.setItem('ui_mode', 'analytics')
    stubMatchMedia(true)
    render(<ModeProvider><Probe /></ModeProvider>)
    expect(screen.getByTestId('p').textContent).toBe('coach|analytics|true')
  })

  it('uses the saved choice on a wide screen', () => {
    localStorage.setItem('ui_mode', 'coach')
    stubMatchMedia(false)
    render(<ModeProvider><Probe /></ModeProvider>)
    expect(screen.getByTestId('p').textContent).toBe('coach|coach|false')
  })
})
