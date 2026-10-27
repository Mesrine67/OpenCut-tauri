# OpenCut upstream triage

Snapshot taken 2026-10-27 for `OpenCut-app/OpenCut`. The complete open-item inventory and per-item recommendation is in [`UPSTREAM_TRIAGE.csv`](UPSTREAM_TRIAGE.csv).

## Scope and limits

- The public API returned 288 open issues and 99 open pull requests (387 rows total). Every open item is listed with its title, labels, dates, routing, priority, and a decision recommendation.
- This is a fork-maintenance triage, not a claim that all upstream items were reproduced or that upstream statuses changed. The GitHub account can push to `Mesrine67/OpenCut` but has no upstream push or triage permission. Issues cannot be closed, PRs cannot be merged, and the upstream repository only accepts PRs from collaborators.
- The issue routing is based on item metadata, description, and the project's rewrite/pivot history. A routing label such as “candidate” means check the matching code generation before implementing; it does not imply the issue still reproduces.

## Product decisions

1. Keep **OpenCut Classic** and **OpenCut New** as separate Tauri 2 applications with separate bundle IDs and product names, so they install side by side.
2. Classic remains on the older editor lineage and bundles its Next standalone server into the desktop package. Its runtime does not require the separate web service.
3. New uses the current rewrite's frontend source and packages the prerendered app into Tauri assets. The installed app starts no web server and has no local listener. At this snapshot it is a **preview shell**: landing page and editor preview only, not a usable video editor equivalent to the web app.
4. Do not merge old upstream PRs into the rewrite by default. All 99 open PRs were created before tracking issue #811; 88 target `main`, 10 target `staging`, and one targets `dev`. Review or port individual changes only after rebasing against the current target and confirming they still apply.

## Applied locally

- **#830, test/CI configuration:** Added a Vitest config isolated from the Cloudflare Worker plugin, with `jsdom` and `passWithNoTests`, and pointed the `test` script at it. This config was not exercised by running tests in this task.
- **#837 and #909, Moon CI branch resolution:** Set the workspace VCS default branch to `main`; skipped the Cloudflare deploy task in CI because it requires credentials. Treat #837 as a duplicate candidate of #909 upstream.
- **#913, FFmpeg setup:** Restored the missing `crates/media/setup/pin.ts` workflow and pinned all six platform archives to the official `ffmpeg-8.1.3-1` release checksums. The source-build URL/checksum remains intact.
- **#902, blank new landing page:** Added a local OpenCut-branded landing page and a clearly marked editor preview route for the Tauri New shell. This does not complete the editor.

## Key issue decisions

- **#811:** Keep as the upstream rewrite roadmap. Its desktop editor and public-beta milestones remain unfinished; the New Tauri app stays labeled as a preview until editing workflows are implemented.
- **#830:** Fix locally as above; run the upstream CI/test workflow before claiming the issue is verified fixed.
- **#837 / #909:** One local Moon configuration change covers both; recommend closing #837 as a duplicate only if maintainers confirm.
- **#873:** Keep on the Classic storage path and investigate the data-loss race separately. Do not copy a storage fix into New without reproducing it there.
- **#889, #892, #894, #895, #896:** These concern the old GPUI desktop pivot. Do not port GPUI-specific code into the Tauri applications; the Tauri setup guide documents its Windows build prerequisites separately.
- **#899:** Treat as a brand/security report for upstream maintainers; do not visit or promote the reported domain.
- **#912, #914, #915:** Keep separate pending platform reproductions. #915 includes a distinct allocation failure; do not close audio/export reports as duplicates solely from similar titles.
- **#917:** Recommend off-topic closure; it is a video-generation brief rather than a software report.
- **#918:** Keep as a community Electron wrapper reference, not an official desktop build.
- **#916 and #919:** Leave official communication to upstream maintainers; request reproduction details for #919 before deciding.

All other issue-level recommendations are recorded row by row in the CSV. Broad feature requests stay in the backlog until they fit the Classic or New roadmap; legacy bug reports require reproduction against the relevant code generation before implementation or closure.

## Pull requests

- **#484 (Tauri wrapper):** Superseded for this fork by the two separate Tauri applications; do not import its old `apps/native` shell.
- **#750 (effects/transforms on `dev`):** Keep on the Classic/dev line. The change is large and GitHub reported an unstable merge state; review and backport selectively after validation.
- **Other PRs:** Retain upstream review ownership. The CSV records each base branch and mergeability state; old `main`/`staging` changes need applicability review before any port.

## Discussions and releases

- Snapshot: 14 discussions, with only #833 answered. Leave unanswered project questions to maintainers. Flag #819/#893 for spam review and #874 for moderator review because a comment contains a shortened external download link; do not follow it.
- The latest stable app release in this snapshot is `v0.3.0` (2026-04-15). The newest overall release is `ffmpeg-8.1.3-1` (2026-09-24), which packages media dependencies rather than a new OpenCut app. There is no upstream release for the rewrite/New Tauri editor yet.

## Verification state

- Classic Tauri release build: passed; NSIS and MSI installers produced.
- New Tauri release build: passed; NSIS and MSI installers produced. The built application launched and rendered its preview UI; the production app opened without a local server listener.
- `cargo check --workspace --offline`: passed.
- FFmpeg pin script dry run and update: passed; six platform URLs/checksums resolved from the upstream release.
- The Vitest suite was not run, so #830's new test configuration still needs CI/test execution before calling that fix verified.

## Source links

- [Rewrite tracker #811](https://github.com/OpenCut-app/OpenCut/issues/811)
- [All upstream issues](https://github.com/OpenCut-app/OpenCut/issues)
- [All upstream pull requests](https://github.com/OpenCut-app/OpenCut/pulls)
- [Discussions](https://github.com/OpenCut-app/OpenCut/discussions)
- [Releases](https://github.com/OpenCut-app/OpenCut/releases)
