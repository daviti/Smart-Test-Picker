import type { Scenario } from '../lib/scenarios'
import { SCENARIOS } from '../lib/scenarios'

interface ScenarioBarProps {
  onSelect: (scenario: Scenario) => void
  activeId: string | null
}

export function ScenarioBar({ onSelect, activeId }: ScenarioBarProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Try a scenario</p>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => onSelect(scenario)}
            className={`
              px-3 py-2 rounded-lg border text-xs transition-all
              ${activeId === scenario.id
                ? 'bg-blue-500/10 border-blue-500/50 text-blue-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }
            `}
          >
            <span className="font-medium">{scenario.label}</span>
            <span className="ml-2 text-slate-500 hidden sm:inline">{scenario.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
