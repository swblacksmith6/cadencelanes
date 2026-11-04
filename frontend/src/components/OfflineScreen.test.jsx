import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineScreen from './OfflineScreen.jsx'

const setOnline = (value) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)

describe('OfflineScreen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders nothing while online', () => {
    setOnline(true)
    render(<OfflineScreen />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a red blocking screen when the app opens offline', () => {
    setOnline(false)
    render(<OfflineScreen />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('You are offline')
    expect(alert).toHaveTextContent('Connect to the internet')
    expect(alert.className).toMatch(/bg-red-600/)
    expect(alert.className).toMatch(/fixed/)
  })

  it('reacts to the browser going offline and back online', () => {
    setOnline(true)
    render(<OfflineScreen />)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
