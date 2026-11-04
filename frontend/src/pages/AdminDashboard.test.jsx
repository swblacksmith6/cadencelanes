import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client.js'
import { AuthProvider } from '../context/AuthContext.jsx'
import AdminDashboard from './AdminDashboard.jsx'

vi.mock('../api/client.js', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const setup = () =>
  render(
    <AuthProvider>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </AuthProvider>
  )

async function fillForm() {
  await userEvent.click(screen.getByRole('button', { name: /add club/i }))
  await userEvent.type(screen.getByPlaceholderText('Club name'), 'New Club')
  await userEvent.type(screen.getByPlaceholderText('Head coach name'), 'Head One')
  await userEvent.type(screen.getByPlaceholderText(/Head coach phone/), '9812345678')
}

describe('AdminDashboard add club', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
  })

  it('hides the form until Add club is clicked', async () => {
    setup()
    expect(screen.queryByPlaceholderText('Club name')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /add club/i }))
    expect(screen.getByPlaceholderText('Club name')).toBeInTheDocument()
  })

  it('creates the club through the admin endpoint and switches to the approved list', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'c1' } })
    setup()
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /create and approve/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/clubs', {
        name: 'New Club',
        head_coach_name: 'Head One',
        head_coach_phone: '9812345678',
      })
    )
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/admin/clubs', { params: { status: 'approved' } })
    )
    expect(screen.queryByPlaceholderText('Club name')).toBeNull()
  })

  it('shows the server error and keeps the form open', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Phone is already registered' } } })
    setup()
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /create and approve/i }))
    expect(await screen.findByText('Phone is already registered')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Club name')).toHaveValue('New Club')
  })
})
