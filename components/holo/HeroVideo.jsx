export function HeroVideo() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#1a0a2b] via-[#0a0518] to-black">
      <video
        className="h-full w-full object-cover opacity-50"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      >
        <source src="/hero-party.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
      <div className="animate-sweep absolute inset-y-0 -inset-x-1/3 bg-gradient-to-r from-transparent via-[#9b5cff]/20 to-transparent" />
    </div>
  );
}
