// Text size is a per-device setting. It scales the whole app by changing the root font size,
// because the layout is built in rem units.

export const TEXT_SIZES = [
  { id: 'small', label: 'Small', px: 14 },
  { id: 'normal', label: 'Normal', px: 16 },
  { id: 'large', label: 'Large', px: 18 },
]

const KEY = 'text_size'

export function getTextSize() {
  try {
    const saved = localStorage.getItem(KEY)
    if (TEXT_SIZES.some((s) => s.id === saved)) return saved
  } catch {
    // storage unavailable: use the default
  }
  return 'normal'
}

export function applyTextSize(id = getTextSize()) {
  const size = TEXT_SIZES.find((s) => s.id === id) || TEXT_SIZES[1]
  document.documentElement.style.fontSize = `${size.px}px`
}

export function setTextSize(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // the change still applies for this visit
  }
  applyTextSize(id)
}
