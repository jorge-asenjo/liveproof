import Link from "next/link";
import { EVAL_SUMMARY } from "@/lib/eval-summary";

const REPO = "https://github.com/jorge-asenjo/liveproof";

export default function Home() {
  return (
    <main className="min-h-screen bg-desk text-graphite">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            LiveProof
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#how" className="hidden text-muted hover:text-graphite sm:inline">
              How it works
            </a>
            <a href="#stops" className="hidden text-muted hover:text-graphite sm:inline">
              What it stops
            </a>
            <a href={REPO} className="text-muted hover:text-graphite">
              GitHub
            </a>
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-muted ring-1 ring-line">PayPal sandbox</span>
          </nav>
        </header>

        <Hero />
        <Problem />
        <HowItWorks />
        <Stops />
        <TryIt />

        <footer className="flex flex-col gap-2 border-t border-line py-8 text-sm text-muted sm:flex-row sm:justify-between">
          <p>Open source under the MIT license. Built for the PayPal AI Hackathon 2026.</p>
          <p>Made with Log in with PayPal, PayPal Orders v2, Claude and MediaPipe.</p>
        </footer>
      </div>
    </main>
  );
}

function Hero() {
  return (
    <section className="grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Your PayPal payment only goes to the person who just proved, live on camera, that they have the item.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          For buying from strangers on Reddit, Marketplace and forums. The seller logs in with PayPal and does a one-minute live check
          with the item. The buyer&apos;s payment is locked to that same verified account.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/sell" className="rounded-full bg-ink px-6 py-3 font-medium text-white hover:bg-[#16327c]">
            Sell with a live proof
          </Link>
          <a href="#stops" className="rounded-full px-6 py-3 font-medium text-ink ring-1 ring-ink/40 hover:bg-ink-soft">
            See what it stops
          </a>
        </div>
      </div>
      <ProofPreview />
    </section>
  );
}

// A still of the live proof: the fresh code written on paper, the surprise gesture, and the
// lock between the account that proved it and the account PayPal pays.
function ProofPreview() {
  return (
    <div className="flex flex-col gap-3" aria-label="Example of a live proof and its locked PayPal payee">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-graphite">
        <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {/* desk */}
          <rect x="0" y="190" width="400" height="110" fill="#2b3138" />
          {/* graphics card */}
          <g transform="translate(36 150) rotate(-4)">
            <rect width="190" height="74" rx="6" fill="#3d454f" stroke="#59636f" strokeWidth="2" />
            <circle cx="52" cy="37" r="25" fill="#2b3138" stroke="#6b7682" strokeWidth="2" />
            <circle cx="138" cy="37" r="25" fill="#2b3138" stroke="#6b7682" strokeWidth="2" />
            <circle cx="52" cy="37" r="6" fill="#59636f" />
            <circle cx="138" cy="37" r="6" fill="#59636f" />
            <rect x="0" y="74" width="120" height="6" fill="#b08d3c" />
          </g>
        </svg>
        {/* the paper with the fresh code */}
        <div className="absolute bottom-[14%] right-[8%] w-[46%] rotate-[3deg] rounded-sm bg-paper px-4 py-5 shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
          <p className="write-in font-hand text-[clamp(2.2rem,6vw,3.4rem)] font-bold leading-none tracking-wider text-ink">HX7CT</p>
        </div>
        <span className="pop-in absolute right-[12%] top-[10%] text-6xl drop-shadow-lg" role="img" aria-label="peace sign gesture">
          ✌️
        </span>
        {/* viewfinder corners */}
        <div className="pointer-events-none absolute inset-4">
          <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/70" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/70" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/70" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/70" />
        </div>
        <span className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
          <span className="rec-blink h-2 w-2 rounded-full bg-rec" />
          LIVE
        </span>
        <span className="absolute bottom-6 left-6 rounded-full bg-black/55 px-3 py-1 text-xs text-white">Surprise gesture in 3.2 s</span>
      </div>

      <dl className="lock-in grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-paper p-5 text-sm ring-1 ring-line">
        <dt className="text-muted">Proved live by</dt>
        <dd className="text-right font-medium">
          Sam Rivera, PayPal ID <span className="tabular-nums">GHMARES2TM662</span>
        </dd>
        <dt className="text-muted">PayPal pays</dt>
        <dd className="flex items-center justify-end gap-2 font-medium">
          <span className="tabular-nums">GHMARES2TM662</span>
          <span className="rounded-full bg-ok/10 px-2 py-0.5 text-xs font-semibold text-ok">Same account, locked</span>
        </dd>
      </dl>
    </div>
  );
}

function Problem() {
  return (
    <section className="grid grid-cols-1 gap-8 border-t border-line py-14 lg:grid-cols-[1fr_1.2fr]">
      <h2 className="text-3xl font-semibold leading-tight tracking-tight">A timestamp photo is no longer proof</h2>
      <div className="flex flex-col gap-6">
        <figure className="flex flex-col gap-2 border-l-4 border-ink pl-5">
          <blockquote className="text-xl leading-snug">&ldquo;With the rise of AI timestamps, and compromised accounts, scams are becoming more regular.&rdquo;</blockquote>
          <figcaption className="text-sm text-muted">Moderators of r/hardwareswap, October 25, 2026</figcaption>
        </figure>
        <figure className="flex flex-col gap-2 border-l-4 border-line pl-5">
          <blockquote className="text-lg leading-snug">&ldquo;More trades originating from Buying posts are fraudulent than legitimate.&rdquo;</blockquote>
          <figcaption className="text-sm text-muted">Moderators of r/hardwareswap, October 8, 2026</figcaption>
        </figure>
        <p className="max-w-2xl leading-relaxed text-muted">
          A buyer about to send $450 for a used graphics card gets a photo of the card next to a note with the seller&apos;s name and
          the date. That photo can be copied from an old listing or made with AI in seconds. And the PayPal account that asks for
          the money does not have to be the one that sent the photo.
        </p>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "The seller logs in with PayPal",
    body: "LiveProof gets the seller's verified PayPal identity from Log in with PayPal: name, email, verified status and PayPal account ID. That account is the only one that can be paid.",
  },
  {
    title: "A live proof, in about a minute",
    body: "The seller pastes their listing and Claude picks a detail of that item to show. LiveProof shows a fresh random code to write by hand and a gesture, then a surprise gesture with 15 seconds to answer. Claude describes the frames without knowing the expected answer, and fixed rules decide.",
  },
  {
    title: "The buyer pays the account that proved it",
    body: "The buyer link shows the proof frames and the verified account. LiveProof creates the PayPal order on the server with that account as the payee, and it checks the order before capturing it, then shows the account PayPal says it paid.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="flex flex-col gap-8 border-t border-line py-14">
      <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const ATTACKS = [
  {
    attack: "An old or copied timestamp photo",
    defence: "The code did not exist until the live proof started, and it works once.",
  },
  {
    attack: "A photo edited to show the new code",
    defence: "The code has to look handwritten on paper, with no signs of editing, and it must still be in view, in the same scene, for a surprise gesture with 15 seconds to answer.",
  },
  {
    attack: "A different item than the one listed",
    defence: "Claude compares what is on camera with the listing. When it can only confirm the kind of item, the buyer is told so.",
  },
  {
    attack: "“Pay my other account” after the proof",
    defence: "The server sets the payee when it creates the PayPal order. Nothing in the buyer link can change who gets paid.",
  },
];

function Stops() {
  return (
    <section id="stops" className="flex flex-col gap-8 border-t border-line py-14">
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">What it stops</h2>
        <p className="leading-relaxed text-muted">
          LiveProof does not try to detect AI images. It makes a proof expensive to fake: fresh, physical, timed, and tied to the
          account that gets paid.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl bg-paper ring-1 ring-line">
        {ATTACKS.map((a, i) => (
          <div key={a.attack} className={`grid grid-cols-1 gap-2 p-5 sm:grid-cols-[1fr_1.6fr] sm:gap-8 ${i > 0 ? "border-t border-line" : ""}`}>
            <p className="font-semibold">{a.attack}</p>
            <p className="text-muted">{a.defence}</p>
          </div>
        ))}
      </div>
      {EVAL_SUMMARY && (
        <div className="flex flex-col gap-4">
          <p className="max-w-3xl leading-relaxed">
            Tested against attacks on purpose. On {EVAL_SUMMARY.cases} recorded attempts, checked by {EVAL_SUMMARY.model}:
          </p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
              <dt className="text-sm text-muted">Genuine proofs accepted</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{EVAL_SUMMARY.genuine}</dd>
            </div>
            <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
              <dt className="text-sm text-muted">Fakes rejected</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{EVAL_SUMMARY.attacks}</dd>
            </div>
            <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
              <dt className="text-sm text-muted">Median check time</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{EVAL_SUMMARY.medianSeconds}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">{EVAL_SUMMARY.note}</p>
        </div>
      )}
    </section>
  );
}

function TryIt() {
  return (
    <section className="grid grid-cols-1 gap-8 border-t border-line py-14 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">Try it in the PayPal sandbox</h2>
        <p className="leading-relaxed text-muted">No real money moves. Any object on your desk works as the item.</p>
      </div>
      <div className="flex flex-col gap-5">
        <ol className="flex list-decimal flex-col gap-2 pl-5 leading-relaxed">
          <li>Open the seller page and log in with the sandbox seller account from the README.</li>
          <li>Paste a short listing for something you have at hand, like a mouse or headphones.</li>
          <li>Do the live proof with a pen and a piece of paper.</li>
          <li>Create the buyer link, open it and pay with the sandbox buyer account.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/sell" className="rounded-full bg-ink px-6 py-3 font-medium text-white hover:bg-[#16327c]">
            Open the seller page
          </Link>
          <a href={`${REPO}#try-it`} className="rounded-full px-6 py-3 font-medium text-ink ring-1 ring-ink/40 hover:bg-ink-soft">
            Sandbox accounts in the README
          </a>
        </div>
        <p className="text-sm text-muted">The demo runs on a free server that sleeps when idle: the first page can take up to a minute.</p>
      </div>
    </section>
  );
}
