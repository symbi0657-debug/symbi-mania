import Link from "next/link";

export function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <img
            src="/fresho-logo.png"
            alt="Fresho Mania 3.0"
            className="h-10 w-auto sm:h-12"
          />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/passes"
            className="text-sm text-white/70 transition hover:text-white"
          >
            Passes
          </Link>
          <Link
            href="/my-ticket"
            className="text-sm text-white/70 transition hover:text-white"
          >
            My Ticket
          </Link>
          <Link
            href="/contact"
            className="text-sm text-white/70 transition hover:text-white"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
