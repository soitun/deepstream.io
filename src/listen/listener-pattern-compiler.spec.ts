import 'mocha'
import { expect } from 'chai'

import { compileListenPattern, MAX_PATTERN_LENGTH } from './listener-pattern-compiler'

describe('listen-pattern-compiler', () => {
  describe('basic wildcard patterns', () => {
    it('compiles an exact pattern', () => {
      const re = compileListenPattern('cars')
      expect(re).to.not.equal(null)
      expect(re!.test('cars')).to.equal(true)
      expect(re!.test('carss')).to.equal(false)
      expect(re!.test('car')).to.equal(false)
    })

    it('compiles a simple wildcard', () => {
      const re = compileListenPattern('cars/*')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari')).to.equal(true)
      expect(re!.test('cars/ferrari/engine')).to.equal(true)
      expect(re!.test('boats/ferrari')).to.equal(false)
    })

    it('compiles a wildcard at the beginning', () => {
      const re = compileListenPattern('*/ferrari')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari')).to.equal(true)
      expect(re!.test('boats/ferrari')).to.equal(true)
      expect(re!.test('cars/honda')).to.equal(false)
    })

    it('compiles multiple wildcards', () => {
      const re = compileListenPattern('*/*')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari')).to.equal(true)
      expect(re!.test('boats/toyota/corolla')).to.equal(true)
      expect(re!.test('no-slash')).to.equal(false)
    })
  })

  describe('variable patterns', () => {
    it('compiles a $variable pattern', () => {
      const re = compileListenPattern('cars/$id')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari')).to.equal(true)
      expect(re!.test('cars/123')).to.equal(true)
      expect(re!.test('cars/ferrari/engine')).to.equal(false)
      expect(re!.test('planes/ferrari')).to.equal(false)
    })

    it('compiles multiple variables', () => {
      const re = compileListenPattern('cars/$make/$model')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari/458')).to.equal(true)
      expect(re!.test('cars/ferrari')).to.equal(false)
      expect(re!.test('cars/ferrari/458/spider')).to.equal(false)
    })

    it('compiles a mix of wildcards and variables', () => {
      const re = compileListenPattern('$record/*')
      expect(re).to.not.equal(null)
      expect(re!.test('cars/ferrari')).to.equal(true)
      expect(re!.test('users/john')).to.equal(true)
    })
  })

  describe('regex special character escaping', () => {
    it('escapes dots', () => {
      const re = compileListenPattern('cars.ferrari')
      expect(re).to.not.equal(null)
      expect(re!.test('cars.ferrari')).to.equal(true)
      expect(re!.test('carsZferrari')).to.equal(false)
    })

    it('escapes plus signs', () => {
      const re = compileListenPattern('a+b')
      expect(re).to.not.equal(null)
      expect(re!.test('a+b')).to.equal(true)
      expect(re!.test('ab')).to.equal(false)
      expect(re!.test('aaab')).to.equal(false)
    })

    it('escapes parentheses', () => {
      const re = compileListenPattern('car(s)')
      expect(re).to.not.equal(null)
      expect(re!.test('car(s)')).to.equal(true)
      expect(re!.test('car')).to.equal(false)
      expect(re!.test('cars')).to.equal(false)
    })

    it('passes through regex character classes as-is', () => {
      const re = compileListenPattern('car[0-9]')
      expect(re).to.not.equal(null)
      expect(re!.test('car0')).to.equal(true)
      expect(re!.test('car1')).to.equal(true)
      expect(re!.test('car9')).to.equal(true)
      expect(re!.test('cara')).to.equal(false)
      expect(re!.test('car10')).to.equal(false)
    })

    it('escapes unmached square brackets', () => {
      const re = compileListenPattern('car[')
      expect(re).to.not.equal(null)
      expect(re!.test('car[')).to.equal(true)
      expect(re!.test('car')).to.equal(false)

      const re2 = compileListenPattern('car]')
      expect(re2).to.not.equal(null)
      expect(re2!.test('car]')).to.equal(true)

      const re3 = compileListenPattern('car[]')
      expect(re3).to.not.equal(null)
      expect(re3!.test('car[]')).to.equal(true)
    })

    it('escapes hat and dollar anchors from user input', () => {
      const re = compileListenPattern('^start')
      expect(re).to.not.equal(null)
      expect(re!.test('^start')).to.equal(true)
      expect(re!.test('start')).to.equal(false)

      const re2 = compileListenPattern('end$')
      expect(re2).to.not.equal(null)
      expect(re2!.test('end$')).to.equal(true)
      expect(re2!.test('end')).to.equal(false)
    })

    it('treats .* as a wildcard', () => {
      const re = compileListenPattern('car.*')
      expect(re).to.not.equal(null)
      expect(re!.test('caranything')).to.equal(true)
      expect(re!.test('car.anything')).to.equal(true)
      expect(re!.test('car')).to.equal(true)
    })

    it('handles .* at the beginning and end', () => {
      const re1 = compileListenPattern('.*car')
      expect(re1).to.not.equal(null)
      expect(re1!.test('foo-car')).to.equal(true)
      expect(re1!.test('car')).to.equal(true)

      const re2 = compileListenPattern('.*')
      expect(re2).to.not.equal(null)
      expect(re2!.test('')).to.equal(true)
      expect(re2!.test('anything')).to.equal(true)
    })
  })

  describe('prevention of ReDoS patterns', () => {
    it('treats nested quantifiers as literals', () => {
      const re = compileListenPattern('(a+)+b')
      expect(re).to.not.equal(null)
      expect(re!.test('(a+)+b')).to.equal(true)
      expect(re!.test('aaaab')).to.equal(false)
    })

    it('treats alternation-with-star as literals', () => {
      const re = compileListenPattern('(.+)+$')
      expect(re).to.not.equal(null)
      expect(re!.test('(.+)+$')).to.equal(true)
    })

    it('treats exponential backtracking pattern as literal', () => {
      const re = compileListenPattern('^(a+)+$')
      expect(re).to.not.equal(null)
      expect(re!.test('^(a+)+$')).to.equal(true)
      expect(re!.test('aaaa')).to.equal(false)
    })

    it('compiles evil patterns fast (no backtracking)', function (): void {
      this.timeout(2000)
      const re = compileListenPattern('(a+)+b')
      expect(re).to.not.equal(null)
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        re!.test('a'.repeat(100) + '!')
      }
      const elapsed = Date.now() - start
      expect(elapsed).to.be.lessThan(500)
    })
  })

  describe('input validation', () => {
    it('rejects null', () => {
      expect(compileListenPattern(null as any)).to.equal(null)
    })

    it('rejects undefined', () => {
      expect(compileListenPattern(undefined as any)).to.equal(null)
    })

    it('rejects empty string', () => {
      expect(compileListenPattern('')).to.equal(null)
    })

    it('rejects non-string', () => {
      expect(compileListenPattern(42 as any)).to.equal(null)
    })

    it('rejects patterns exceeding max length', () => {
      const long = 'a'.repeat(MAX_PATTERN_LENGTH + 1)
      expect(compileListenPattern(long)).to.equal(null)
    })

    it('accepts patterns at the max length', () => {
      const max = 'a'.repeat(MAX_PATTERN_LENGTH)
      expect(compileListenPattern(max)).to.not.equal(null)
    })
  })

  describe('anchoring', () => {
    it('only matches full string (not substring)', () => {
      const re = compileListenPattern('car')
      expect(re).to.not.equal(null)
      expect(re!.test('car')).to.equal(true)
      expect(re!.test('carpet')).to.equal(false)
      expect(re!.test('scar')).to.equal(false)
    })

    it('wildcard anchored to substring', () => {
      const re = compileListenPattern('*car')
      expect(re).to.not.equal(null)
      expect(re!.test('scar')).to.equal(true)
      expect(re!.test('carpet')).to.equal(false)
      expect(re!.test('car')).to.equal(true)
    })
  })
})
