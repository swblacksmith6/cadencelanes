import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api, { SESSION_REPLACED_TEXT } from './client.js'
import { FLASH_KEY } from '../context/NoticeContext.jsx'

const run = async (handler, config = {}) => {
  api.defaults.adapter = handler
  return api.get('/ping', config)
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'tok')
    localStorage.setItem('user', '{"role":"head_coach"}')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the stored token as a bearer header', async () => {
    let seen
    await run(async (config) => {
      seen = config.headers.Authorization
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    })
    expect(seen).toBe('Bearer tok')
  })

  it('uses /api as the base url', () => {
    expect(api.defaults.baseURL).toBe('/api')
  })

  it('clears the stored login and goes to /login on a 401', async () => {
    const loc = { pathname: '/students', href: '' }
    vi.stubGlobal('location', loc)
    await run(async (config) => {
      const err = new Error('unauthorized')
      err.config = config
      err.response = { status: 401, data: {}, config }
      throw err
    }).catch(() => {})
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(loc.href).toBe('/login')
  })

  it('leaves a notice for the login page when the session was replaced on another device', async () => {
    vi.stubGlobal('location', { pathname: '/students', href: '' })
    await run(async (config) => {
      const err = new Error('unauthorized')
      err.config = config
      err.response = { status: 401, data: { detail: 'SESSION_REPLACED' }, config }
      throw err
    }).catch(() => {})
    expect(JSON.parse(sessionStorage.getItem(FLASH_KEY)).message).toBe(SESSION_REPLACED_TEXT)
    sessionStorage.clear()
  })

  it('leaves no notice for an ordinary 401', async () => {
    vi.stubGlobal('location', { pathname: '/students', href: '' })
    await run(async (config) => {
      const err = new Error('unauthorized')
      err.config = config
      err.response = { status: 401, data: { detail: 'Invalid or expired token' }, config }
      throw err
    }).catch(() => {})
    expect(sessionStorage.getItem(FLASH_KEY)).toBeNull()
  })

  it('keeps the login on other errors', async () => {
    vi.stubGlobal('location', { pathname: '/students', href: '' })
    await run(async (config) => {
      const err = new Error('boom')
      err.config = config
      err.response = { status: 500, data: {}, config }
      throw err
    }).catch(() => {})
    expect(localStorage.getItem('access_token')).toBe('tok')
  })
})
