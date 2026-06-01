import type {
  FeatureDomain,
  FileDomainMapping,
  PickResult,
  ReleaseWindow,
  RuntimeEstimate,
  Strategy,
} from './types'
import { FEATURE_DOMAINS, getAllSmokeSpecs, matchDomains } from './feature-mapping'

const FULL_SUITE_PARALLEL_MINUTES = 80
const SMOKE_SPEC_MINUTES = 1.5
const E2E_SPEC_MINUTES = 3.5
const BLAST_RADIUS_THRESHOLD = 5
const CONFIDENCE_THRESHOLD = 0.7

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function calculateConfidence(
  changedFiles: string[],
  unmappedFiles: string[],
  triggeredDomains: FeatureDomain[]
): number {
  if (changedFiles.length === 0) return 0

  const mappedRatio = 1 - unmappedFiles.length / changedFiles.length
  const criticalPenalty = triggeredDomains.filter(d => d.riskLevel === 'critical').length * 0.05
  return Math.max(0, Math.min(1, mappedRatio - criticalPenalty))
}

function estimateRuntime(smokeSpecs: string[], e2eSpecs: string[]): RuntimeEstimate {
  const targeted = smokeSpecs.length * SMOKE_SPEC_MINUTES + e2eSpecs.length * E2E_SPEC_MINUTES
  const saved = FULL_SUITE_PARALLEL_MINUTES - targeted

  return {
    fullSuiteMinutes: FULL_SUITE_PARALLEL_MINUTES,
    targetedMinutes: Math.round(targeted),
    savedMinutes: Math.round(Math.max(0, saved)),
    savedPercent: Math.round(Math.max(0, (saved / FULL_SUITE_PARALLEL_MINUTES) * 100)),
  }
}

function fallbackMessage(
  reason: Strategy,
  domains: FeatureDomain[],
  unmapped: string[],
  changed: string[]
): string {
  switch (reason) {
    case 'blast-radius':
      return `${domains.length} domains touched (threshold: ${BLAST_RADIUS_THRESHOLD}) — running full smoke suite`
    case 'smoke-full':
      return `${unmapped.length}/${changed.length} files unmapped (${Math.round((unmapped.length / changed.length) * 100)}%) — running full smoke suite`
    case 'no-mapping':
      return 'No file-to-domain matches found — running full smoke suite'
    default:
      return 'Fallback triggered'
  }
}

function buildFallback(
  reason: Strategy,
  changedFiles: string[],
  triggeredDomains: FeatureDomain[],
  unmappedFiles: string[]
): PickResult {
  const smokeSpecs = getAllSmokeSpecs()
  return {
    strategy: reason,
    domains: triggeredDomains,
    smokeSpecs,
    e2eSpecs: [],
    confidence: reason === 'no-mapping' ? 0 : 0.4,
    unmappedFiles,
    changedFiles,
    runtimeSaved: estimateRuntime(smokeSpecs, []),
    fallbackReason: fallbackMessage(reason, triggeredDomains, unmappedFiles, changedFiles),
    timestamp: new Date().toISOString(),
  }
}

export function pick(changedFiles: string[]): PickResult {
  if (changedFiles.length === 0) {
    return buildFallback('no-mapping', [], [], [])
  }

  const mappings: FileDomainMapping[] = changedFiles.map(file => ({
    file,
    domains: matchDomains(file),
  }))

  const unmappedFiles = mappings.filter(m => m.domains.length === 0).map(m => m.file)
  const triggeredDomains = unique(mappings.flatMap(m => m.domains))

  if (triggeredDomains.length === 0) {
    return buildFallback('no-mapping', changedFiles, [], unmappedFiles)
  }

  if (triggeredDomains.length >= BLAST_RADIUS_THRESHOLD) {
    return buildFallback('blast-radius', changedFiles, triggeredDomains, unmappedFiles)
  }

  const confidence = calculateConfidence(changedFiles, unmappedFiles, triggeredDomains)

  if (confidence < CONFIDENCE_THRESHOLD && unmappedFiles.length > changedFiles.length * 0.5) {
    return buildFallback('smoke-full', changedFiles, triggeredDomains, unmappedFiles)
  }

  const smokeSpecs = unique(triggeredDomains.flatMap(d => d.smokeSpecs))
  const e2eSpecs = unique(triggeredDomains.flatMap(d => d.e2eSpecs))

  return {
    strategy: 'targeted',
    domains: triggeredDomains,
    smokeSpecs,
    e2eSpecs,
    confidence,
    unmappedFiles,
    changedFiles,
    runtimeSaved: estimateRuntime(smokeSpecs, e2eSpecs),
    fallbackReason: null,
    timestamp: new Date().toISOString(),
  }
}

