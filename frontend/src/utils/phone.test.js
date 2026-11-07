import { describe, expect, it } from 'vitest'
import { smsHref, telHref, whatsappHref } from './phone.js'

describe('phone links', () => {
  it('builds call and message links from the stored number', () => {
    expect(telHref('9820000002')).toBe('tel:9820000002')
    expect(smsHref('98200 00002')).toBe('sms:9820000002')
  })

  it('adds 91 to a 10-digit number for WhatsApp', () => {
    expect(whatsappHref('9820000002')).toBe('https://wa.me/919820000002')
  })

  it('keeps a number that already has a country code', () => {
    expect(whatsappHref('+91 98200 00002')).toBe('https://wa.me/919820000002')
    expect(whatsappHref('+14155550123')).toBe('https://wa.me/14155550123')
  })
})
