import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_KEY, NOTICE_MS, NoticeBar, NoticeProvider, useErrorNotice, useNotice } from './NoticeContext.jsx'

function Trigger({ text = 'Saved', kind }) {
  const { notify } = useNotice()
  return <button onClick={() => notify(text, kind)}>go</button>
}

const setup = (props) => render(<NoticeProvider><NoticeBar /><Trigger {...props} /></NoticeProvider>)

function ErrorSource({ error }) {
  useErrorNotice(error)
  return null
}

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

  it('colours info blue, success green and error red', () => {
    const cases = [['info', 'bg-blue-50'], ['success', 'bg-green-100'], ['error', 'bg-red-50']]
    for (const [kind, cls] of cases) {
      const { unmount } = setup({ kind })
      act(() => screen.getByText('go').click())
      expect(screen.getByRole('status').className).toContain(cls)
      unmount()
    }
  })

  it('an info message is the default kind', () => {
    setup()
    act(() => screen.getByText('go').click())
    expect(screen.getByRole('status').className).toContain('bg-blue-50')
  })

  it('takes no space when there is no message', () => {
    const { container } = setup()
    expect(container.querySelector('.h-12')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a page error in the bar as an error', () => {
    render(<NoticeProvider><NoticeBar /><ErrorSource error="Failed to save" /></NoticeProvider>)
    const bar = screen.getByRole('status')
    expect(bar).toHaveTextContent('Failed to save')
    expect(bar.className).toContain('bg-red-50')
  })
})
