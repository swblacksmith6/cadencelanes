import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client.js'
import { AuthProvider } from '../context/AuthContext.jsx'
import { NoticeProvider } from '../context/NoticeContext.jsx'
import Login from './Login.jsx'

vi.mock('../api/client.js', () => ({ default: { post: vi.fn() } }))

const setup = () =>
  render(
    <AuthProvider>
      <NoticeProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </NoticeProvider>
    </AuthProvider>
  )

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the phone number first', () => {
    setup()
    expect(screen.getByPlaceholderText('10-digit phone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeInTheDocument()
  })

  it('requests an OTP and moves to the code step without leaking an OTP hint in production', async () => {
    api.post.mockResolvedValueOnce({ data: { message: 'OTP sent' } })
    setup()
    await userEvent.type(screen.getByPlaceholderText('10-digit phone'), '9800000001')
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/request-otp', { phone: '9800000001' }))
    expect(screen.queryByText(/MVP mode/)).toBeNull()
  })

  it('shows the server error when the phone is not registered', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Phone not registered' } } })
    setup()
    await userEvent.type(screen.getByPlaceholderText('10-digit phone'), '9800000009')
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    expect(await screen.findByText('Phone not registered')).toBeInTheDocument()
  })

  it('warns that signing in ends other sessions', () => {
    setup()
    expect(screen.getByText(/ends your session on any other device/)).toBeInTheDocument()
  })

  it('tells the user in the status bar when another device was signed out', async () => {
    api.post
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({
        data: { access_token: 't', other_sessions_ended: true, user: { id: '1', role: 'head_coach', name: 'A' } },
      })
    setup()
    await userEvent.type(screen.getByPlaceholderText('10-digit phone'), '9800000001')
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    await userEvent.type(await screen.findByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify & Login' }))
    expect(await screen.findByRole('status')).toHaveTextContent('other signed-in device has been signed out')
  })

  it('uses the numeric keyboard for the OTP and lets the phone fill it from SMS', async () => {
    api.post.mockResolvedValueOnce({ data: { message: 'OTP sent' } })
    setup()
    await userEvent.type(screen.getByPlaceholderText('10-digit phone'), '9800000001')
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    const code = await screen.findByPlaceholderText('6-digit code')
    expect(code).toHaveAttribute('inputmode', 'numeric')
    expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  })
})
