import Anthropic from '@anthropic-ai/sdk'
import { FEATURE_DOMAINS } from './core/feature-mapping'

const client = new Anthropic()

const DOMAIN_LIST = FEATURE_DOMAINS.map(d => `${d.id}: ${d.description}`).join('\n')

export async function suggestDomainsForFile(filePath: string): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are a QA engineer analyzing a codebase. Given a file path, identify which feature domains it likely affects.
Available domains:
${DOMAIN_LIST}

Respond with ONLY a JSON array of domain IDs (e.g. ["auth", "navigation"]). Never explain, never add text outside the JSON.`,
      messages: [
        {
          role: 'user',
          content: `File path: ${filePath}\n\nWhich domains does this likely affect?`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const parsed = JSON.parse(text)

    if (!Array.isArray(parsed)) return []
    return parsed.filter((id: unknown) => typeof id === 'string' && FEATURE_DOMAINS.some(d => d.id === id))
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
