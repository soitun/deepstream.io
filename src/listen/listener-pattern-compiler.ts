/**
 * Compiles a client-supplied wildcard pattern into a safe regular expression.
 *
 * Tokens:
 *   *          → .*           matches any characters (including /)
 *   $varName   → ([^/]+)      matches a single /-delimited path segment
 *   [...]      → passed through as a regex character class
 *   .*         → .*           legacy regex, equivalent to wildcard *
 *
 * All other regex-special characters ( . + ? ^ $ { } ( ) [ ] | \ ) are
 * escaped before compilation, and the resulting expression is anchored with
 * ^...$ . This prevents catastrophic-backtracking ReDoS because the only
 * quantifier constructs that can appear are .* and [^/]+, neither of which
 * nests quantifiers.
 */

const ESCAPE_REGEXP = /[.*+?^${}()|[\]\\]/g
const TOKEN_REGEXP = /\[[^\]]+\]|\.\*|\*|\$[a-zA-Z][a-zA-Z0-9]*/g

export const MAX_PATTERN_LENGTH = 256

export const compileListenPattern = (pattern: string): RegExp | null => {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_PATTERN_LENGTH) {
    return null
  }

  let result = ''
  let lastIndex = 0

  const matches = pattern.matchAll(TOKEN_REGEXP)
  for (const match of matches) {
    const literal = pattern.slice(lastIndex, match.index!)
    result += literal.replace(ESCAPE_REGEXP, '\\$&')

    if (match[0] === '*' || match[0] === '.*') {
      result += '.*'
    } else if (match[0].startsWith('[')) {
      result += match[0]
    } else {
      result += '([^/]+)'
    }

    lastIndex = match.index! + match[0].length
  }

  result += pattern.slice(lastIndex).replace(ESCAPE_REGEXP, '\\$&')

  try {
    const regexp = new RegExp(`^${result}$`)
    return regexp
  } catch (e) {
    return null
  }
}
