export interface Scenario {
  id: string
  label: string
  description: string
  files: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'auth-bug',
    label: 'Auth Bug Fix',
    description: 'Login flow — high confidence targeted run',
    files: [
      'src/auth/login.ts',
      'src/hooks/useAuth.ts',
      'src/context/AuthContext.tsx',
    ],
  },
  {
    id: 'payment-revamp',
    label: 'Payment Revamp',
    description: 'Stripe + auth — critical domains triggered',
    files: [
      'src/billing/stripe.ts',
      'src/subscriptions/upgrade.ts',
      'src/auth/session.ts',
      'src/components/Billing/PlanSelector.tsx',
    ],
  },
  {
    id: 'cross-cutting',
    label: 'Config Change',
    description: 'Feature flags across many domains — blast-radius fallback',
    files: [
      'src/config/features.ts',
      'src/feature-flags/index.ts',
      'src/auth/login.ts',
      'src/billing/stripe.ts',
      'src/permissions/roles.ts',
      'src/upload/chunked.ts',
      'src/editor/toolbar.ts',
    ],
  },
  {
    id: 'ui-polish',
    label: 'UI Polish Sprint',
    description: 'Styling + unmapped files — smoke-full fallback',
    files: [
      'src/styles/globals.css',
      'src/components/Button.tsx',
      'src/utils/formatting.ts',
      'lib/unknown-module.ts',
    ],
  },
]
