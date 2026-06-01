import { Network, AlertTriangle } from 'lucide-react'
import type { PickResult } from '@core/types'
import { FEATURE_DOMAINS } from '@core/feature-mapping'

interface DomainMapProps {
  result: PickResult | null
}

const riskColors = {
  critical: { ring: 'ring-red-800', bg: 'bg-red-950/40', text: 'text-red-400', dot: 'bg-red-400', badge: 'badge-critical' },
  high:     { ring: 'ring-orange-800', bg: 'bg-orange-950/40', text: 'text-orange-400', dot: 'bg-orange-400', badge: 'badge-high' },
  medium:   { ring: 'ring-yellow-800', bg: 'bg-yellow-950/40', text: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'badge-medium' },
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Confidence</span>
        <span className={pct >= 70 ? 'text-emerald-400' : 'text-red-400'}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function DomainMap({ result }: DomainMapProps) {
  const triggeredIds = new Set(result?.domains.map(d => d.id) ?? [])

  return (
    <div className="card flex flex-col gap-4 min-h-[420px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">Domain Map</span>
        </div>
        {result && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            result.strategy === 'targeted'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : result.strategy === 'blast-radius'
              ? 'bg-red-950 text-red-400 border border-red-800'
              : 'bg-yellow-950 text-yellow-400 border border-yellow-800'
          }`}>
            {result.strategy.replace('-', ' ').toUpperCase()}
          </span>
        )}
      </div>

      {result && <ConfidenceMeter value={result.confidence} />}

      {result?.fallbackReason && (
        <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-3">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300">{result.fallbackReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 overflow-y-auto flex-1">
        {FEATURE_DOMAINS.map(domain => {
          const active = triggeredIds.has(domain.id)
          const colors = riskColors[domain.riskLevel]

          return (
            <div
              key={domain.id}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-200
                ${active
                  ? `ring-1 ${colors.ring} ${colors.bg} border-transparent`
                  : 'border-slate-800/50 opacity-30'
                }
              `}
            >
              <span className="text-base leading-none">{domain.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${active ? colors.text : 'text-slate-500'}`}>
                    {domain.name}
                  </span>
                  {active && (
                    <span className={colors.badge}>{domain.riskLevel}</span>
                  )}
                </div>
                {active && (
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{domain.description}</p>
                )}
              </div>
              {active && (
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
              )}
            </div>
          )
        })}
      </div>

      {!result && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Paste file paths or select a scenario<br />to see domain detection
          </p>
        </div>
      )}
    </div>
  )
}
