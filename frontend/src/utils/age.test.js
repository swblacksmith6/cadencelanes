import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exactAge } from './age.js'

describe('exactAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 5)) // 5 Aug 2026
  })
  afterEach(() => vi.useRealTimers())

  it('returns empty for no date', () => {
    expect(exactAge('')).toBe('')
    expect(exactAge(null)).toBe('')
  })

  it('computes years, months and days', () => {
    expect(exactAge('2015-06-01')).toBe('11y 2m 4d')
  })

  it('borrows from the previous month when the day is earlier', () => {
    expect(exactAge('2016-07-20')).toBe('10y 0m 16d')
  })

  it('is exact on a birthday', () => {
    expect(exactAge('2018-08-05')).toBe('8y 0m 0d')
  })
})
