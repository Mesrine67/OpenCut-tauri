import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Film, Layers3, Sparkles } from 'lucide-react'

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="min-h-screen bg-[#101010] px-8 py-10 text-white md:px-16">
			<div className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 pb-6">
				<a href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-white text-black"><Film size={19} /></span>OpenCut</a>
				<span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Desktop preview · Tauri 2</span>
			</div>
			<section className="mx-auto grid max-w-6xl gap-12 py-20 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-32">
				<div>
					<div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/70"><Sparkles size={15} /> Your creative workspace</div>
					<h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">Make room for <span className="text-white/45">your next cut.</span></h1>
					<p className="mt-6 max-w-xl text-lg leading-8 text-white/55">OpenCut is an open source video editor in the making. This native desktop shell is the starting point for the editing experience.</p>
					<a href="/editor" className="mt-9 inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 font-medium text-black transition hover:bg-white/85">Open editor preview <ArrowRight size={17} /></a>
				</div>
				<div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-7 shadow-2xl shadow-black/40">
					<div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-white/10"><Layers3 size={20} /></span><div><p className="font-medium">Your next project</p><p className="text-sm text-white/45">A clean timeline awaits</p></div></div>
					<div className="mt-8 grid h-40 grid-cols-12 gap-2 overflow-hidden rounded-2xl bg-black/30 p-3">{Array.from({ length: 24 }, (_, i) => <span key={i} className="rounded-md bg-white/10" style={{ height: `${25 + ((i * 37) % 70)}%`, alignSelf: 'end' }} />)}</div>
					<p className="mt-5 text-sm leading-6 text-white/45">A desktop-first workspace, built on OpenCut’s shared web foundation and native Tauri capabilities.</p>
				</div>
			</section>
		</main>
	);
}
