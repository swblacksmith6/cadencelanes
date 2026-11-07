import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { ModeProvider } from '../context/ModeContext.jsx'
import { NoticeProvider } from '../context/NoticeContext.jsx'
import Profile from '../pages/Profile.jsx'
import Layout from './Layout.jsx'

const original = window.matchMedia
const stubWidth = (narrow) => {
  window.matchMedia = () => ({ matches: narrow, addEventListener: () => {}, removeEventListener: () => {} })
}

function setup() {
  localStorage.setItem('access_token', 't')
  localStorage.setItem('user', JSON.stringify({
    id: 'u1', name: 'Rajesh Menon', role: 'head_coach', club_id: 'c1', club_name: 'Aqua Stars Swim Academy',
  }))
  return render(
    <AuthProvider>
      <ModeProvider>
        <NoticeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<div>dashboard page</div>} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="/login" element={<div>login page</div>} />
            </Routes>
          </MemoryRouter>
        </NoticeProvider>
      </ModeProvider>
    </AuthProvider>
  )
}

describe('Layout top bar', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { window.matchMedia = original })

  for (const [name, narrow] of [['phone', true], ['desktop', false]]) {
    it(`${name}: shows the user's initials as a link to Profile and no Log out button`, () => {
      stubWidth(narrow)
      setup()
      const avatar = screen.getByRole('link', { name: 'Profile and settings' })
      expect(avatar).toHaveAttribute('href', '/profile')
      expect(avatar).toHaveTextContent('RM')
      expect(screen.queryByRole('button', { name: /log ?out/i })).toBeNull()
    })
  }

  it('phone: the avatar opens Profile, and logging out from there returns to login', async () => {
    stubWidth(true)
    setup()
    await userEvent.click(screen.getByRole('link', { name: 'Profile and settings' }))
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('phone: the layout choice is hidden because a phone always uses the phone layout', async () => {
    stubWidth(true)
    setup()
    await userEvent.click(screen.getByRole('link', { name: 'Profile and settings' }))
    expect(await screen.findByRole('radio', { name: 'Normal' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Desktop' })).toBeNull()
  })
})
