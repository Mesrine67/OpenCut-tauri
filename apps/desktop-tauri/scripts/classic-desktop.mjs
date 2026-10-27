import { spawn } from 'node:child_process'
import { copyFile, cp, lstat, mkdir, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const classicRoot = resolve(process.env.OPENCUT_CLASSIC_ROOT ?? resolve(appRoot, 'classic'))
const classicWeb = resolve(classicRoot, 'apps/web')
const tauriRoot = resolve(appRoot, 'src-tauri')
const port = process.env.OPENCUT_DESKTOP_PORT ?? '14382'
const bun = process.env.BUN_EXECUTABLE ?? 'bun'
const bundler = process.env.OPENCUT_DESKTOP_BUNDLER === 'webpack' ? '--webpack' : '--turbopack'
const resources = resolve(tauriRoot, 'resources')
const bunSource = process.env.BUN_RUNTIME_PATH ?? resolve(homedir(), '.bun/bin/bun.exe')

function desktopEnv() {
  return {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    OPENCUT_CLASSIC_ROOT: classicRoot,
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_OPENCUT_DESKTOP: '1',
    OPENCUT_DESKTOP: '1',
  }
}

async function applyDesktopLandingPatch() {
  const heroPath = resolve(classicWeb, 'src/components/landing/hero.tsx')
  let hero = await readFile(heroPath, 'utf8')
  if (!hero.includes('const isDesktop = process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1";')) {
    hero = hero.replace(
      'export function Hero() {',
      'export function Hero() {\n\tconst isDesktop = process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1";',
    )
  }
  hero = hero.replace(
    /(<p className="text-muted-foreground mx-auto mt-10 max-w-xl text-base font-light tracking-wide sm:text-xl">)[\s\S]*?(<\/p>)/,
    '$1\n\t\t\t\t\t{isDesktop ? "A simple but powerful video editor, ready for your desktop." : "A simple but powerful video editor that gets the job done. Works on any platform."}\n\t\t\t\t$2',
  )
  hero = hero.replace(
    /(<Button type="submit" size="lg" className="h-11 text-base">)[\s\S]*?(<ArrowRight className="ml-0.5" \/>)/,
    '$1\n\t\t\t\t\t\t\t{isDesktop ? "Open my projects" : "Try early beta"}\n\t\t\t\t\t\t\t$2',
  )
  const heroLineEnding = hero.includes('\r\n') ? '\r\n' : '\n'
  hero = hero.replace(/\r?\n/g, heroLineEnding)
  await writeFile(heroPath, hero)

  const headerPath = resolve(classicWeb, 'src/components/header.tsx')
  let header = await readFile(headerPath, 'utf8')
  if (!header.includes('const isDesktop = process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1";')) {
    header = header.replace(
      'export function Header() {',
      'export function Header() {\n\tconst isDesktop = process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1";',
    )
  }
  header = header.replace('const links = [', 'const links = isDesktop ? [] : [')
  header = header.replace(
    /(<Button className="text-sm">\r?\n\s*)Projects(\r?\n\s*<ArrowRight)/,
    '$1{isDesktop ? "My projects" : "Projects"}$2',
  )
  if (!hero.includes('{isDesktop ? "Open my projects" : "Try early beta"}')) {
    throw new Error(`Could not apply the desktop landing action in ${heroPath}`)
  }
  if (!header.includes('const links = isDesktop ? [] : [')) {
    throw new Error(`Could not apply desktop navigation in ${headerPath}`)
  }
  const headerLineEnding = header.includes('\r\n') ? '\r\n' : '\n'
  header = header.replace(/\r?\n/g, headerLineEnding)
  await writeFile(headerPath, header)
}

async function applyDesktopRuntimePatches() {
  const envPath = resolve(classicWeb, 'src/env/web.ts')
  let envSource = await readFile(envPath, 'utf8')
  const envAnchor = 'export const webEnv = webEnvSchema.parse(process.env);'
  if (!envSource.includes('const desktopEnvDefaults =')) {
    if (!envSource.includes(envAnchor)) throw new Error(`Could not patch desktop env defaults in ${envPath}`)
    envSource = envSource.replace(envAnchor, `const desktopEnvDefaults = process.env.OPENCUT_DESKTOP === "1" ? {
	DATABASE_URL: "postgresql://disabled:disabled@127.0.0.1:1/disabled",
	BETTER_AUTH_SECRET: "desktop-auth-disabled",
	UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
	UPSTASH_REDIS_REST_TOKEN: "desktop-redis-disabled",
	NEXT_PUBLIC_MARBLE_API_URL: "https://api.marblecms.com",
	MARBLE_WORKSPACE_KEY: "desktop-cms-disabled",
	FREESOUND_CLIENT_ID: "desktop-sounds-disabled",
	FREESOUND_API_KEY: "desktop-sounds-disabled",
} : {};

export const webEnv = webEnvSchema.parse({ ...process.env, ...desktopEnvDefaults });`)
  }
  await writeFile(envPath, envSource.replace(/\r?\n/g, envSource.includes('\r\n') ? '\r\n' : '\n'))

  const authRoutePath = resolve(classicWeb, 'src/app/api/auth/[...all]/route.ts')
  const authRoute = `import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

async function handle(request: Request) {
	if (process.env.OPENCUT_DESKTOP === "1") {
		return NextResponse.json({ error: "Accounts are not available in OpenCut Desktop." }, { status: 404 });
	}
	const { auth } = await import("@/auth/server");
	const handlers = toNextJsHandler(auth);
	return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export const GET = handle;
export const POST = handle;
`
  await writeFile(authRoutePath, authRoute)

  const feedbackRoutePath = resolve(classicWeb, 'src/app/api/feedback/route.ts')
  const feedbackRoute = `import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: NextRequest) {
	if (process.env.OPENCUT_DESKTOP === "1") {
		return NextResponse.json({ error: "Feedback submission is not available in OpenCut Desktop." }, { status: 404 });
	}

	const [{ checkRateLimit }, { submitFeedback, MAX_MESSAGE_LENGTH }] = await Promise.all([
		import("@/auth/rate-limit"),
		import("@/feedback"),
	]);
	const submitSchema = z.object({
		message: z.string().min(1, "Message is required").max(MAX_MESSAGE_LENGTH, "Message too long"),
	});
	const { limited } = await checkRateLimit({ request });
	if (limited) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const result = submitSchema.safeParse(await request.json());
	if (!result.success) {
		return NextResponse.json({ error: "Invalid input", details: result.error.flatten().fieldErrors }, { status: 400 });
	}
	const entry = await submitFeedback(result.data);
	return NextResponse.json({ entry }, { status: 201 });
}
`
  await writeFile(feedbackRoutePath, feedbackRoute)

  const soundsRoutePath = resolve(classicWeb, 'src/app/api/sounds/search/route.ts')
  let soundsRoute = await readFile(soundsRoutePath, 'utf8')
  if (!soundsRoute.includes('Online sound search is disabled in OpenCut Desktop.')) {
    soundsRoute = soundsRoute.replace(/import \{ checkRateLimit \} from "@\/auth\/rate-limit";\r?\n/, '')
    soundsRoute = soundsRoute.replace(
      /export async function GET\(request: NextRequest\) \{\r?\n\ttry \{\r?\n\t\tconst \{ limited \} = await checkRateLimit\(\{ request \}\);/,
      'export async function GET(request: NextRequest) {\n\tif (process.env.OPENCUT_DESKTOP === "1") {\n\t\treturn NextResponse.json({ error: "Online sound search is disabled in OpenCut Desktop." }, { status: 503 });\n\t}\n\tconst { checkRateLimit } = await import("@/auth/rate-limit");\n\ttry {\n\t\tconst { limited } = await checkRateLimit({ request });',
    )
    if (!soundsRoute.includes('Online sound search is disabled in OpenCut Desktop.')) {
      throw new Error(`Could not disable network sound search in ${soundsRoutePath}`)
    }
  }
  await writeFile(soundsRoutePath, soundsRoute.replace(/\r?\n/g, soundsRoute.includes('\r\n') ? '\r\n' : '\n'))

  const layoutPath = resolve(classicWeb, 'src/app/layout.tsx')
  let layout = await readFile(layoutPath, 'utf8')
  layout = layout.replace(
    '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && {process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <BotIdClient protect={protectedRoutes} />}}',
    '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <BotIdClient protect={protectedRoutes} />}',
  )
  if (!layout.includes('process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <BotIdClient')) {
    layout = layout.replace(
      '<BotIdClient protect={protectedRoutes} />',
      '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <BotIdClient protect={protectedRoutes} />}',
    )
  }
  if (!layout.includes('NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && (')) {
    layout = layout.replace(
      /<Script\s+src="https:\/\/cdn\.databuddy\.cc\/databuddy\.js"[\s\S]*?\/>/,
      (script) => `{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && (\n\t\t\t\t\t\t${script}\n\t\t\t\t\t\t)}`,
    )
  }
  if (!layout.includes('process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <BotIdClient')) {
    throw new Error(`Could not disable BotId in ${layoutPath}`)
  }
  if (!layout.includes('NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && (')) {
    throw new Error(`Could not disable web telemetry in ${layoutPath}`)
  }
  await writeFile(layoutPath, layout.replace(/\r?\n/g, layout.includes('\r\n') ? '\r\n' : '\n'))

  const editorHeaderPath = resolve(classicWeb, 'src/components/editor/editor-header.tsx')
  let editorHeader = await readFile(editorHeaderPath, 'utf8')
  editorHeader = editorHeader.replace(
    '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && {process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <FeedbackPopover />}}',
    '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <FeedbackPopover />}',
  )
  if (!editorHeader.includes('process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <FeedbackPopover')) {
    editorHeader = editorHeader.replace(
      '<FeedbackPopover />',
      '{process.env.NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <FeedbackPopover />}',
    )
  }
  if (!editorHeader.includes('NEXT_PUBLIC_OPENCUT_DESKTOP !== "1" && <FeedbackPopover />')) {
    throw new Error(`Could not disable remote feedback UI in ${editorHeaderPath}`)
  }
  editorHeader = editorHeader.replace(
    /(<DropdownMenuSeparator\s*\/>)[\s\S]*?(<\/DropdownMenuContent>)/,
    '$1\n\n\t\t\t\t\t<DropdownMenuItem asChild icon={<FaDiscord className="size-4!" />}>\n\t\t\t\t\t\t<Link\n\t\t\t\t\t\t\thref={SOCIAL_LINKS.discord}\n\t\t\t\t\t\t\ttarget="_blank"\n\t\t\t\t\t\t\trel="noopener noreferrer"\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\tDiscord\n\t\t\t\t\t\t</Link>\n\t\t\t\t\t</DropdownMenuItem>\n\t\t\t\t$2',
  )
  await writeFile(editorHeaderPath, editorHeader.replace(/\r?\n/g, editorHeader.includes('\r\n') ? '\r\n' : '\n'))

  const soundsViewPath = resolve(classicWeb, 'src/sounds/components/assets-view.tsx')
  let soundsView = await readFile(soundsViewPath, 'utf8')
  if (!soundsView.includes('function DesktopSoundsView()')) {
    soundsView = soundsView.replace(
      /export function SoundsView\(\) \{\r?\n/,
      '$&\tif (process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1") return <DesktopSoundsView />;\n',
    )
    soundsView = soundsView.replace(
      '\nfunction SoundEffectsView() {',
      `
function DesktopSoundsView() {
	const setActiveTab = useAssetsPanelStore((state) => state.setActiveTab);
	return (
		<div className="flex h-full items-center justify-center p-6">
			<div className="max-w-xs space-y-3 text-center">
				<h2 className="font-semibold">Use audio from this device</h2>
				<p className="text-muted-foreground text-sm">Open Media to import music or sound effects. They stay with your local project.</p>
				<Button variant="outline" onClick={() => setActiveTab("media")}>Open Media</Button>
			</div>
		</div>
	);
}

function SoundEffectsView() {`,
    )
    soundsView = soundsView.replace(
      'import { useSoundSearch } from "@/sounds/use-sound-search";',
      'import { useSoundSearch } from "@/sounds/use-sound-search";\nimport { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";',
    )
  }
  if (!soundsView.includes('process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1") return <DesktopSoundsView />;')) {
    soundsView = soundsView.replace(
      /export function SoundsView\(\) \{\r?\n/,
      '$&\tif (process.env.NEXT_PUBLIC_OPENCUT_DESKTOP === "1") return <DesktopSoundsView />;\n',
    )
  }
  if (!soundsView.includes('function DesktopSoundsView()')) {
    throw new Error(`Could not add local desktop sounds guidance in ${soundsViewPath}`)
  }
  await writeFile(soundsViewPath, soundsView.replace(/\r?\n/g, soundsView.includes('\r\n') ? '\r\n' : '\n'))
}

async function prepareResourcePlaceholders() {
  await mkdir(resolve(resources, 'classic-server/apps/web'), { recursive: true })
  await writeFile(resolve(resources, 'classic-server/apps/web/server.js'), '')
  await cp(bunSource, resolve(resources, 'bun.exe'))
}

async function applyClassicCompatibilityPatch() {
  await applyDesktopLandingPatch()
  await applyDesktopRuntimePatches()

  const patches = [
    {
      path: resolve(classicWeb, 'src/actions/keybinding.ts'),
      symbol: 'export function isShortcutKey(',
      anchor: 'const KEY_SET: ReadonlySet<string> = new Set(KEYS);',
      insertion: `const MODIFIER_KEY_SET: ReadonlySet<string> = new Set([\n\t"ctrl", "alt", "shift", "ctrl+shift", "alt+shift", "ctrl+alt", "ctrl+alt+shift",\n]);\n\nexport function isShortcutKey(value: string): value is ShortcutKey {\n\tconst separatorIndex = value.lastIndexOf("+");\n\tif (separatorIndex === -1) return isKey(value);\n\treturn MODIFIER_KEY_SET.has(value.slice(0, separatorIndex)) && isKey(value.slice(separatorIndex + 1));\n}`,
    },
    {
      path: resolve(classicWeb, 'src/actions/definitions.ts'),
      symbol: 'export function isActionWithOptionalArgs(',
      anchor: 'export type TAction = keyof typeof ACTIONS;',
      insertion: `export function isActionWithOptionalArgs(value: unknown): value is TActionWithOptionalArgs {\n\tif (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(ACTIONS, value)) return false;\n\treturn value !== "remove-media-asset" && value !== "remove-media-assets";\n}\n\n`,
    },
  ]

  for (const { path, symbol, anchor, insertion } of patches) {
    const source = await readFile(path, 'utf8')
    if (source.includes(symbol)) continue
    if (!source.includes(anchor)) {
      throw new Error(`OpenCut Classic changed ${path}; review the desktop compatibility patch`)
    }
    const patched = path.endsWith('keybinding.ts')
      ? source.replace(anchor, `${anchor}\n\n${insertion}`)
      : source.replace(anchor, `${insertion}${anchor}`)
    await writeFile(path, patched)
  }

  const nextConfigPath = resolve(classicWeb, 'next.config.ts')
  let nextConfig = await readFile(nextConfigPath, 'utf8')
  if (!nextConfig.includes('outputFileTracingRoot:')) {
    const outputAnchor = 'output: "standalone",'
    if (!nextConfig.includes(outputAnchor)) {
      throw new Error(`OpenCut Classic changed standalone Next config in ${nextConfigPath}`)
    }
    nextConfig = nextConfig.replace(
      outputAnchor,
      `${outputAnchor}\n\tturbopack: { root: process.env.OPENCUT_CLASSIC_ROOT ?? process.cwd() },\n\toutputFileTracingRoot: process.env.OPENCUT_CLASSIC_ROOT ?? process.cwd(),`,
    )
    await writeFile(nextConfigPath, nextConfig)
  }

  const migrationsPath = resolve(classicWeb, 'src/services/storage/migrations/runner.ts')
  let migrations = await readFile(migrationsPath, 'utf8')
  const oldProjectsAdapter = /new IndexedDBAdapter<ProjectRecord>\(\s*"video-editor-projects",\s*"projects",\s*1,\s*\)/
  if (oldProjectsAdapter.test(migrations)) {
    migrations = migrations.replace(oldProjectsAdapter, 'new IndexedDBAdapter<ProjectRecord>({ dbName: "video-editor-projects", storeName: "projects", version: 1 })')
  } else if (!migrations.includes('new IndexedDBAdapter<ProjectRecord>({')) {
    throw new Error(`OpenCut Classic changed the projects migration adapter in ${migrationsPath}`)
  }
  migrations = migrations.replace(
    /projectsAdapter\.set\(projectId,\s*result\.project\)/,
    'projectsAdapter.set({ key: projectId, value: result.project })',
  )
  await writeFile(migrationsPath, migrations)

  const migrationV1Path = resolve(classicWeb, 'src/services/storage/migrations/v1-to-v2.ts')
  let migrationV1 = await readFile(migrationV1Path, 'utf8')
  migrationV1 = migrationV1.replace(
    /new IndexedDBAdapter<LegacyTimelineData>\(\s*sceneDbName,\s*"timeline",\s*1,\s*\)/,
    'new IndexedDBAdapter<LegacyTimelineData>({ dbName: sceneDbName, storeName: "timeline", version: 1 })',
  ).replace(
    /new IndexedDBAdapter<LegacyTimelineData>\(\s*projectDbName,\s*"timeline",\s*1,\s*\)/,
    'new IndexedDBAdapter<LegacyTimelineData>({ dbName: projectDbName, storeName: "timeline", version: 1 })',
  ).replace(
    /new IndexedDBAdapter<MediaAssetData>\(\s*`video-editor-media-\$\{projectId\}`,\s*"media-metadata",\s*1,\s*\)/,
    'new IndexedDBAdapter<MediaAssetData>({ dbName: `video-editor-media-${projectId}`, storeName: "media-metadata", version: 1 })',
  )
  if (migrationV1.includes('new IndexedDBAdapter<LegacyTimelineData>(\n\t\tsceneDbName,')) {
    throw new Error(`Could not patch the legacy timeline adapter in ${migrationV1Path}`)
  }
  await writeFile(migrationV1Path, migrationV1)

  const stickerProvidersPath = resolve(classicWeb, 'src/stickers/providers/index.ts')
  let stickerProviders = await readFile(stickerProvidersPath, 'utf8')
  if (stickerProviders.includes('stickersRegistry.register(provider.id, provider)')) {
    stickerProviders = stickerProviders.replace(
      'stickersRegistry.register(provider.id, provider)',
      'stickersRegistry.register({ key: provider.id, definition: provider })',
    )
    await writeFile(stickerProvidersPath, stickerProviders)
  } else if (!stickerProviders.includes('stickersRegistry.register({ key: provider.id, definition: provider })')) {
    throw new Error(`OpenCut Classic changed the sticker registry API in ${stickerProvidersPath}`)
  }
}

async function assertPortAvailable() {
  await new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.once('error', (error) => reject(new Error(`OpenCut Desktop port ${port} is unavailable: ${error.message}`)))
    server.listen(Number(port), '127.0.0.1', () => server.close((error) => error ? reject(error) : resolvePromise()))
  })
}

async function copyStandaloneTree(source, destination, standaloneRoot = source, ancestors = new Set()) {
  const info = await lstat(source)
  if (info.isSymbolicLink()) {
    const target = resolve(dirname(source), await readlink(source))
    const relativeTarget = relative(standaloneRoot, target)
    if (isAbsolute(relativeTarget) || relativeTarget === '..' || relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      throw new Error(`Standalone dependency link escapes its build output: ${source} -> ${target}`)
    }
    if (ancestors.has(target)) throw new Error(`Circular standalone dependency link: ${source} -> ${target}`)
    return copyStandaloneTree(target, destination, standaloneRoot, new Set([...ancestors, target]))
  }

  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true })
    for (const name of await readdir(source)) {
      await copyStandaloneTree(resolve(source, name), resolve(destination, name), standaloneRoot, ancestors)
    }
    return
  }

  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
}

