---
summary: "How OpenClaw maturity tests connect release requirements to QA evidence, reruns, ownership, and troubleshooting"
read_when:
  - Understanding Stable or LTS release proof requirements
  - Adding or updating QA scorecard coverage
  - Mapping a product requirement to runnable OpenClaw QA evidence
title: "Maturity tests"
---

Maturity tests are the executable proof behind OpenClaw maturity categories. They connect product surfaces such as Gateway startup, provider behavior, channels, plugins, installation, upgrade, security, and docs to runnable QA evidence that this repo can explain, rerun, and troubleshoot.

Maturity test taxonomy and profile membership live in checked-in docs or taxonomy fixtures so CI, release validation, and scorecard reports read the same source of truth. The scorecard mapping joins each requirement to its profile, runnable lanes, expected artifacts, freshness rule, and troubleshooting path.

The scorecard is the product taxonomy and support-boundary view. It uses inventory-backed surfaces, scored categories, maturity levels `M0` through `M5`, and an LTS category slice. OpenClaw stores the executable evidence behind those categories. A category appearing in the maturity scorecard or LTS support slice does not automatically make it a release-blocking gate; it becomes a gate when the OpenClaw taxonomy marks it blocking and maps it to runnable evidence.

## What OpenClaw owns

OpenClaw owns the executable side of maturity proof:

- checked-in taxonomy or coverage fixtures that CI can read
- profile membership, QA scenario metadata, coverage IDs, docs refs, and code refs
- summary artifacts from `qa suite`, live transport lanes, Docker/package lanes, Control UI runs, TUI lanes, and release workflows
- rerun commands and troubleshooting paths for release-blocking requirements
- scorecard reports that join taxonomy rows to fresh evidence

## Category shape

Each maturity category should be small enough that a maintainer can answer five questions without reading a full design note:

| Field            | Purpose                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Category ID      | Stable identifier such as `runtime.gateway.startup` or `channels.telegram.live`.                                                |
| Surface          | Product area the user experiences, such as Runtime and Gateway, Channels, Providers, Plugins, Install and upgrade, or Security. |
| Requirement      | Plain-language behavior that must hold for the category's claimed maturity level or support promise.                            |
| Blocking rule    | Whether the row blocks a release gate, is advisory, is part of an LTS support slice, or requires human review before promotion. |
| Evidence mapping | Profile membership, runnable coverage IDs, scenarios, lanes, artifact names, freshness rule, and required live proof.           |
| Troubleshooting  | First rerun command, likely failure owner, and the docs/code refs to inspect.                                                   |

Do not add a release-blocking row without a machine-readable evidence mapping. If the mapping is not ready, keep the row advisory or mark the missing mapping explicitly so the scorecard reports a gap instead of implying coverage.

## Evidence profiles

Profiles are the named taxonomy-owned selectors for runnable evidence sets. A profile maps maturity requirements, surfaces, and categories to the lanes that prove them. `--surface` and `--category` style filters narrow a selected profile; they are not a separate source of truth. CI should read profile membership from the checked-in taxonomy or docs instead of maintaining another list in workflow YAML.

The profile set is `smoke-ci` and `release`. Use `smoke-ci` for deterministic PR or merge proof and `release` for Stable/LTS blocking proof. Non-blocking evidence can appear as advisory report rows, but advisory is not a profile. Release-blocking Stable and LTS requirements have at least one fresh `release` profile evidence path. A `smoke-ci` profile can prove local behavior, but live provider or live channel claims still need live upstream evidence before a release can rely on them.

## Evidence summary fields

QA evidence should be joinable without parsing logs. Summary entries should carry these fields when the lane can provide them:

- scenario ID and coverage IDs
- scorecard surface and category IDs
- profile
- provider ID, model live mode, and provider fixture or auth profile
- channel ID or non-channel surface ID
- channel live mode
- runner substrate such as `host`, `docker`, `crabbox`, a release workflow, or an `openclaw/multipass` SDK-backed local channel shim
- package source, OpenClaw ref, OS, Node version, and artifact paths
- status, failure class, failure reason, and timing fields

Keep raw prompts, transcripts, credentials, and secret-bearing logs out of published scorecard artifacts. Link redacted reports or artifact manifests when more detail is needed.

## Finding existing coverage

Start with the coverage inventory when a requirement needs a runnable mapping:

```bash
pnpm openclaw qa coverage --match <surface-or-coverage-id>
pnpm openclaw qa coverage --json --match <surface-or-coverage-id>
```

The inventory searches scenario IDs, titles, surfaces, coverage IDs, docs refs, code refs, plugins, and provider requirements. Use it to find candidate scenarios, then choose the right substrate for the requirement:

| Requirement type                                              | First proof to look for                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User-flow scenario with synthetic channel behavior            | `pnpm openclaw qa suite --scenario <id>`                                                                           |
| `openclaw/multipass` SDK-backed local channel behavior        | Taxonomy-mapped QA or plugin lane for the local channel shim; not Canonical Multipass VM execution.                |
| Matrix live transport behavior                                | Matrix QA lane named by the taxonomy row; see [Matrix QA](/concepts/qa-matrix).                                    |
| Telegram, Discord, Slack, or WhatsApp live transport behavior | `pnpm openclaw qa <channel>`                                                                                       |
| Package install, upgrade, or Docker release path              | Docker/package lanes in [Testing](/help/testing) and [Full release validation](/reference/full-release-validation) |
| Normal source e2e behavior                                    | `pnpm test:e2e` or the focused Vitest target named by the coverage row                                             |

The final scorecard mapping should store the profile and runnable lane, not just a prose description. If the command depends on release artifacts or live credentials, name that prerequisite in the row.

## Adding a requirement

When adding or changing a maturity category:

1. Pick the smallest stable category ID.
2. Define the user-visible behavior and surface.
3. Choose `smoke-ci` or `release` profile membership, or leave the row advisory and non-blocking.
4. Map it to one or more coverage IDs and runnable lanes.
5. Add docs refs and code refs near the scenario or taxonomy row.
6. Add the rerun command and expected artifact path.
7. Record missing live proof or package proof as an explicit gap.

Avoid copying process-only checklists into docs. The docs explain the contract and maintenance path; the checked-in taxonomy holds the detailed machine-readable mapping.

## Troubleshooting a scorecard gap

When a row is missing, stale, or failing:

1. Confirm the row is still part of the current taxonomy.
2. Run `pnpm openclaw qa coverage --match <requirement-id>` to find current scenarios and code refs.
3. Rerun the smallest mapped lane and inspect its summary artifact.
4. Check whether the failure is product behavior, runner setup, live upstream outage, missing credentials, package artifact mismatch, or stale mapping.
5. If no lane exists, keep the row non-blocking or make the scorecard report the missing evidence explicitly.

Release-blocking live upstream failures should fail loudly. Waivers need a human release-owner decision and a preserved summary explaining why the failure is likely upstream rather than OpenClaw behavior.

## Related docs

- [QA overview](/concepts/qa-e2e-automation)
- [Testing](/help/testing)
- [Full release validation](/reference/full-release-validation)
- [Matrix QA](/concepts/qa-matrix)
- [QA channel](/channels/qa-channel)
