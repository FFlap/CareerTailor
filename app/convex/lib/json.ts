function stripJsonFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

export function extractJsonCandidate(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return text
  return text.slice(start, end + 1)
}

function normalizeJsonCandidate(text: string) {
  const stripped = stripJsonFences(text)
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
  return repairJsonSyntax(candidate)
}

function repairJsonSyntax(text: string) {
  let normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      out += '\\n'
      continue
    }
    out += ch
  }

  normalized = out.replace(/,\s*([}\]])/g, '$1')
  return normalized
}

export function safeJsonParse(text: string): unknown {
  const normalized = normalizeJsonCandidate(text)
  try {
    return JSON.parse(normalized)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Model response was not valid JSON. ${message}`)
  }
}
