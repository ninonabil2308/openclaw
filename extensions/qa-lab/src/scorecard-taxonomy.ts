// Qa Lab plugin module validates the report-only scorecard taxonomy fixture.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { QaSeedScenarioWithSource } from "./scenario-catalog.js";

export const QA_SCORECARD_TAXONOMY_PATH = "qa/scorecard/stable-lts-taxonomy.json";

const qaScorecardIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, {
    message: "scorecard and coverage ids must use lowercase dotted or dashed tokens",
  });

function isRepoRootRelativeRef(value: string) {
  return !path.isAbsolute(value) && value.split(/[\\/]+/u).every((part) => part !== "..");
}

const qaScorecardRepoRefSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9._/-]+$/, {
    message: "repo refs must be repo-root relative paths",
  })
  .refine(isRepoRootRelativeRef, {
    message: "repo refs must not be absolute or contain parent-directory segments",
  });

const qaScorecardEvidenceTierSchema = z.enum([
  "core",
  "extended",
  "release",
  "soak",
  "manual",
  "advisory",
]);

const qaScorecardFreshnessRuleSchema = z.enum([
  "target-ref",
  "target-ref-and-release-package",
  "release-candidate",
  "latest-advisory-run",
]);

const qaScorecardSupportStatusSchema = z.enum(["lts-included", "deferred", "advisory"]);

const qaScorecardCategorySchema = z.object({
  id: qaScorecardIdSchema,
  surfaceId: qaScorecardIdSchema,
  surfaceName: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  supportStatus: qaScorecardSupportStatusSchema,
  releaseBlocking: z.boolean(),
  requirement: z.string().trim().min(1),
  evidenceRequired: z.string().trim().min(1),
  evidence: z.object({
    requiredTiers: z.array(qaScorecardEvidenceTierSchema).min(1),
    liveProofRequired: z.boolean(),
    freshness: qaScorecardFreshnessRuleSchema,
    coverageIds: z.array(qaScorecardIdSchema).default([]),
    scenarioRefs: z.array(qaScorecardRepoRefSchema).default([]),
    docsRefs: z.array(qaScorecardRepoRefSchema).default([]),
    codeRefs: z.array(qaScorecardRepoRefSchema).default([]),
    notes: z.string().trim().min(1).optional(),
  }),
});

const qaScorecardTaxonomySchema = z
  .object({
    version: z.literal(1),
    id: qaScorecardIdSchema,
    title: z.string().trim().min(1),
    sourceRef: qaScorecardRepoRefSchema,
    status: z.enum(["initial", "candidate", "active"]),
    mappingAuthority: z.enum(["scaffold", "authoritative"]),
    mappingOwner: z.string().trim().min(1),
    reportOnly: z.boolean(),
    notes: z.string().trim().min(1).optional(),
    categories: z.array(qaScorecardCategorySchema).min(1),
  })
  .superRefine((taxonomy, ctx) => {
    const seenCategoryIds = new Set<string>();
    for (const [categoryIndex, category] of taxonomy.categories.entries()) {
      if (seenCategoryIds.has(category.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories", categoryIndex, "id"],
          message: `duplicate scorecard category id: ${category.id}`,
        });
      }
      seenCategoryIds.add(category.id);

      if (category.supportStatus === "lts-included" && !category.releaseBlocking) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories", categoryIndex, "releaseBlocking"],
          message: `LTS-included category ${category.id} must be release-blocking`,
        });
      }
      if (category.supportStatus !== "lts-included" && category.releaseBlocking) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories", categoryIndex, "releaseBlocking"],
          message: `${category.supportStatus} category ${category.id} must not be release-blocking`,
        });
      }

      const seenCoverageIds = new Set<string>();
      for (const [coverageIndex, coverageId] of category.evidence.coverageIds.entries()) {
        if (seenCoverageIds.has(coverageId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["categories", categoryIndex, "evidence", "coverageIds", coverageIndex],
            message: `duplicate coverage id in category ${category.id}: ${coverageId}`,
          });
        }
        seenCoverageIds.add(coverageId);
      }
    }
  });

export type QaScorecardTaxonomy = z.infer<typeof qaScorecardTaxonomySchema>;
export type QaScorecardTaxonomyCategory = QaScorecardTaxonomy["categories"][number];

