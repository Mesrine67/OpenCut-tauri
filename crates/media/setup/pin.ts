import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { tag_name: string; assets: ReleaseAsset[] };
type Download = { url: string; sha256: string };

const root = resolve(import.meta.dir, "../../..");
const manifestPath = resolve(import.meta.dir, "ffmpeg.json");
const platforms = [
  "linux-x86_64",
  "linux-aarch64",
  "windows-x86_64",
  "windows-aarch64",
  "macos-x86_64",
  "macos-aarch64",
] as const;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function repoFromRemote(name: string): string | undefined {
  const result = Bun.spawnSync(["git", "remote", "get-url", name], {
    cwd: root,
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode !== 0) return undefined;

  const remote = new TextDecoder().decode(result.stdout).trim();
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match?.[1];
}

function checksumFor(checksums: string, filename: string): string {
  for (const line of checksums.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f\d]{64})\s+\*?(.+)$/i);
    if (match?.[2] === filename) return match[1].toLowerCase();
  }
  throw new Error(`checksums.sha256 has no checksum for ${filename}`);
}

async function main() {
  const tag = process.argv[2];
  if (!tag || tag === "--help" || tag === "-h") {
    console.log("Usage: bun run crates/media/setup/pin.ts <ffmpeg-release-tag> [--repo owner/name] [--dry-run]");
    console.log("Pins the release's platform archives in crates/media/setup/ffmpeg.json.");
    process.exit(tag ? 0 : 2);
  }
  if (!/^ffmpeg-\d+\.\d+\.\d+-\d+$/.test(tag)) {
    throw new Error(`invalid FFmpeg release tag: ${tag}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    version: string;
    source: Download;
    platforms: Record<string, Download>;
  };
  const expectedVersion = tag.match(/^ffmpeg-(\d+\.\d+\.\d+)-\d+$/)?.[1];
  if (expectedVersion !== manifest.version) {
    throw new Error(`tag ${tag} is for FFmpeg ${expectedVersion}, but ffmpeg.json pins ${manifest.version}`);
  }

  const repo = option("--repo")
    ?? process.env.GITHUB_REPOSITORY
    ?? repoFromRemote("upstream")
    ?? repoFromRemote("origin");
  if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("could not determine a GitHub owner/repository; pass --repo owner/name");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status} ${response.statusText}`);
  const release = (await response.json()) as Release;
  if (release.tag_name !== tag) throw new Error(`GitHub returned ${release.tag_name} for requested tag ${tag}`);

  const checksumAsset = release.assets.find((asset) => asset.name === "checksums.sha256");
  if (!checksumAsset) throw new Error(`${tag} has no checksums.sha256 asset`);
  const checksumResponse = await fetch(checksumAsset.browser_download_url);
  if (!checksumResponse.ok) throw new Error(`could not download checksums.sha256: ${checksumResponse.status}`);
  const checksums = await checksumResponse.text();

  const pinned: Record<string, Download> = {};
  for (const platform of platforms) {
    const filename = `ffmpeg-${manifest.version}-${platform}.tar.gz`;
    const asset = release.assets.find((candidate) => candidate.name === filename);
    if (!asset) throw new Error(`${tag} has no ${filename} asset`);
    pinned[platform] = {
      url: asset.browser_download_url,
      sha256: checksumFor(checksums, filename),
    };
  }

  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ repo, tag, platforms: pinned }, null, 2));
    return;
  }

  // Keep `source` pointed at the original FFmpeg source archive: --from-source
  // needs it, while this release supplies the platform-specific prebuilt archives.
  manifest.platforms = { ...manifest.platforms, ...pinned };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Pinned FFmpeg ${manifest.version} platform archives from ${repo}@${tag} in crates/media/setup/ffmpeg.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
