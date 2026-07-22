import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-holo text-8xl font-black">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Lost in the strobe</h2>
        <p className="mt-2 text-sm text-white/60">This page isn't on the guest list.</p>
        <div className="mt-6">
          <Link href="/" className="glass-strong inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white">
            Back to the party
          </Link>
        </div>
      </div>
    </div>
  );
}
