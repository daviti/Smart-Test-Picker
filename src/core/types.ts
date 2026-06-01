export type RiskLevel = 'critical' | 'high' | 'medium'

export type Strategy =
  | 'targeted'        // confident match → run selected specs
  | 'smoke-full'      // low confidence → run all smoke specs
  | 'blast-radius'    // too many domains touched → run full suite
  | 'no-mapping'      // zero files matched → smoke-full fallback

export interface FeatureDomain {
  id: string
  name: string
  description: string
  riskLevel: RiskLevel
  icon: string
  filePatterns: RegExp[]
  smokeSpecs: string[]
  e2eSpecs: string[]
  avgRuntimeMinutes: { smoke: number; e2e: number }
}

export interface FileDomainMapping {
  file: string
  domains: FeatureDomain[]
}

export interface PickResult {
  strategy: Strategy
  domains: FeatureDomain[]
  smokeSpecs: string[]
  e2eSpecs: string[]
  confidence: number
  unmappedFiles: string[]
  changedFiles: string[]
  runtimeSaved: RuntimeEstimate
  fallbackReason: string | null
  timestamp: string
}

export interface RuntimeEstimate {
  fullSuiteMinutes: number
  targetedMinutes: number
  savedMinutes: number
  savedPercent: number
}

export interface PickOptions {
  dryRun?: boolean
  format?: 'json' | 'text'
  aiSuggest?: boolean
}

export interface ReleaseWindow {
  startDate: Date
  endDate: Date
  mergedPRs: number
  changedFiles: string[]
  domains: FeatureDomain[]
  concentrationScore: number
  highRiskDomains: FeatureDomain[]
  recommendation: 'targeted' | 'full-suite' | 'extended-validation'
}
