#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import minimist from 'minimist'
import { pick, analyzeReleaseWindow, formatResult } from './core/picker'
import { enrichUnmappedFiles } from './ai-suggest'

const argv = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help', 'ai'],
  string: ['diff-base', 'since', 'format', 'output'],
  alias: { h: 'help', d: 'dry-run', f: 'format' },
  default: { format: 'text', ai: true },
})

if (argv.help) {
  console.log(`
Smart Test Picker — AI-augmented test selector

Usage:
  smart-pick [options]

Options:
  --diff-base <branch>   Compare against branch (default: main)
  --since <duration>     Aggregate commits in window (e.g. 7d, 2w, 24h)
  --dry-run              Print plan without writing output files
  --format json|text     Output format (default: text)
  --output <path>        Write JSON result to file
  --ai                   Enable Claude Haiku suggestions for unmapped files
  --help                 Show this help

Examples:
  smart-pick --diff-base main
  smart-pick --since 7d --format json
  smart-pick --dry-run
  CHANGED_FILES="src/auth/login.ts,src/billing/stripe.ts" smart-pick
`)
  process.exit(0)
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(d|h|w)$/)
  if (!match) throw new Error(`Invalid duration: "${duration}". Use format: 7d, 24h, 2w`)
  const [, value, unit] = match
  const n = parseInt(value, 10)
  const multipliers: Record<string, number> = { h: 3_600_000, d: 86_400_000, w: 604_800_000 }
  return n * multipliers[unit]
}

function durationToDays(duration: string): number {
  const match = duration.match(/^(\d+)(d|h|w)$/)
  if (!match) return 7
  const [, value, unit] = match
  const n = parseInt(value, 10)
  if (unit === 'h') return Math.ceil(n / 24)
  if (unit === 'w') return n * 7
  return n
}

function getChangedFilesFromGitDiff(base = 'main'): string[] {
  try {
    const output = execSync(`git diff --name-only ${base}...HEAD`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.split('\n').map(l => l.trim()).filter(Boolean)
  } catch {
    console.warn(`⚠  git diff against "${base}" failed — falling back to staged files`)
    try {
      const output = execSync('git diff --name-only --cached', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return output.split('\n').map(l => l.trim()).filter(Boolean)
    } catch {
      console.warn('⚠  Could not read staged files either — no changed files detected')
      return []
    }
  }
}

async function getChangedFilesSince(
  duration: string
): Promise<{ files: string[]; commitCount: number }> {
  const ms = parseDuration(duration)
  const sinceDate = new Date(Date.now() - ms).toISOString()

  let commits: string[]
  try {
    commits = execSync(`git log --since="${sinceDate}" --format="%H"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
  } catch {
    console.warn('⚠  git log failed — no commits found')
    return { files: [], commitCount: 0 }
  }

  if (commits.length === 0) {
    return { files: [], commitCount: 0 }
  }

  const files = new Set<string>()
  for (const commit of commits) {
    try {
      execSync(`git diff-tree --no-commit-id -r --name-only ${commit}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .forEach(f => files.add(f))
    } catch {
      // individual bad commits are skipped
    }
  }

  return { files: [...files], commitCount: commits.length }
}

function writeOutput(outputPath: string, data: unknown): void {
  const resolved = path.resolve(outputPath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2))
}

async function main() {
  let changedFiles: string[] = []
  let commitCount = 0
  let isReleaseWindow = false

  if (process.env.CHANGED_FILES) {
    changedFiles = process.env.CHANGED_FILES.split(',').map(f => f.trim()).filter(Boolean)
    console.log(`📋 Reading from CHANGED_FILES env var: ${changedFiles.length} files`)
  } else if (argv.since) {
    isReleaseWindow = true
    const since = argv.since as string
    const result = await getChangedFilesSince(since)
    changedFiles = result.files
    commitCount = result.commitCount
    console.log(`🕐 Aggregating last ${since}: ${commitCount} commits, ${changedFiles.length} unique files`)
  } else {
    changedFiles = getChangedFilesFromGitDiff(argv['diff-base'] || 'main')
    console.log(`🔍 Changed files vs ${argv['diff-base'] || 'main'}: ${changedFiles.length} files`)
  }

  if (changedFiles.length === 0) {
    console.log('✅ No changed files detected. Nothing to pick.')
    process.exit(0)
  }

  const result = pick(changedFiles)

  if (argv.ai && result.unmappedFiles.length > 0) {
    console.log(`🤖 Asking Claude Haiku about ${result.unmappedFiles.length} unmapped files...`)
    const suggestions = await enrichUnmappedFiles(result.unmappedFiles)
    if (suggestions.size > 0) {
      console.log(`💡 AI suggestions for ${suggestions.size} files (informational only):`)
      suggestions.forEach((domains, file) => {
        console.log(`   ${file} → ${domains.join(', ')}`)
      })
    }
  }

  if (isReleaseWindow) {
    const windowDays = durationToDays(argv.since as string)
    const window = analyzeReleaseWindow(changedFiles, commitCount, windowDays)
    console.log(`\n📊 Release Intelligence (last ${argv.since}):`)
    console.log(`   Commits analyzed   : ${window.mergedPRs}`)
    console.log(`   Concentration score: ${window.concentrationScore}`)
    console.log(`   High-risk domains  : ${window.highRiskDomains.map(d => d.name).join(', ') || 'none'}`)
    console.log(`   Recommendation     : ${window.recommendation.toUpperCase()}`)
  }

  const isDryRun = argv['dry-run'] as boolean

  if (argv.format === 'json') {
    if (argv.output && !isDryRun) {
      writeOutput(argv.output as string, result)
      console.log(`\n📄 Output written to ${path.resolve(argv.output as string)}`)
    } else {
      console.log(JSON.stringify(result, null, 2))
    }
  } else {
    console.log(formatResult(result))
    if (argv.output && !isDryRun) {
      writeOutput(argv.output as string, result)
    }
  }

  process.exit(result.strategy === 'targeted' ? 0 : 2)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
