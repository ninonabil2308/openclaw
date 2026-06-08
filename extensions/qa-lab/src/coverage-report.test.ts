// Qa Lab tests cover coverage report plugin behavior.
import { describe, expect, it } from "vitest";
import { buildQaCoverageInventory, renderQaCoverageMarkdownReport } from "./coverage-report.js";
import { readQaScenarioPack } from "./scenario-catalog.js";
import { buildQaScorecardTaxonomyReport, parseQaScorecardTaxonomy } from "./scorecard-taxonomy.js";

function testScorecardProfiles(categoryId = "runtime.test", profileId = "release") {
  return [
    {
      id: "smoke-ci",
      description: "Test smoke profile.",
      categoryIds: profileId === "smoke-ci" ? [categoryId] : [],
      lanes: [],
    },
    {
      id: "release",
      description: "Test release profile.",
      categoryIds: profileId === "release" ? [categoryId] : [],
      lanes: [],
    },
  ];
}

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
    expect(inventory.scorecardTaxonomy.profileCount).toBe(2);
    expect(inventory.scorecardTaxonomy.categoryCount).toBe(16);
    expect(inventory.scorecardTaxonomy.ltsIncludedCategoryCount).toBe(7);
    expect(inventory.scorecardTaxonomy.deferredCategoryCount).toBe(8);
    expect(inventory.scorecardTaxonomy.advisoryCategoryCount).toBe(1);
    expect(inventory.scorecardTaxonomy.releaseBlockingCategoryCount).toBe(7);
    expect(inventory.scorecardTaxonomy.mappedCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.mappedScenarioCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.unmappedCoverageIdCount).toBeGreaterThan(0);
    expect(inventory.scorecardTaxonomy.validationIssues).toStrictEqual([]);
    expect(
      inventory.scorecardTaxonomy.profiles
        .find((profile) => profile.id === "release")
        ?.categoryIds.toSorted(),
    ).toEqual([
      "automation.cron",
      "media.input",
      "media.output",
      "memory.failure",
      "memory.recall",
      "plugins.runtime",
      "providers.openai",
      "runtime.agent.turns",
      "runtime.context.compaction",
      "runtime.observability.trace",
      "runtime.tools.approval",
      "runtime.tools.core",
      "security.secrets",
      "ui.control",
    ]);
    expect(
      inventory.scorecardTaxonomy.categories.find(
        (category) => category.id === "plugins.external.compat",
      )?.profiles,
    ).toStrictEqual([]);
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
    expect(report).toContain("- Profiles: 2");
    expect(report).toContain(
      "- smoke-ci: 14 categories; lanes: qa-lab-smoke-ci, openclaw-multipass-channel-smoke;",
    );
    expect(report).toContain(
      "- runtime.tools.core (lts-included, release-blocking, mapped): profiles: release, smoke-ci; coverage: tools.apply-patch, tools.exec, tools.fs.read, tools.fs.write, tools.web-search;",
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
      profiles: testScorecardProfiles(),
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
            profiles: ["release"],
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

  it("reports release-blocking categories missing release profile membership", () => {
    const taxonomy = parseQaScorecardTaxonomy({
      version: 1,
      id: "test-taxonomy",
      title: "Test taxonomy",
      sourceRef: "docs/concepts/qa-e2e-automation.md",
      status: "initial",
      mappingAuthority: "scaffold",
      mappingOwner: "@kevinlin-openai",
      reportOnly: true,
      profiles: testScorecardProfiles("runtime.test", "smoke-ci"),
      categories: [
        {
          id: "runtime.test",
          surfaceId: "runtime.gateway",
          surfaceName: "Runtime",
          categoryName: "Release profile missing",
          supportStatus: "lts-included",
          releaseBlocking: true,
          requirement: "Release-blocking rows must be selected by the release profile.",
          evidenceRequired: "Release profile membership before promotion.",
          evidence: {
            profiles: ["smoke-ci"],
            liveProofRequired: false,
            freshness: "target-ref",
            coverageIds: ["channels.dm"],
            scenarioRefs: ["qa/scenarios/channels/dm-chat-baseline.md"],
            docsRefs: ["docs/concepts/qa-e2e-automation.md"],
            codeRefs: ["extensions/qa-lab/src/suite.ts"],
          },
        },
      ],
    });

    const report = buildQaScorecardTaxonomyReport({
      taxonomy,
      repoRoot: process.cwd(),
      scenarios: readQaScenarioPack().scenarios,
    });

    expect(report.validationIssues.map((issue) => issue.code)).toEqual([
      "release-blocking-category-missing-release-profile",
    ]);
  });

  it("reports advisory categories that are accidentally assigned to a runnable profile", () => {
    const taxonomy = parseQaScorecardTaxonomy({
      version: 1,
      id: "test-taxonomy",
      title: "Test taxonomy",
      sourceRef: "docs/concepts/qa-e2e-automation.md",
      status: "initial",
      mappingAuthority: "scaffold",
      mappingOwner: "@kevinlin-openai",
      reportOnly: true,
      profiles: testScorecardProfiles("plugins.external.compat", "smoke-ci"),
      categories: [
        {
          id: "plugins.external.compat",
          surfaceId: "plugins",
          surfaceName: "Plugins",
          categoryName: "External plugin compatibility",
          supportStatus: "advisory",
          releaseBlocking: false,
          requirement: "Keep advisory compatibility out of runnable profiles.",
          evidenceRequired: "Advisory report metadata only.",
          evidence: {
            profiles: [],
            liveProofRequired: false,
            freshness: "latest-advisory-run",
            coverageIds: [],
            scenarioRefs: [],
            docsRefs: ["docs/plugins/architecture.md"],
            codeRefs: [],
          },
        },
      ],
    });

    const report = buildQaScorecardTaxonomyReport({
      taxonomy,
      repoRoot: process.cwd(),
      scenarios: readQaScenarioPack().scenarios,
    });

    expect(report.validationIssues.map((issue) => issue.code)).toEqual([
      "profile-membership-missing-category-profile",
      "advisory-category-has-profile-membership",
    ]);
  });

  it("reports non-advisory categories with no runnable profile membership", () => {
    const taxonomy = parseQaScorecardTaxonomy({
      version: 1,
      id: "test-taxonomy",
      title: "Test taxonomy",
      sourceRef: "docs/concepts/qa-e2e-automation.md",
      status: "initial",
      mappingAuthority: "scaffold",
      mappingOwner: "@kevinlin-openai",
      reportOnly: true,
      profiles: testScorecardProfiles("runtime.test", "none"),
      categories: [
        {
          id: "runtime.test",
          surfaceId: "runtime.gateway",
          surfaceName: "Runtime",
          categoryName: "Missing runnable profile",
          supportStatus: "deferred",
          releaseBlocking: false,
          requirement: "Non-advisory rows must stay visible to runnable profiles.",
          evidenceRequired: "At least one smoke-ci or release membership before promotion.",
          evidence: {
            profiles: [],
            liveProofRequired: false,
            freshness: "target-ref",
            coverageIds: ["channels.dm"],
            scenarioRefs: ["qa/scenarios/channels/dm-chat-baseline.md"],
            docsRefs: ["docs/concepts/qa-e2e-automation.md"],
            codeRefs: ["extensions/qa-lab/src/suite.ts"],
          },
        },
      ],
    });

    const report = buildQaScorecardTaxonomyReport({
      taxonomy,
      repoRoot: process.cwd(),
      scenarios: readQaScenarioPack().scenarios,
    });

    expect(report.validationIssues.map((issue) => issue.code)).toEqual([
      "non-advisory-category-missing-profile-membership",
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
        profiles: testScorecardProfiles("runtime.test", "smoke-ci"),
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
              profiles: ["smoke-ci"],
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
