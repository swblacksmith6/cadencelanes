import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { ModeProvider } from '../context/ModeContext.jsx'
import Profile, { initials } from './Profile.jsx'

const setup = () => {
  localStorage.setItem('access_token', 't')
  localStorage.setItem('user', JSON.stringify({
    id: 'u1', name: 'Rajesh Menon', role: 'head_coach', club_id: 'c1', club_name: 'Aqua Stars Swim Academy',
  }))
  return render(
    <AuthProvider>
      <ModeProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </ModeProvider>
    </AuthProvider>
  )
}

describe('Profile', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.fontSize = ''
  })

  it('builds initials from the name', () => {
    expect(initials('Rajesh Menon')).toBe('RM')
    expect(initials('  priya  ')).toBe('P')
    expect(initials('')).toBe('?')
  })

  it('shows the name, role and club', () => {
    setup()
    expect(screen.getByText('Rajesh Menon')).toBeInTheDocument()
    expect(screen.getByText('Head Coach')).toBeInTheDocument()
    expect(screen.getByText('Aqua Stars Swim Academy')).toBeInTheDocument()
  })

  it('changes and remembers the text size', async () => {
    setup()
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Large' }))
    expect(document.documentElement.style.fontSize).toBe('18px')
    expect(localStorage.getItem('text_size')).toBe('large')
  })

  it('offers the layout choice on a wide screen and saves it', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'Phone' }))
    expect(localStorage.getItem('ui_mode')).toBe('coach')
  })

  it('logs out and goes to the login page', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
