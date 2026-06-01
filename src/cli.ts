#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import minimist from 'minimist'
import { pick, analyzeReleaseWindow, formatResult } from './core/picker'
import { enrichUnmappedFiles } from './ai-suggest'
import { unique } from './core/utils'

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
  --since <duration>     Aggregate PRs merged in window (e.g. 7d, 30d)
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
  if (!match) throw new Error(`Invalid duration: ${duration}. Use format: 7d, 24h, 2w`)
  const [, value, unit] = match
  const ms = parseInt(value, 10)
  const multipliers: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000 }
  return ms * multipliers[unit]
}

function getChangedFilesFromGitDiff(base = 'main'): string[] {
  try {
    const output = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' })
    return output.split('\n').map(l => l.trim()).filter(Boolean)
  } catch {
    console.warn(`⚠  Could not run git diff against ${base}. Falling back to staged files.`)
    const output = execSync('git diff --name-only --cached', { encoding: 'utf8' })
    return output.split('\n').map(l => l.trim()).filter(Boolean)
  }
}

async function getChangedFilesSince(duration: string): Promise<{ files: string[]; mergedPRs: number }> {
  const ms = parseDuration(duration)
  const sinceDate = new Date(Date.now() - ms).toISOString()

  const commits = execSync(`git log --since="${sinceDate}" --format="%H"`, { encoding: 'utf8' })
    .split('\n').map(l => l.trim()).filter(Boolean)

  if (commits.length === 0) {
    return { files: [], mergedPRs: 0 }
  }

  const files = new Set<string>()
  for (const commit of commits) {
    try {
      const changed = execSync(`git diff-tree --no-commit-id -r --name-only ${commit}`, { encoding: 'utf8' })
      changed.split('\n').map(l => l.trim()).filter(Boolean).forEach(f => files.add(f))
    } catch {
      // skip bad commits
    }
  }

  return { files: [...files], mergedPRs: commits.length }
}

async function main() {
  let changedFiles: string[] = []
  let mergedPRs = 0
  let isReleaseWindow = false

  if (process.env.CHANGED_FILES) {
    changedFiles = process.env.CHANGED_FILES.split(',').map(f => f.trim()).filter(Boolean)
    console.log(`📋 Reading from CHANGED_FILES env var: ${changedFiles.length} files`)
  } else if (argv.since) {
    isReleaseWindow = true
    const result = await getChangedFilesSince(argv.since as string)
    changedFiles = result.files
    mergedPRs = result.mergedPRs
    console.log(`🕐 Aggregating last ${argv.since}: ${mergedPRs} commits, ${changedFiles.length} unique files`)
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
      console.log(`💡 AI suggestions received for ${suggestions.size} files (informational only)`)
      suggestions.forEach((domains, file) => {
        console.log(`   ${file} → ${domains.join(', ')}`)
      })
    }
  }

  if (isReleaseWindow) {
    const window = analyzeReleaseWindow(changedFiles, mergedPRs, parseInt(argv.since as string, 10))
    console.log(`\n📊 Release Intelligence (last ${argv.since}):`)
    console.log(`   PRs merged        : ${window.mergedPRs}`)
    console.log(`   Concentration score: ${window.concentrationScore}`)
    console.log(`   High-risk domains : ${window.highRiskDomains.map(d => d.name).join(', ') || 'none'}`)
    console.log(`   Recommendation    : ${window.recommendation.toUpperCase()}`)
  }

  if (argv.format === 'json') {
    const json = JSON.stringify(result, null, 2)
    if (argv.output) {
      const outputPath = path.resolve(argv.output as string)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, json)
      console.log(`\n📄 Output written to ${outputPath}`)
    } else {
      console.log(json)
    }
  } else {
    console.log(formatResult(result))
  }

  if (!argv['dry-run'] && argv.output && argv.format !== 'json') {
    const outputPath = path.resolve(argv.output as string)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  }

  process.exit(result.strategy === 'targeted' ? 0 : 2)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
