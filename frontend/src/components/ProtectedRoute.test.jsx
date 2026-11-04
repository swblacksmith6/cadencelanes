import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

function renderAt(path, user) {
  if (user) localStorage.setItem('user', JSON.stringify(user))
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/dashboard" element={<div>dashboard page</div>} />
          <Route path="/admin" element={<div>admin page</div>} />
          <Route element={<ProtectedRoute roles={['head_coach']} />}>
            <Route path="/coaches" element={<div>coaches page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('ProtectedRoute', () => {
  it('sends anonymous users to login', () => {
    renderAt('/coaches')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('lets an allowed role through', () => {
    renderAt('/coaches', { role: 'head_coach' })
    expect(screen.getByText('coaches page')).toBeInTheDocument()
  })

  it('redirects a coach role that is not allowed to the dashboard', () => {
    renderAt('/coaches', { role: 'assistant_coach' })
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('redirects a super admin to the admin area', () => {
    renderAt('/coaches', { role: 'super_admin' })
    expect(screen.getByText('admin page')).toBeInTheDocument()
  })
})
