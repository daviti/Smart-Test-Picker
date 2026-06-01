# Smart Test Picker

**What engineering problems can I solve using QA, AI, automation, and release intelligence?**

This project is my answer. It takes a real, painful problem — every PR triggering 200+ tests and a 3-hour CI queue — and solves it by combining four disciplines:

| Discipline | What it contributes |
|---|---|
| **QA Engineering** | Risk-based test selection, 13 domain mappings, safety fallbacks |
| **AI (Claude Haiku)** | Suggests domains for files that match no rule |
| **Automation** | CLI tool + 3 GitHub Actions workflows with matrix parallelism |
| **Release Intelligence** | `--since` flag aggregates PRs over time windows, scores concentration risk |

**Result:** 10–30 tests selected per PR instead of 200+. CI drops from ~3h to 20–30 min. Nightly runs the full suite. Nothing is skipped permanently.

---

## Live Demo

```bash
git clone https://github.com/daviti/smart-test-picker
cd smart-test-picker
npm install
npm run demo        # starts the interactive web demo at localhost:5173
```

Or use the CLI directly:

```bash
# Compare against main branch
npm run smart-pick -- --diff-base main

# Dry run (print plan, don't write files)
npm run smart-pick:dry

# Release window analysis: aggregate all changes in last 7 days
npm run smart-pick:since -- 7d

# JSON output for CI consumption
npm run smart-pick -- --format json --output .smart-pick/plan.json
```

---

## How It Works

### 1. File → Domain Mapping (QA layer)

Every changed file is matched against 13 feature domains. Each domain has a risk level and an explicit list of test specs to run:

```
src/auth/login.ts          →  Authentication  [critical]  →  e2e/auth/login.spec.ts + 4 more
src/billing/stripe.ts      →  Subscriptions   [critical]  →  e2e/billing/subscribe.spec.ts + 4 more
src/components/Button.tsx  →  (unmapped)      →  AI layer
```

Domains: Auth, Subscriptions, Teams, Viewer, Library, Explore, Navigation, Onboarding, Account Settings, Uploads/Downloads, Cross-cutting

### 2. Picker Algorithm (deterministic, never flaky)

```
changedFiles
    │
    ▼
matchDomains()  ──── no matches ──────────► smoke-full fallback
    │
    ▼
triggeredDomains ─── ≥5 domains ─────────► blast-radius fallback
    │
    ▼
calculateConfidence()  ── < 0.7 + >50% unmapped ►  smoke-full fallback
    │
    ▼
strategy: "targeted"
  → smokeSpecs: union of all domain smoke specs
  → e2eSpecs:   union of all domain e2e specs
```

### 3. AI Layer (Claude Haiku, optional)

Files that match no rule are sent to Claude Haiku with the domain list. Suggestions are **informational only** — they never override the deterministic selection logic.

```bash
ANTHROPIC_API_KEY=sk-... npm run smart-pick
# ↳ 🤖 Asking Claude Haiku about 2 unmapped files...
# ↳ 💡 src/utils/formatting.ts → navigation, account
```

### 4. Release Intelligence (`--since` flag)

```bash
npm run smart-pick:since -- 7d
```

Aggregates all file changes across commits merged in the last 7 days. Computes a **concentration score** weighting each domain by risk level × PR frequency. Outputs a recommendation:

| Score | Recommendation |
|---|---|
| > 50 or ≥3 critical domains | `full-suite` |
| > 20 or ≥2 high-risk domains | `extended-validation` |
| Otherwise | `targeted` |

This is the pre-flight check before cutting a release branch.

---

## CI Architecture

```
PR opened / pushed
       │
       ▼
  ┌─────────────────────────────────────┐
  │  Job: pick                          │
  │  smart-test-picker --diff-base main │
  │  → outputs: smoke_specs, strategy   │
  └──────────────┬──────────────────────┘
                 │
       ┌─────────▼─────────┐
       │  Job: smoke-gate  │  ← required check, < 10 min
       │  8–12 smoke specs │
       └─────────┬─────────┘
                 │ (only if strategy=targeted)
       ┌─────────▼──────────────────────────┐
       │  Job: extended-validation (matrix) │  ← non-blocking, < 20 min
       │  1 runner per domain, parallel     │
       └────────────────────────────────────┘

Every night at 02:00 UTC:
  nightly-regression.yaml  →  full suite, picker bypassed, 4 shards
```

---

## Project Structure

```
smart-test-picker/
├── src/
│   ├── core/
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── feature-mapping.ts # 13 domain definitions + file patterns
│   │   └── picker.ts          # Selection algorithm + release analysis
│   ├── ai-suggest.ts          # Claude Haiku integration
│   └── cli.ts                 # CLI entry: --diff-base, --since, --format
├── web/                       # Interactive React demo (Vite + Tailwind)
│   └── src/
│       ├── App.tsx
│       ├── lib/parse-diff.ts  # Parses git diff or raw paths
│       └── components/
│           ├── FileInput.tsx  # Live file path input
│           ├── DomainMap.tsx  # Domain detection visualization
│           └── TestPlan.tsx   # Selected specs + runtime savings
├── .github/workflows/
│   ├── smart-test-ci.yaml          # PR: pick → smoke-gate → extended-validation
│   ├── nightly-regression.yaml     # Nightly: full suite, sharded
│   └── release-validation.yaml    # Manual: --since window + concentration scoring
└── docs/
    └── smart-test-picker.md        # Full reference documentation
```

---

## Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| PR runtime | < 30 min | Compare Testmo run durations |
| Mapping accuracy | > 90% | `smart-pick:dry` on recent PRs |
| Smoke gate pass rate | > 98% | GHA run history |
| Nightly coverage | 100% specs | nightly workflow history |
| Time saved / PR | > 50 min | Output from every picker run |

---

## Adding a New Domain

1. Add an entry to `src/core/feature-mapping.ts`
2. Define `filePatterns` (RegExp array), `smokeSpecs`, and `e2eSpecs`
3. Run `npm run smart-pick:dry` against a PR that touches those files to verify

That's it. No CI config changes needed — the matrix expands automatically.

---

*Built by David Ortiz — SR QA Automation Engineer*  
*Disciplines: test architecture · AI integration · CI/CD · release intelligence*
