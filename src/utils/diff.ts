export type DiffSegment = { type: 'equal' | 'added' | 'removed'; text: string }

/**
 * Word-level diff between two strings. Returns segments tagged as
 * equal / added / removed, suitable for inline rendering like GitHub.
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = tokenize(oldText)
  const newWords = tokenize(newText)

  // LCS via Hunt-Szymanski style DP (fine for typical field sizes)
  const lcs = longestCommonSubsequence(oldWords, newWords)

  const segments: DiffSegment[] = []
  let oi = 0
  let ni = 0
  let li = 0

  while (oi < oldWords.length || ni < newWords.length) {
    if (li < lcs.length) {
      const [matchOld, matchNew] = lcs[li]

      // Removed words before this match
      if (oi < matchOld) {
        push(segments, 'removed', oldWords.slice(oi, matchOld).join(''))
      }
      // Added words before this match
      if (ni < matchNew) {
        push(segments, 'added', newWords.slice(ni, matchNew).join(''))
      }
      // Equal word
      push(segments, 'equal', oldWords[matchOld])
      oi = matchOld + 1
      ni = matchNew + 1
      li++
    } else {
      // Remaining after LCS is exhausted
      if (oi < oldWords.length) {
        push(segments, 'removed', oldWords.slice(oi).join(''))
      }
      if (ni < newWords.length) {
        push(segments, 'added', newWords.slice(ni).join(''))
      }
      break
    }
  }

  return segments
}

function push(segments: DiffSegment[], type: DiffSegment['type'], text: string) {
  if (!text) return
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.text += text
  } else {
    segments.push({ type, text })
  }
}

/** Split text into tokens preserving whitespace as separate tokens. */
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? []
}

/** Returns array of [oldIndex, newIndex] pairs for the LCS. */
function longestCommonSubsequence(a: string[], b: string[]): [number, number][] {
  const m = a.length
  const n = b.length

  // For very long texts, bail to a simpler approach
  if (m * n > 500_000) {
    return simpleLcs(a, b)
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const result: [number, number][] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push([i, j])
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      j++
    }
  }

  return result
}

/** Greedy LCS for very large inputs - less optimal but O(n). */
function simpleLcs(a: string[], b: string[]): [number, number][] {
  const bMap = new Map<string, number[]>()
  for (let j = 0; j < b.length; j++) {
    const arr = bMap.get(b[j])
    if (arr) arr.push(j)
    else bMap.set(b[j], [j])
  }

  const result: [number, number][] = []
  let lastJ = -1
  for (let i = 0; i < a.length; i++) {
    const positions = bMap.get(a[i])
    if (!positions) continue
    // Find the first position > lastJ
    const pos = positions.find(p => p > lastJ)
    if (pos !== undefined) {
      result.push([i, pos])
      lastJ = pos
    }
  }
  return result
}
