export function parseChangedFiles(input: string): string[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  // git diff format: "+++ b/src/auth/login.ts"
  const diffPattern = /^\+\+\+ b\/(.+)$/gm
  const diffMatches = [...trimmed.matchAll(diffPattern)].map(m => m[1])
  if (diffMatches.length > 0) return diffMatches

  // git diff --name-only format: one path per line
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)

  // Filter out lines that look like git diff metadata
  const pathLines = lines.filter(l =>
    !l.startsWith('diff ') &&
    !l.startsWith('index ') &&
    !l.startsWith('---') &&
    !l.startsWith('@@') &&
    !l.startsWith('+') &&
    !l.startsWith('-') &&
    !l.startsWith('\\') &&
    (l.includes('/') || /\.\w+$/.test(l))
  )

  if (pathLines.length > 0) return pathLines

  // Fallback: treat as comma or newline-separated paths
  return trimmed.split(/[\n,]/).map(l => l.trim()).filter(l => l.length > 0)
}
