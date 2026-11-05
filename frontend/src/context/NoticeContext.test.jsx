import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_KEY, NOTICE_MS, NoticeProvider, useNotice } from './NoticeContext.jsx'

function Trigger({ text = 'Saved', kind }) {
  const { notify } = useNotice()
  return <button onClick={() => notify(text, kind)}>go</button>
}

const setup = (props) => render(<NoticeProvider><Trigger {...props} /></NoticeProvider>)

describe('status bar', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('shows a message and hides it after 10 seconds', () => {
    setup()
    act(() => screen.getByText('go').click())
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    act(() => vi.advanceTimersByTime(NOTICE_MS - 100))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a newer message replaces the old one and restarts the timer', () => {
    setup()
    act(() => screen.getByText('go').click())
    act(() => vi.advanceTimersByTime(8000))
    act(() => screen.getByText('go').click())
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2100))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('can be dismissed by hand', async () => {
    vi.useRealTimers()
    setup()
    await userEvent.click(screen.getByText('go'))
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a message left in session storage before a reload, once', () => {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message: 'Signed out elsewhere', kind: 'warn' }))
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('Signed out elsewhere')
    expect(sessionStorage.getItem(FLASH_KEY)).toBeNull()
  })
})