export type QaScorecardValidationIssueCode =
  | "coverage-id-not-found"
  | "scenario-ref-not-found"
  | "scenario-ref-not-covered-by-category"
  | "docs-ref-not-found"
  | "code-ref-not-found"
  | "source-ref-not-found"
  | "blocking-category-without-evidence-mapping"
  | "taxonomy-fixture-not-found";

export type QaScorecardValidationIssue = {
  code: QaScorecardValidationIssueCode;
  severity: "warning";
  categoryId?: string;
  ref?: string;
  message: string;
};

export type QaScorecardCategoryMappingReport = {
  id: string;
  surfaceId: string;
  categoryName: string;
  supportStatus: string;
  releaseBlocking: boolean;
  mappingStatus: "mapped" | "partial" | "missing";
  requiredTiers: string[];
  liveProofRequired: boolean;
  freshness: string;
  coverageIds: string[];
  scenarioRefs: string[];
  missingCoverageIds: string[];
  missingScenarioRefs: string[];
};

export type QaScorecardTaxonomyReport = {
  taxonomyPath: string | null;
  taxonomyId: string | null;
  title: string | null;
  status: string | null;
  mappingAuthority: string | null;
  mappingOwner: string | null;
  reportOnly: boolean;
  categoryCount: number;
  releaseBlockingCategoryCount: number;
  advisoryCategoryCount: number;
  ltsIncludedCategoryCount: number;
  deferredCategoryCount: number;
  mappedCoverageIdCount: number;
  mappedScenarioCount: number;
  unmappedCoverageIdCount: number;
  unmappedCoverageIds: string[];
  validationIssueCount: number;
  validationIssues: QaScorecardValidationIssue[];
  categories: QaScorecardCategoryMappingReport[];
};

function walkUpDirectories(start: string): string[] {
  const roots: string[] = [];
  let current = path.resolve(start);
  while (true) {
    roots.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      return roots;
    }
    current = parent;
  }
}

function resolveRepoPath(relativePath: string, kind: "file" | "directory" = "file") {
  for (const dir of walkUpDirectories(import.meta.dirname)) {
    const candidate = path.join(dir, relativePath);
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const stat = fs.statSync(candidate);
    if ((kind === "file" && stat.isFile()) || (kind === "directory" && stat.isDirectory())) {
      return candidate;
    }
  }
  return null;
}

function repoRootFromFixturePath(fixturePath: string) {
  return path.dirname(path.dirname(path.dirname(fixturePath)));
}

function formatZodIssuePath(pathLocal: PropertyKey[]) {
  return pathLocal.length ? pathLocal.map(String).join(".") : "<root>";
}

export function parseQaScorecardTaxonomy(value: unknown, label = QA_SCORECARD_TAXONOMY_PATH) {
  const parsed = qaScorecardTaxonomySchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  const issues = parsed.error.issues
    .map((issue) => `${formatZodIssuePath(issue.path)}: ${issue.message}`)
    .join("; ");
  throw new Error(`${label}: ${issues}`);
}

export function readQaScorecardTaxonomy(): QaScorecardTaxonomy | null {
  const taxonomyPath = resolveRepoPath(QA_SCORECARD_TAXONOMY_PATH, "file");
  if (!taxonomyPath) {
    return null;
  }
  return parseQaScorecardTaxonomy(
    JSON.parse(fs.readFileSync(taxonomyPath, "utf8")) as unknown,
    QA_SCORECARD_TAXONOMY_PATH,
  );
}

function scenarioCoverageIds(scenario: QaSeedScenarioWithSource) {
  return [...(scenario.coverage?.primary ?? []), ...(scenario.coverage?.secondary ?? [])];
}

function pathExists(repoRoot: string | undefined, relativePath: string) {
  if (!isRepoRootRelativeRef(relativePath)) {
    return false;
  }
  return repoRoot ? fs.existsSync(path.join(repoRoot, relativePath)) : true;
}