export function analyzeReleaseWindow(
  changedFilesAcrossPRs: string[],
  mergedPRs: number,
  windowDays: number
): ReleaseWindow {
  const deduped = unique(changedFilesAcrossPRs)
  const result = pick(deduped)

  const domainFrequency = new Map<string, number>()
  changedFilesAcrossPRs.forEach(file => {
    matchDomains(file).forEach(d => {
      domainFrequency.set(d.id, (domainFrequency.get(d.id) ?? 0) + 1)
    })
  })

  const riskWeights: Record<string, number> = { critical: 3, high: 2, medium: 1 }
  let concentrationScore = 0
  FEATURE_DOMAINS.forEach(domain => {
    const count = domainFrequency.get(domain.id) ?? 0
    concentrationScore += count * riskWeights[domain.riskLevel]
  })

  const highRiskDomains = result.domains.filter(
    d => d.riskLevel === 'critical' || d.riskLevel === 'high'
  )

  let recommendation: ReleaseWindow['recommendation']
  if (concentrationScore > 50 || highRiskDomains.length >= 3) {
    recommendation = 'full-suite'
  } else if (concentrationScore > 20 || highRiskDomains.length >= 2) {
    recommendation = 'extended-validation'
  } else {
    recommendation = 'targeted'
  }

  const now = new Date()
  return {
    startDate: new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000),
    endDate: now,
    mergedPRs,
    changedFiles: deduped,
    domains: result.domains,
    concentrationScore,
    highRiskDomains,
    recommendation,
  }
}

export function formatResult(result: PickResult): string {
  const lines: string[] = []
  const { strategy, domains, smokeSpecs, e2eSpecs, confidence, runtimeSaved, fallbackReason } = result
  const unmappedSet = new Set(result.unmappedFiles)

  lines.push(`\n╔══════════════════════════════════════════════════════╗`)
  lines.push(`  Smart Test Picker — ${new Date(result.timestamp).toLocaleString()}`)
  lines.push(`╚══════════════════════════════════════════════════════╝\n`)
  lines.push(`  Strategy   : ${strategy.toUpperCase()}`)
  lines.push(`  Confidence : ${(confidence * 100).toFixed(0)}%`)

  if (fallbackReason) {
    lines.push(`  Fallback   : ${fallbackReason}`)
  }

  lines.push(`\n  Changed files (${result.changedFiles.length}):`)
  result.changedFiles.forEach(f => {
    const domainNames = matchDomains(f).map(d => d.name).join(', ') || 'unmapped'
    lines.push(`    ${unmappedSet.has(f) ? '⚠' : '✓'} ${f}  →  ${domainNames}`)
  })

  if (domains.length > 0) {
    lines.push(`\n  Triggered domains (${domains.length}):`)
    domains.forEach(d => {
      const badge = d.riskLevel === 'critical' ? '🔴' : d.riskLevel === 'high' ? '🟠' : '🟡'
      lines.push(`    ${badge} ${d.name} [${d.riskLevel}]`)
    })
  }

  lines.push(`\n  Test plan:`)
  lines.push(`    Smoke : ${smokeSpecs.length} specs`)
  smokeSpecs.forEach(s => lines.push(`      · ${s}`))

  if (e2eSpecs.length > 0 && strategy === 'targeted') {
    lines.push(`    E2E   : ${e2eSpecs.length} specs`)
    e2eSpecs.forEach(s => lines.push(`      · ${s}`))
  }

  lines.push(`\n  Runtime savings:`)
  lines.push(`    Full suite  : ~${runtimeSaved.fullSuiteMinutes} min`)
  lines.push(`    This run    : ~${runtimeSaved.targetedMinutes} min`)
  lines.push(`    Saved       : ~${runtimeSaved.savedMinutes} min (${runtimeSaved.savedPercent}% faster)\n`)

  return lines.join('\n')
}
