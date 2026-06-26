import { Link } from "react-router";
import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "PitchLedger — Soccer highlights for serious players" },
    {
      name: "description",
      content:
        "Subscribe, upload 60-second highlight reels, and get discovered by scouts.",
    },
  ];
}

export default function Landing() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(62,224,122,0.14),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(120,200,255,0.08),transparent_35%)]" />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          <p className="mb-4 inline-flex rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--color-accent)]">
            Built for the modern pathway
          </p>
          <h1 className="font-display max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your highlights.{" "}
            <span className="text-gradient">One clean reel.</span>{" "}
            Scout-ready.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
            Monthly membership unlocks the platform. Pay per upload for each
            60-second clip—stored in your private vault with name, age, and
            timestamp so scouts can evaluate with context.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/signup" className="btn-primary px-8 py-3 text-base">
              Create account
            </Link>
            <Link to="/login" className="btn-ghost px-8 py-3 text-base">
              Log in
            </Link>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Membership",
                d: "Active subscription gates uploads and scout visibility.",
              },
              {
                t: "60s cap",
                d: "Every highlight enforces a one-minute maximum duration.",
              },
              {
                t: "Scout portal",
                d: "Dedicated workspace to score, note, and track every clip.",
              },
            ].map((c) => (
              <div key={c.t} className="glass-panel p-5">
                <h3 className="font-display text-lg font-semibold text-white">
                  {c.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
