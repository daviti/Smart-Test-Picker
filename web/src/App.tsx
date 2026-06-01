import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { ScenarioBar } from './components/ScenarioBar'
import { FileInput } from './components/FileInput'
import { DomainMap } from './components/DomainMap'
import { TestPlan } from './components/TestPlan'
import { parseChangedFiles } from './lib/parse-diff'
import { SCENARIOS } from './lib/scenarios'
import { pick } from '@core/picker'
import type { PickResult } from '@core/types'

export default function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<PickResult | null>(null)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)

  useEffect(() => {
    const files = parseChangedFiles(input)
    if (files.length === 0) {
      setResult(null)
      return
    }
    setResult(pick(files))
  }, [input])

  const handleScenarioSelect = useCallback((files: string[]) => {
    const scenarioText = files.join('\n')
    setInput(scenarioText)
    const match = SCENARIOS.find(s => s.files.join('\n') === scenarioText)
    setActiveScenarioId(match?.id ?? null)
  }, [])

  const handleInputChange = useCallback((v: string) => {
    setInput(v)
    setActiveScenarioId(null)
  }, [])

  const changedFiles = parseChangedFiles(input)

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <ScenarioBar onSelect={handleScenarioSelect} activeId={activeScenarioId} />

      <main className="max-w-7xl mx-auto px-6 pb-12">
        {/* Three-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <FileInput
            value={input}
            onChange={handleInputChange}
            fileCount={changedFiles.length}
          />
          <DomainMap result={result} />
          <TestPlan result={result} />
        </div>

        {/* Footer tagline */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-slate-600">
            Deterministic rule engine · Claude Haiku AI fallback · GitHub Actions ready
          </p>
          <p className="text-xs text-slate-700">
            Built by David Ortiz — QA Automation · AI Integration · Release Intelligence
          </p>
        </div>
      </main>
    </div>
  )
}