function run(args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bun, args, { cwd: classicWeb, stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`Bun exited with code ${code}`)))
  })
}

const mode = process.argv[2]
if (mode === 'dev') {
  await applyClassicCompatibilityPatch()
  await assertPortAvailable()
  await prepareResourcePlaceholders()
  await run(['run', 'next', 'dev', bundler, '--hostname', '127.0.0.1', '--port', port], { env: desktopEnv() })
} else if (mode === 'build') {
  await applyClassicCompatibilityPatch()
  const env = {
    ...desktopEnv(),
    NODE_ENV: 'production',
  }
  await prepareResourcePlaceholders()
  await run(['run', 'build'], { env })

  const standalone = resolve(classicWeb, '.next/standalone')
  const server = resolve(resources, 'classic-server')
  const loader = resolve(tauriRoot, 'loader')
  const relativeEntry = ['apps/web/server.js', 'classic/apps/web/server.js', 'server.js']
    .find((candidate) => existsSync(resolve(standalone, candidate)))
  if (!relativeEntry) throw new Error(`Could not find Next standalone server.js in ${standalone}`)

  await rm(server, { recursive: true, force: true })
  await mkdir(server, { recursive: true })
  await copyStandaloneTree(standalone, server)
  const serverDirectory = dirname(resolve(server, relativeEntry))
  await cp(resolve(classicWeb, 'public'), resolve(serverDirectory, 'public'), { recursive: true })
  await cp(resolve(classicWeb, '.next/static'), resolve(serverDirectory, '.next/static'), { recursive: true })
  const tracedModules = resolve(standalone, 'node_modules/.bun/node_modules')
  for (const name of await readdir(tracedModules)) {
    await copyStandaloneTree(resolve(tracedModules, name), resolve(serverDirectory, 'node_modules', name), standalone)
  }
  await writeFile(resolve(server, 'desktop-start.cjs'), `const fs = require('node:fs');\nconst path = require('node:path');\nconst candidates = ['apps/web/server.js', 'classic/apps/web/server.js', 'server.js'];\nconst entry = candidates.map((relative) => path.resolve(__dirname, relative)).find(fs.existsSync);\nif (!entry) throw new Error('OpenCut standalone server.js is missing');\nprocess.chdir(path.dirname(entry));\nrequire(entry);\n`)
  await mkdir(resolve(loader), { recursive: true })
  await Bun.write(resolve(loader, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenCut</title></head><body style="font:16px system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh"><p>Starting OpenCut…</p></body></html>')

  await cp(bunSource, resolve(resources, 'bun.exe'))
} else {
  throw new Error('Usage: bun scripts/classic-desktop.mjs <dev|build>')
}
