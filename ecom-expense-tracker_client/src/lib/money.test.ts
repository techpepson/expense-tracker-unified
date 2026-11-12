import { describe, it, expect } from 'vitest'
import { parseLegacyAmount, computeTotal, formatGHS, toPesewas, fromPesewas } from '@/lib/money'

describe('Money utilities and parseLegacyAmount', () => {
  it('parses formatted Ghc strings with spaces and commas', () => {
    expect(parseLegacyAmount('Ghc 1,250')).toBe(1250)
    expect(parseLegacyAmount('Ghc  6, 258.50')).toBe(6258.5)
    expect(parseLegacyAmount('Ghc 20 ')).toBe(20)
    expect(parseLegacyAmount('GH₵ 300.75')).toBe(300.75)
    expect(parseLegacyAmount(450.25)).toBe(450.25)
  })

  it('handles null, undefined, empty and dash', () => {
    expect(parseLegacyAmount(null)).toBeNull()
    expect(parseLegacyAmount(undefined)).toBeNull()
    expect(parseLegacyAmount('')).toBeNull()
    expect(parseLegacyAmount('-')).toBeNull()
    expect(parseLegacyAmount('abc')).toBeNull()
  })

  it('calculates total using integer pesewas without float error', () => {
    expect(computeTotal(10.5, 2)).toBe(21)
    expect(computeTotal(33.33, 3)).toBe(99.99)
    expect(toPesewas(12.55)).toBe(1255)
    expect(fromPesewas(1255)).toBe(12.55)
  })

  it('formats GHS properly', () => {
    const formatted = formatGHS(1250)
    expect(formatted).toContain('1,250.00')
  })
})

