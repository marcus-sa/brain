# Policy CRUD UI -- Test Scenario Inventory

## Summary

| Metric | Value |
|--------|-------|
| Total scenarios | 36 |
| Walking skeletons | 5 |
| Happy path scenarios | 10 |
| Error/edge scenarios | 21 |
| Error path ratio | 58% (target: 40%+) |
| User stories covered | 8/8 |

## Milestone 1: Authorization Gate + Policy List

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 1.1 | Agent denied policy creation | Error | US-PCUI-08 | skip |
| 1.2 | Agent denied policy activation | Error | US-PCUI-08 | skip |
| 1.3 | Agent denied policy deprecation | Error | US-PCUI-08 | skip |
| 1.4 | Agent denied version creation | Error | US-PCUI-08 | skip |
| 1.5 | Agent can read policy list | Happy | US-PCUI-08 | skip |
| 1.6 | Agent can read policy details | Happy | US-PCUI-08 | skip |
| 1.7 | Admin lists all workspace policies | **Skeleton** | US-PCUI-01 | skip |
| 1.8 | Status filter returns matching policies | Happy | US-PCUI-01 | skip |
| 1.9 | Empty workspace returns empty list | Edge | US-PCUI-01 | skip |
| 1.10 | Filter with no matches returns empty | Edge | US-PCUI-01 | skip |

## Milestone 2: Policy Creation + Validation

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 2.1 | Admin creates draft policy with deny rule | **Skeleton** | US-PCUI-02 | skip |
| 2.2 | Admin creates policy with multiple rules | Happy | US-PCUI-02 | skip |
| 2.3 | Admin creates policy with agent role selector | Happy | US-PCUI-02 | skip |
| 2.4 | Creation rejected without title | Error | US-PCUI-02 | skip |
| 2.5 | Creation rejected without rules | Error | US-PCUI-02 | skip |
| 2.6 | Creation rejected with invalid predicate | Error | US-PCUI-02 | skip |
| 2.7 | Creation rejected with invalid effect | Error | US-PCUI-02 | skip |

## Milestone 3: Policy Lifecycle (Activate + Deprecate)

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 3.1 | Admin activates draft, edges created | **Skeleton** | US-PCUI-04 | skip |
| 3.2 | Cannot activate already-active policy | Error | US-PCUI-04 | skip |
| 3.3 | Cannot activate deprecated policy | Error | US-PCUI-04 | skip |
| 3.4 | Cannot activate superseded policy | Error | US-PCUI-04 | skip |
| 3.5 | Admin deprecates active, edges removed | Happy | US-PCUI-04 | skip |
| 3.6 | Cannot deprecate draft policy | Error | US-PCUI-04 | skip |
| 3.7 | Cannot deprecate already-deprecated policy | Error | US-PCUI-04 | skip |

## Milestone 4: Policy Detail + Edges

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 4.1 | Admin views full policy details | **Skeleton** | US-PCUI-03 | skip |
| 4.2 | Active policy detail includes edges | Happy | US-PCUI-03 | skip |
| 4.3 | Deprecated policy shows empty edges | Edge | US-PCUI-03 | skip |
| 4.4 | Non-existent policy returns 404 | Error | US-PCUI-03 | skip |
| 4.5 | Version chain includes supersedes history | Happy | US-PCUI-07 | skip |
| 4.6 | Single version has one-element chain | Edge | US-PCUI-07 | skip |

## Milestone 5: Version Creation + Supersede

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 5.1 | Admin creates new version from active | **Skeleton** | US-PCUI-05 | skip |
| 5.2 | Cannot create version from draft | Error | US-PCUI-05 | skip |
| 5.3 | Cannot create version from deprecated | Error | US-PCUI-05 | skip |
| 5.4 | Activating new version supersedes old atomically | Happy | US-PCUI-05 | skip |
| 5.5 | Version history returns all versions ordered | Happy | US-PCUI-07 | skip |
| 5.6 | Version history for non-existent policy returns 404 | Error | US-PCUI-07 | skip |

## Milestone 6: Policy Trace Integration

| # | Scenario | Type | US Trace | Status |
|---|----------|------|----------|--------|
| 6.1 | Intent evaluation includes policy trace | Happy | US-PCUI-06 | skip |
| 6.2 | Trace captures matched and unmatched rules | Happy | US-PCUI-06 | skip |
| 6.3 | Trace entries link to retrievable policy details | Happy | US-PCUI-06 | skip |
| 6.4 | Empty trace when no active policies | Edge | US-PCUI-06 | skip |

## User Story Coverage Matrix

| User Story | Scenarios | Walking Skeletons |
|-----------|-----------|-------------------|
| US-PCUI-01 Policy List View | 1.7, 1.8, 1.9, 1.10 | 1.7 |
| US-PCUI-02 Create Policy | 2.1-2.7 | 2.1 |
| US-PCUI-03 Policy Detail View | 4.1-4.4 | 4.1 |
| US-PCUI-04 Activate/Deprecate | 3.1-3.7 | 3.1 |
| US-PCUI-05 Create New Version | 5.1-5.4 | 5.1 |
| US-PCUI-06 Policy Trace | 6.1-6.4 | -- (uses existing gate) |
| US-PCUI-07 Version History | 4.5, 4.6, 5.5, 5.6 | -- (in detail/version) |
| US-PCUI-08 Agent Authorization | 1.1-1.6 | -- (error paths) |

## Implementation Sequence

Enable one test at a time, implement, commit, repeat:

1. **1.7** (walking skeleton) -- admin lists policies
2. **1.9** -- empty list returns empty array
3. **1.8** -- status filter
4. **2.1** (walking skeleton) -- create draft policy
5. **2.4, 2.5** -- validation errors
6. **3.1** (walking skeleton) -- activate with edges
7. **3.5** -- deprecate with edge removal
8. **3.2, 3.3** -- invalid activation transitions
9. **4.1** (walking skeleton) -- full policy detail
10. **4.4** -- 404 for non-existent
11. **5.1** (walking skeleton) -- create version
12. **5.4** -- supersede atomicity
13. **1.1-1.4** -- agent authorization gate
14. Remaining scenarios in milestone order
