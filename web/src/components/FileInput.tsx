import { FileCode, X, Info } from 'lucide-react'

interface FileInputProps {
  value: string
  onChange: (v: string) => void
  fileCount: number
}

const PLACEHOLDER = `# Paste a git diff, git diff --name-only output,
# or just type file paths (one per line):

src/auth/login.ts
src/billing/stripe.ts
src/hooks/useAuth.ts`

export function FileInput({ value, onChange, fileCount }: FileInputProps) {
  return (
    <div className="card flex flex-col gap-3 min-h-[420px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">Changed Files</span>
        </div>
        <div className="flex items-center gap-2">
          {fileCount > 0 && (
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              {fileCount} file{fileCount !== 1 ? 's' : ''}
            </span>
          )}
          {value && (
            <button
              onClick={() => onChange('')}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        className="
          flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3
          text-xs text-slate-300 placeholder:text-slate-700
          font-mono resize-none focus:outline-none focus:border-blue-500/50
          transition-colors min-h-[320px]
        "
      />

      <div className="flex items-start gap-2 text-xs text-slate-600">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>Accepts <code className="text-slate-500">git diff</code>, <code className="text-slate-500">git diff --name-only</code>, or plain file paths. Updates in real-time.</span>
      </div>
    </div>
  )
}
