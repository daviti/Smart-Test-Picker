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

## The Problem

Every team eventually hits the same wall: the test suite grows, CI slows down, and engineers start making bad tradeoffs.

**Before this tool, the options were:**

| Approach | What breaks |
|---|---|
| Run everything on every PR | 3-hour CI queues. Engineers wait, context-switch, or stop waiting and ship blind |
| Skip CI on "small" PRs | One bad judgment call ships a regression to production |
| Manually curate test lists | Stale within a week. Nobody maintains them. Falls apart under deadline pressure |
| Split into unit + e2e tiers | Still runs every e2e test. Doesn't know which ones actually matter for this diff |

**The root cause:** there was no connection between *what changed in the code* and *which tests cover that area*. Every PR ran the same 200+ tests regardless of whether it touched authentication, a CSS file, or a billing webhook.

**What this fixes:**

1. **Test selection is now tied to what changed** — not to gut feel or a static list
2. **Risk levels drive urgency** — billing and auth changes get more tests than a button rename
3. **Fallbacks keep it safe** — if the tool is uncertain, it runs more tests, never fewer
4. **Release risk is measurable** — the `--since` flag tells you how much churn is accumulated before you cut a branch

---

## Try It Yourself

**Requirements:** Node.js 18+, npm 9+

```bash
git clone https://github.com/daviti/smart-test-picker
cd smart-test-picker
npm install
```

No API key required — the deterministic engine runs without one. Add `ANTHROPIC_API_KEY` to also get Claude Haiku suggestions for any unmapped files.

---

### All Script Commands

```bash
# ── Web demo ──────────────────────────────────────────────────────────────
npm run demo          # build + start interactive React demo at localhost:5173
npm run web           # start web dev server only (skip rebuild)

# ── CLI: compare against a branch ─────────────────────────────────────────
npm run smart-pick                                  # diff vs main
npm run smart-pick -- --diff-base develop           # diff vs develop
npm run smart-pick -- --no-ai                       # deterministic only, no API key needed

# ── CLI: pass files directly (no git needed) ──────────────────────────────
CHANGED_FILES="src/auth/login.ts,src/billing/stripe.ts" npm run smart-pick -- --no-ai

# ── CLI: dry run (print plan, write nothing) ──────────────────────────────
npm run smart-pick:dry

# ── CLI: output formats ───────────────────────────────────────────────────
npm run smart-pick -- --format json                              # JSON to stdout
npm run smart-pick -- --format json --output .smart-pick/plan.json  # JSON to file

# ── CLI: release intelligence ─────────────────────────────────────────────
npm run smart-pick:since -- 7d    # aggregate last 7 days
npm run smart-pick:since -- 2w    # aggregate last 2 weeks
npm run smart-pick:since -- 24h   # aggregate last 24 hours

# ── Build / quality ───────────────────────────────────────────────────────
npm run build         # TypeScript compile check
```

---

### Sample Runs

**Targeted run** — 2 auth files, single domain:

```bash
CHANGED_FILES="src/auth/login.ts,src/hooks/useAuth.ts" npm run smart-pick -- --no-ai
```

```
Strategy   : TARGETED
Confidence : 95%

Changed files (2):
  ✓ src/auth/login.ts       →  Authentication
  ✓ src/hooks/useAuth.ts    →  Authentication

Triggered domains (1):
  🔴 Authentication [critical]

Test plan:
  Smoke : 2 specs
    · e2e/auth/login.spec.ts
    · e2e/auth/session.spec.ts
  E2E   : 5 specs
    · e2e/auth/login.spec.ts  · e2e/auth/logout.spec.ts
    · e2e/auth/password-reset.spec.ts  · e2e/auth/sso.spec.ts

Runtime savings:
  Full suite  : ~80 min
  This run    : ~21 min
  Saved       : ~60 min (74% faster)
```

---

**Blast-radius fallback** — 6 files across 5+ domains:

```bash
CHANGED_FILES="src/billing/stripe.ts,src/auth/session.ts,src/permissions/roles.ts,src/config/features.ts,src/upload/chunked.ts,src/explore/search.ts" npm run smart-pick -- --no-ai
```

```
Strategy   : BLAST-RADIUS
Confidence : 40%
Fallback   : 5 domains touched (threshold: 5) — running full smoke suite

Triggered domains (5):
  🔴 Subscriptions & Billing [critical]
  🔴 Authentication [critical]
  🔴 Teams & Permissions [critical]
  🔴 Cross-cutting [critical]
  🟠 Uploads & Downloads [high]

Runtime savings:
  Full suite  : ~80 min
  This run    : ~32 min  (smoke only, no E2E)
  Saved       : ~49 min (61% faster)
```

---

**No-mapping fallback** — files that match no domain rule:

```bash
CHANGED_FILES="src/styles/globals.css,src/components/Button.tsx,src/utils/formatting.ts" npm run smart-pick -- --no-ai
```

```
Strategy   : NO-MAPPING
Confidence : 0%
Fallback   : No file-to-domain matches found — running full smoke suite

Changed files (3):
  ⚠ src/styles/globals.css      →  unmapped
  ⚠ src/components/Button.tsx   →  unmapped
  ⚠ src/utils/formatting.ts     →  unmapped
```

Add `ANTHROPIC_API_KEY=sk-...` and remove `--no-ai` to get Claude Haiku domain suggestions for these unmapped files.

---

### Exit Codes

| Code | Meaning | When |
|---|---|---|
| `0` | Targeted run selected | Normal PR, high confidence |
| `2` | Fallback triggered | Blast-radius, no-mapping, or low confidence |

These wire directly into GitHub Actions — exit `2` blocks the merge until the smoke gate passes.

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
│   │   ├── picker.ts          # Selection algorithm + release analysis
│   │   └── utils.ts           # Shared helpers (unique, etc.)
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
