// Exact age as "11y 2m 5d" — coaches use this to place swimmers in competition categories.
export function exactAge(dobString) {
  if (!dobString) return ''
  const dob = new Date(dobString)
  const now = new Date()

  let years = now.getFullYear() - dob.getFullYear()
  let months = now.getMonth() - dob.getMonth()
  let days = now.getDate() - dob.getDate()

  if (days < 0) {
    months -= 1
    // days in the month before the current one
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return `${years}y ${months}m ${days}d`
}
