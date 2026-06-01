import { CheckCircle2, Copy, FlaskConical, Layers } from 'lucide-react'
import { useState } from 'react'
import type { PickResult } from '@core/types'

interface TestPlanProps {
  result: PickResult | null
}

function SpecList({ title, specs, color }: { title: string; specs: string[]; color: string }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</span>
        <span className="text-xs text-slate-600">{specs.length} specs</span>
        <span className="ml-auto text-slate-600 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <ul className="space-y-1 animate-fade-in">
          {specs.map(spec => (
            <li key={spec} className="flex items-center gap-2 text-xs text-slate-400 pl-2">
              <CheckCircle2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
              <span className="font-mono text-slate-500 truncate">{spec}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TestPlan({ result }: TestPlanProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const totalTests = (result?.smokeSpecs.length ?? 0) + (result?.e2eSpecs.length ?? 0)

  return (
    <div className="card flex flex-col gap-4 min-h-[420px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">Test Plan</span>
        </div>
        {result && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        )}
      </div>

      {result ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-100">{result.smokeSpecs.length}</div>
              <div className="text-xs text-slate-500 mt-1">Smoke</div>
            </div>
            <div className="bg-slate-950 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-100">{result.e2eSpecs.length}</div>
              <div className="text-xs text-slate-500 mt-1">E2E</div>
            </div>
            <div className="bg-slate-950 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-100">{totalTests}</div>
              <div className="text-xs text-slate-500 mt-1">Total</div>
            </div>
          </div>

          {/* Runtime savings */}
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Runtime Savings</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-slate-400 line-through">
                  {result.runtimeSaved.fullSuiteMinutes}m
                </div>
                <div className="text-xs text-slate-600">Full suite</div>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-400">
                  {result.runtimeSaved.targetedMinutes}m
                </div>
                <div className="text-xs text-slate-600">This run</div>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-300">
                  -{result.runtimeSaved.savedPercent}%
                </div>
                <div className="text-xs text-slate-600">Faster</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${100 - result.runtimeSaved.savedPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>0</span>
              <span className="text-emerald-600">saved {result.runtimeSaved.savedMinutes} min</span>
              <span>{result.runtimeSaved.fullSuiteMinutes}m</span>
            </div>
          </div>

          {/* Spec lists */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {result.smokeSpecs.length > 0 && (
              <SpecList title="Smoke" specs={result.smokeSpecs} color="text-blue-400" />
            )}
            {result.e2eSpecs.length > 0 && result.strategy === 'targeted' && (
              <SpecList title="E2E" specs={result.e2eSpecs} color="text-purple-400" />
            )}
            {result.unmappedFiles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                  Unmapped files ({result.unmappedFiles.length})
                </p>
                <ul className="space-y-1">
                  {result.unmappedFiles.map(f => (
                    <li key={f} className="text-xs text-slate-600 pl-2 font-mono truncate">⚠ {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Test plan appears here<br />once files are detected
          </p>
        </div>
      )}
    </div>
  )
}