function reportMissingRepoRefs(params: {
  repoRoot: string | undefined;
  categoryId: string;
  refs: readonly string[];
  code: "docs-ref-not-found" | "code-ref-not-found";
  label: "docs" | "code";
  issues: QaScorecardValidationIssue[];
}) {
  for (const ref of params.refs) {
    if (pathExists(params.repoRoot, ref)) {
      continue;
    }
    params.issues.push({
      code: params.code,
      severity: "warning",
      categoryId: params.categoryId,
      ref,
      message: `${params.categoryId} references missing ${params.label} ref ${ref}`,
    });
  }
}

export function buildQaScorecardTaxonomyReport(params: {
  taxonomy: QaScorecardTaxonomy | null;
  taxonomyPath?: string | null;
  repoRoot?: string;
  scenarios: readonly QaSeedScenarioWithSource[];
}): QaScorecardTaxonomyReport {
  if (!params.taxonomy) {
    const issue = {
      code: "taxonomy-fixture-not-found",
      severity: "warning",
      ref: QA_SCORECARD_TAXONOMY_PATH,
      message: `Scorecard taxonomy fixture not found at ${QA_SCORECARD_TAXONOMY_PATH}`,
    } satisfies QaScorecardValidationIssue;
    return {
      taxonomyPath: params.taxonomyPath ?? null,
      taxonomyId: null,
      title: null,
      status: null,
      mappingAuthority: null,
      mappingOwner: null,
      reportOnly: true,
      categoryCount: 0,
      releaseBlockingCategoryCount: 0,
      advisoryCategoryCount: 0,
      ltsIncludedCategoryCount: 0,
      deferredCategoryCount: 0,
      mappedCoverageIdCount: 0,
      mappedScenarioCount: 0,
      unmappedCoverageIdCount: 0,
      unmappedCoverageIds: [],
      validationIssueCount: 1,
      validationIssues: [issue],
      categories: [],
    };
  }

  const coverageIdsByScenarioRef = new Map(
    params.scenarios.map((scenario) => [
      scenario.sourcePath,
      new Set(scenarioCoverageIds(scenario)),
    ]),
  );
  const scenarioRefsByCoverageId = new Map<string, Set<string>>();
  for (const scenario of params.scenarios) {
    for (const coverageId of scenarioCoverageIds(scenario)) {
      const refs = scenarioRefsByCoverageId.get(coverageId) ?? new Set<string>();
      refs.add(scenario.sourcePath);
      scenarioRefsByCoverageId.set(coverageId, refs);
    }
  }

  const issues: QaScorecardValidationIssue[] = [];
  const categories: QaScorecardCategoryMappingReport[] = [];
  const mappedCoverageIds = new Set<string>();
  const mappedScenarioRefs = new Set<string>();

  if (!pathExists(params.repoRoot, params.taxonomy.sourceRef)) {
    issues.push({
      code: "source-ref-not-found",
      severity: "warning",
      ref: params.taxonomy.sourceRef,
      message: `Scorecard taxonomy references missing source ref ${params.taxonomy.sourceRef}`,
    });
  }

  for (const category of params.taxonomy.categories) {
    const missingCoverageIds: string[] = [];
    const missingScenarioRefs: string[] = [];

    for (const coverageId of category.evidence.coverageIds) {
      const scenarioRefs = scenarioRefsByCoverageId.get(coverageId);
      if (!scenarioRefs) {
        missingCoverageIds.push(coverageId);
        issues.push({
          code: "coverage-id-not-found",
          severity: "warning",
          categoryId: category.id,
          ref: coverageId,
          message: `${category.id} maps missing coverage id ${coverageId}`,
        });
        continue;
      }
      mappedCoverageIds.add(coverageId);
      for (const scenarioRef of scenarioRefs) {
        mappedScenarioRefs.add(scenarioRef);
      }
    }

    const categoryCoverageIds = new Set(category.evidence.coverageIds);
    for (const scenarioRef of category.evidence.scenarioRefs) {
      const scenarioCoverage = coverageIdsByScenarioRef.get(scenarioRef);
      if (!scenarioCoverage) {
        missingScenarioRefs.push(scenarioRef);
        issues.push({
          code: "scenario-ref-not-found",
          severity: "warning",
          categoryId: category.id,
          ref: scenarioRef,
          message: `${category.id} references missing scenario ${scenarioRef}`,
        });
        continue;
      }
      mappedScenarioRefs.add(scenarioRef);
      if (
        categoryCoverageIds.size > 0 &&
        ![...scenarioCoverage].some((coverageId) => categoryCoverageIds.has(coverageId))
      ) {
        issues.push({
          code: "scenario-ref-not-covered-by-category",
          severity: "warning",
          categoryId: category.id,
          ref: scenarioRef,
          message: `${category.id} references ${scenarioRef} without one of the category coverage IDs`,
        });
      }
    }

    reportMissingRepoRefs({
      repoRoot: params.repoRoot,
      categoryId: category.id,
      refs: category.evidence.docsRefs,
      code: "docs-ref-not-found",
      label: "docs",
      issues,
    });
    reportMissingRepoRefs({
      repoRoot: params.repoRoot,
      categoryId: category.id,
      refs: category.evidence.codeRefs,
      code: "code-ref-not-found",
      label: "code",
      issues,
    });

    if (
      category.releaseBlocking &&
      category.evidence.coverageIds.length === 0 &&
      category.evidence.scenarioRefs.length === 0
    ) {
      issues.push({
        code: "blocking-category-without-evidence-mapping",
        severity: "warning",
        categoryId: category.id,
        message: `${category.id} is release-blocking but has no coverage IDs or scenario refs`,
      });
    }

    const mappingStatus =
      category.evidence.coverageIds.length === 0 && category.evidence.scenarioRefs.length === 0
        ? "missing"
        : missingCoverageIds.length > 0 || missingScenarioRefs.length > 0
          ? "partial"
          : "mapped";
    categories.push({
      id: category.id,
      surfaceId: category.surfaceId,
      categoryName: category.categoryName,
      supportStatus: category.supportStatus,
      releaseBlocking: category.releaseBlocking,
      mappingStatus,
      requiredTiers: [...category.evidence.requiredTiers],
      liveProofRequired: category.evidence.liveProofRequired,
      freshness: category.evidence.freshness,
      coverageIds: [...category.evidence.coverageIds],
      scenarioRefs: [...category.evidence.scenarioRefs],
      missingCoverageIds,
      missingScenarioRefs,
    });
  }

  const allCoverageIds = [...scenarioRefsByCoverageId.keys()].toSorted();
  const unmappedCoverageIds = allCoverageIds.filter(
    (coverageId) => !mappedCoverageIds.has(coverageId),
  );

  return {
    taxonomyPath: params.taxonomyPath ?? QA_SCORECARD_TAXONOMY_PATH,
    taxonomyId: params.taxonomy.id,
    title: params.taxonomy.title,
    status: params.taxonomy.status,
    mappingAuthority: params.taxonomy.mappingAuthority,
    mappingOwner: params.taxonomy.mappingOwner,
    reportOnly: params.taxonomy.reportOnly,
    categoryCount: params.taxonomy.categories.length,
    releaseBlockingCategoryCount: params.taxonomy.categories.filter(
      (category) => category.releaseBlocking,
    ).length,
    advisoryCategoryCount: params.taxonomy.categories.filter(
      (category) => category.supportStatus === "advisory",
    ).length,
    ltsIncludedCategoryCount: params.taxonomy.categories.filter(
      (category) => category.supportStatus === "lts-included",
    ).length,
    deferredCategoryCount: params.taxonomy.categories.filter(
      (category) => category.supportStatus === "deferred",
    ).length,
    mappedCoverageIdCount: mappedCoverageIds.size,
    mappedScenarioCount: mappedScenarioRefs.size,
    unmappedCoverageIdCount: unmappedCoverageIds.length,
    unmappedCoverageIds,
    validationIssueCount: issues.length,
    validationIssues: issues,
    categories: categories.toSorted((left, right) => left.id.localeCompare(right.id)),
  };
}

export function readQaScorecardTaxonomyReport(scenarios: readonly QaSeedScenarioWithSource[]) {
  const taxonomyPath = resolveRepoPath(QA_SCORECARD_TAXONOMY_PATH, "file");
  const taxonomy = readQaScorecardTaxonomy();
  return buildQaScorecardTaxonomyReport({
    taxonomy,
    taxonomyPath: taxonomyPath ? QA_SCORECARD_TAXONOMY_PATH : null,
    repoRoot: taxonomyPath ? repoRootFromFixturePath(taxonomyPath) : undefined,
    scenarios,
  });
}
