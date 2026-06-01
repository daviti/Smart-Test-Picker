import { Zap, Github } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100 leading-none">Smart Test Picker</h1>
            <p className="text-xs text-slate-500 mt-0.5">QA · AI · Automation · Release Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow"></span>
            <span>Picker engine active</span>
          </div>
          <a
            href="https://github.com/davidortiz/smart-test-picker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  )
}
