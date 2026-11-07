import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client.js'
import { AuthProvider } from '../context/AuthContext.jsx'
import { NoticeProvider } from '../context/NoticeContext.jsx'
import ProgressReport from './ProgressReport.jsx'

vi.mock('../api/client.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

// ResponsiveContainer needs a measured size, which jsdom does not give.
vi.mock('recharts', async (orig) => {
  const mod = await orig()
  return { ...mod, ResponsiveContainer: ({ children }) => <div>{children}</div> }
})

const report = {
  student: { id: 's1', name: 'Dev Malhotra', date_of_birth: '2012-07-15', enrolled_since: '2026-01-01' },
  attendance: {
    last_7_days: { percentage: 90, attended: 9, total: 10 },
    last_30_days: { percentage: 80, attended: 24, total: 30 },
    all_time: { percentage: 85, attended: 85, total: 100 },
    current_streak: 4,
  },
  personal_bests: [{ style: 'Freestyle', distance: '50m', best_time: 30.69, improvement: 0.5, achieved_at: '2026-01-01' }],
  timing_trends: {
    a: { label: 'Freestyle 50m', data: [{ date: '1 Jan', time: 31 }] },
    b: { label: 'Backstroke 50m', data: [{ date: '1 Jan', time: 40 }] },
  },
  skill_ratings: [],
  recent_notes: [],
}

function setup() {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', club_id: 'c1', role: 'head_coach' }))
  return render(
    <AuthProvider>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/students/s1/progress']}>
          <Routes>
            <Route path="/students/:id/progress" element={<ProgressReport />} />
          </Routes>
        </MemoryRouter>
      </NoticeProvider>
    </AuthProvider>
  )
}

describe('ProgressReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation((url) =>
      Promise.resolve({ data: url.endsWith('/swim-styles') ? [] : report })
    )
  })

  it('picks the timing trend with radio buttons', async () => {
    setup()
    const first = await screen.findByRole('radio', { name: 'Freestyle 50m (PB 30.69s)' })
    const second = screen.getByRole('radio', { name: 'Backstroke 50m (PB 40s)' })
    expect(first).toBeChecked()
    await userEvent.click(second)
    expect(second).toBeChecked()
    expect(first).not.toBeChecked()
    expect(screen.queryByRole('combobox', { name: /trend/i })).toBeNull()
  })

  it('shows each trend chip with its own personal best, falling back to the fastest recorded time', async () => {
    setup()
    expect(await screen.findByText(/Freestyle 50m \(PB 30\.69s\)/)).toBeInTheDocument()
    expect(screen.getByText(/Backstroke 50m \(PB 40s\)/)).toBeInTheDocument()
  })

  it('shows Print as an icon button without text', async () => {
    setup()
    const print = await screen.findByRole('button', { name: 'Print' })
    expect(print).toHaveTextContent('')
  })
})
