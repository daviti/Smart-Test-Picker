import Anthropic from '@anthropic-ai/sdk'
import { FEATURE_DOMAINS } from './core/feature-mapping'

const DOMAIN_LIST = FEATURE_DOMAINS.map(d => `${d.id}: ${d.description}`).join('\n')

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

export async function suggestDomainsForFile(filePath: string): Promise<string[]> {
  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: [
        'You are a QA engineer analyzing a codebase. Given a file path, identify which feature domains it likely affects.',
        `Available domains:\n${DOMAIN_LIST}`,
        'Respond with ONLY a JSON array of domain IDs (e.g. ["auth", "navigation"]). No explanation, no text outside the JSON.',
      ].join('\n\n'),
      messages: [
        {
          role: 'user',
          content: `File: ${filePath}\n\nWhich domains does this affect?`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return []
    }

    if (!Array.isArray(parsed)) return []
    const validIds = new Set(FEATURE_DOMAINS.map(d => d.id))
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id))
  } catch {
    return []
  }
}

export async function enrichUnmappedFiles(unmappedFiles: string[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>()

  if (!process.env.ANTHROPIC_API_KEY) {
    return results
  }

  await Promise.all(
    unmappedFiles.map(async file => {
      const domains = await suggestDomainsForFile(file)
      if (domains.length > 0) {
        results.set(file, domains)
      }
    })
  )

  return results
}
