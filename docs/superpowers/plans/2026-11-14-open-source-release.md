# SpectrumLink Open Source Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish SpectrumLink v3.7.7 as a safe, documented, reproducible public GitHub project.

**Architecture:** Keep the existing application architecture unchanged. Add a repository-level open-source contract, licensing and community files, then publish the verified local commit as `main`; the compiled radio app is distributed through a GitHub Release rather than Git.

**Tech Stack:** Node.js test runner, static HTML/CSS/JavaScript, C radio app, Bash build scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-open-source-release.md`

## Global Constraints

- Release version is exactly `v3.7.7`.
- Default documentation language is Simplified Chinese.
- Original SpectrumLink code is `GPL-2.0-or-later`; third-party licenses remain unchanged.
- No secrets, local metadata, dependencies, caches, or compiled radio artifacts are committed.
- Hardware and data-source limitations must be stated truthfully.

## Review Focus

- A clean clone must show every required open-source document and pass the package contract test.
- CI must not depend on ignored local build artifacts.
- Third-party model and mapping credits must remain discoverable after dashboard credits are hidden.
- README must not claim audio/IQ capture or simulated ADS-B targets.
- Release attachment must pass the existing artifact verifier before upload.

---

### Task 1: Open-source package contract

**Files:**
- Create: `tests/open-source-package.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository files and package metadata.
- Produces: a deterministic contract enforced by `npm test`.

- [ ] Write the failing repository contract test.
- [ ] Run it and confirm it fails because the required public files and metadata are absent.
- [ ] Add only the metadata and ignore rules required by the contract.
- [ ] Re-run the focused test and the full suite.
- [ ] Commit the package contract.

### Task 2: Public documentation and licensing

**Files:**
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`
- Rewrite: `README.md`

**Interfaces:**
- Consumes: existing build commands, hardware guide and bundled third-party license texts.
- Produces: complete public usage, limitation, attribution and contribution documentation.

- [ ] Extend the contract test with exact author, version, limitation and license assertions.
- [ ] Run it and confirm the new assertions fail.
- [ ] Add the documents and rewrite README in Chinese-first form.
- [ ] Run the focused test and full suite.
- [ ] Commit documentation and licenses.

### Task 3: GitHub project automation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: `npm ci`, `npm test` and repository contract.
- Produces: repeatable CI and structured community reports.

- [ ] Extend the contract test for CI and templates.
- [ ] Run it and confirm failure.
- [ ] Add the workflow and templates.
- [ ] Run all tests and static validation.
- [ ] Commit GitHub automation.

### Task 4: Verified public release

**Files:**
- Modify: Git branch/ref and remote repository state only.
- Release asset: `dist/SpectrumLink.app`

**Interfaces:**
- Consumes: a clean verified commit and authenticated GitHub account.
- Produces: public `main` branch and GitHub Release `v3.7.7`.

- [ ] Scan tracked files and history for credentials and unintended binaries.
- [ ] Verify `dist/SpectrumLink.app` with `scripts/verify-dist.sh`.
- [ ] Rename the branch to `main`, create the public repository and push.
- [ ] Create release `v3.7.7` and attach the verified `.app` file.
- [ ] Read back repository, release and CI state and report the public URLs.
