import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/editor')({ component: Editor })

function Editor() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#101010] px-6 text-center text-white">
      <section className="max-w-lg">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl">✦</div>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight">The editing canvas is next</h1>
        <p className="mt-3 leading-7 text-white/55">The native OpenCut shell is ready to grow into a full editor. Timeline, media import, and project workflows are the next milestones.</p>
        <a href="/" className="mt-7 inline-block rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">Back to OpenCut</a>
      </section>
    </main>
  )
}
