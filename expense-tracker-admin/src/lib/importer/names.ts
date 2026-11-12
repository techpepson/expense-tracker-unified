/** Trim and collapse internal whitespace. Spelling is never changed. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** Case-insensitive identity used for de-duplication. */
export function nameKey(raw: string): string {
  return cleanName(raw).toLowerCase()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }
  return prev[b.length]!
}

const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** True when two names look like the same thing typed differently (typo, plural, spacing). */
export function isNearDuplicate(a: string, b: string): boolean {
  const x = lettersOnly(a)
  const y = lettersOnly(b)
  if (!x || !y) return false
  if (x === y) return true
  const shorter = Math.min(x.length, y.length)
  if (shorter < 5) return false
  const d = levenshtein(x, y)
  if (shorter < 8) return d <= 1
  if (shorter <= 15) return d <= 2
  return d / Math.max(x.length, y.length) <= 0.12
}

