// Contact links for a parent phone number (10 to 15 chars, as stored).
// A bare 10-digit number is an Indian number, so WhatsApp gets the 91 prefix.

const digits = (phone) => String(phone || '').replace(/\D/g, '')

export const telHref = (phone) => `tel:${digits(phone)}`
export const smsHref = (phone) => `sms:${digits(phone)}`

export function whatsappHref(phone) {
  const d = digits(phone)
  const full = d.length === 10 ? `91${d}` : d
  return `https://wa.me/${full}`
}
