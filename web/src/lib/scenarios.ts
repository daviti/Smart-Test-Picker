export interface Scenario {
  id: string
  label: string
  description: string
  files: string[]
  expectedStrategy: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'auth-bug',
    label: 'Auth Bug Fix',
    description: 'Login flow broken — high confidence targeted run',
    files: [
      'src/auth/login.ts',
      'src/hooks/useAuth.ts',
      'src/context/AuthContext.tsx',
    ],
    expectedStrategy: 'targeted',
  },
  {
    id: 'payment-revamp',
    label: 'Payment Revamp',
    description: 'Stripe integration + auth changes — critical domains',
    files: [
      'src/billing/stripe.ts',
      'src/subscriptions/upgrade.ts',
      'src/auth/session.ts',
      'src/components/Billing/PlanSelector.tsx',
    ],
    expectedStrategy: 'targeted',
  },
  {
    id: 'cross-cutting',
    label: 'Config Change',
    description: 'Feature flags + global config — blast radius fallback',
    files: [
      'src/config/features.ts',
      'src/feature-flags/index.ts',
      'src/auth/login.ts',
      'src/billing/stripe.ts',
      'src/rbac/permissions.ts',
      'src/upload/chunked.ts',
      'src/floor-plan/canvas.ts',
    ],
    expectedStrategy: 'blast-radius',
  },
  {
    id: 'ui-polish',
    label: 'UI Polish Sprint',
    description: 'Styling + unmapped files — low confidence, smoke fallback',
    files: [
      'src/styles/globals.css',
      'src/components/Button.tsx',
      'src/utils/formatting.ts',
      'lib/unknown-module.ts',
    ],
    expectedStrategy: 'smoke-full',
  },
]
