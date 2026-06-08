// Qa Lab tests cover coverage report plugin behavior.
import { describe, expect, it } from "vitest";
import { buildQaCoverageInventory, renderQaCoverageMarkdownReport } from "./coverage-report.js";
import { readQaScenarioPack } from "./scenario-catalog.js";
import { buildQaScorecardTaxonomyReport, parseQaScorecardTaxonomy } from "./scorecard-taxonomy.js";

describe("qa coverage report", () => {
  it("groups scenario coverage metadata by theme and surface", () => {
    const inventory = buildQaCoverageInventory(readQaScenarioPack().scenarios);

    expect(inventory.scenarioCount).toBeGreaterThan(0);
    expect(inventory.coverageIdCount).toBeGreaterThan(0);
    expect(inventory.primaryCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.secondaryCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.overlappingCoverage.length).toBeGreaterThan(0);
    expect(inventory.missingCoverage).toStrictEqual([]);
    expect(inventory.liveTransportLanes.map((lane) => lane.transportId)).toEqual([
      "discord",
      "slack",
      "telegram",
      "whatsapp",
    ]);
    expect(inventory.scorecardTaxonomy.taxonomyId).toBe("stable-lts-initial");
    expect(inventory.scorecardTaxonomy.reportOnly).toBe(true);
    expect(inventory.scorecardTaxonomy.categoryCount).toBe(16);
    expect(inventory.scorecardTaxonomy.ltsIncludedCategoryCount).toBe(7);
    expect(inventory.scorecardTaxonomy.deferredCategoryCount).toBe(8);
    expect(inventory.scorecardTaxonomy.advisoryCategoryCount).toBe(1);
    expect(inventory.scorecardTaxonomy.releaseBlockingCategoryCount).toBe(7);
    expect(inventory.scorecardTaxonomy.mappedCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.mappedScenarioCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.unmappedCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.validationIssues).toStrictEqual([]);
    expect(inventory.scenarioPacks.map((pack) => pack.id)).toEqual([
      "observability",
      "personal-agent",
    ]);
    const personalPack = inventory.scenarioPacks.find((pack) => pack.id === "personal-agent");
    const observabilityPack = inventory.scenarioPacks.find((pack) => pack.id === "observability");
    expect(personalPack?.missingScenarioIds).toStrictEqual([]);
    expect(personalPack?.scenarioIds).toContain("personal-share-safe-diagnostics-artifact");
    expect(personalPack?.coverageIds).toContain("personal.redaction");
    expect(personalPack?.coverageIds).toContain("qa.artifact-safety");
    expect(observabilityPack?.missingScenarioIds).toStrictEqual([]);
    expect(observabilityPack?.scenarioIds).toEqual(["otel-trace-smoke", "docker-prometheus-smoke"]);
    expect(observabilityPack?.coverageIds).toContain("telemetry.otel");
    expect(observabilityPack?.coverageIds).toContain("telemetry.prometheus");
    expect(inventory.byTheme.memory.map((feature) => feature.id)).toContain("memory.recall");
    expect(inventory.bySurface.memory.map((feature) => feature.id)).toContain("memory.recall");
  });

  it("renders a compact markdown inventory", () => {
    const report = renderQaCoverageMarkdownReport(
      buildQaCoverageInventory(readQaScenarioPack().scenarios),
    );

    expect(report).toContain("# QA Coverage Inventory");
    expect(report).toContain("- Missing coverage metadata: 0");
    expect(report).toContain("- Overlapping coverage IDs:");
    expect(report).toContain("memory.recall");
    expect(report).toContain("primary: memory-recall (qa/scenarios/memory/memory-recall.md)");
    expect(report).toContain("secondary: active-memory-preprompt-recall");
    expect(report).toContain("## Scenario Packs");
    expect(report).toContain(
      "- personal-agent (Personal Agent Benchmark Pack): 10 scenarios; coverage:",
    );
    expect(report).toContain("- observability (Observability Smoke Pack): 2 scenarios; coverage:");
    expect(report).toContain("otel-trace-smoke, docker-prometheus-smoke");
    expect(report).toContain("personal-share-safe-diagnostics-artifact");
    expect(report).toContain("## Live Transport Lanes");
    expect(report).toContain(
      "- telegram (telegram): canary: always-on, help-command: telegram-help-command, mention-gating: telegram-mention-gating; missing baseline: allowlist-block, top-level-reply-shape, restart-resume",
    );
    expect(report).toContain("thread-follow-up: slack-thread-follow-up");
    expect(report).toContain("## Scorecard Taxonomy");
    expect(report).toContain("- Taxonomy: stable-lts-initial (report-only)");
    expect(report).toContain("- Categories: 16 (7 LTS-included, 8 deferred, 1 advisory)");
    expect(report).toContain(
      "- runtime.tools.core (lts-included, release-blocking, mapped): coverage: tools.apply-patch, tools.exec, tools.fs.read, tools.fs.write, tools.web-search;",
    );
    expect(report).toContain("### Unmapped Coverage IDs");
    expect(report).toContain("agents.subagents");
  });

  it("reports taxonomy mapping gaps without making closure blocking", () => {
    const taxonomy = parseQaScorecardTaxonomy({
      version: 1,
      id: "test-taxonomy",
      title: "Test taxonomy",
      sourceRef: "docs/concepts/qa-e2e-automation.md",
      status: "initial",
      mappingAuthority: "scaffold",
      mappingOwner: "@kevinlin-openai",
      reportOnly: true,
      categories: [
        {
          id: "runtime.test",
          surfaceId: "runtime.gateway",
          surfaceName: "Runtime",
          categoryName: "Missing test mapping",
          supportStatus: "lts-included",
          releaseBlocking: true,
          requirement: "Exercise a missing mapping.",
          evidenceRequired: "A real scenario mapping before promotion.",
          evidence: {
            requiredTiers: ["core"],
            liveProofRequired: false,
            freshness: "target-ref",
            coverageIds: ["runtime.missing-coverage"],
            scenarioRefs: ["qa/scenarios/runtime/missing-scorecard-scenario.md"],
            docsRefs: ["docs/missing-scorecard-doc.md"],
            codeRefs: ["src/missing-scorecard-code.ts"],
          },
        },
      ],
    });

    const report = buildQaScorecardTaxonomyReport({
      taxonomy,
      repoRoot: process.cwd(),
      scenarios: readQaScenarioPack().scenarios,
    });

    expect(report.reportOnly).toBe(true);
    expect(report.categories[0]?.mappingStatus).toBe("partial");
    expect(report.validationIssues.map((issue) => issue.code)).toEqual([
      "coverage-id-not-found",
      "scenario-ref-not-found",
      "docs-ref-not-found",
      "code-ref-not-found",
    ]);
  });

  it("rejects taxonomy refs outside the repository", () => {
    expect(() =>
      parseQaScorecardTaxonomy({
        version: 1,
        id: "bad-taxonomy",
        title: "Bad taxonomy",
        sourceRef: "../rfcs/rfcs/0007-e2e-qa-lab-scorecard-consolidation.md",
        status: "initial",
        mappingAuthority: "scaffold",
        mappingOwner: "@kevinlin-openai",
        reportOnly: true,
        categories: [
          {
            id: "runtime.test",
            surfaceId: "runtime.gateway",
            surfaceName: "Runtime",
            categoryName: "Bad docs ref",
            supportStatus: "deferred",
            releaseBlocking: false,
            requirement: "Reject escaped refs.",
            evidenceRequired: "Parser rejects refs outside the repository.",
            evidence: {
              requiredTiers: ["core"],
              liveProofRequired: false,
              freshness: "target-ref",
              coverageIds: ["runtime.delivery"],
              scenarioRefs: ["qa/scenarios/channels/dm-chat-baseline.md"],
              docsRefs: ["/tmp/outside-openclaw.md"],
              codeRefs: ["src/agents/../agents/agent-tools.ts"],
            },
          },
        ],
      }),
    ).toThrow("repo refs must not be absolute or contain parent-directory segments");
  });
});
