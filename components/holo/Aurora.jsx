export function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,#0a0014_0%,#000_60%)]">
      <div className="animate-aurora absolute -left-1/4 top-[-20%] h-[70vh] w-[70vh] rounded-full bg-[#00f0ff] opacity-25 blur-[120px]" />
      <div
        className="animate-aurora absolute -right-1/4 top-[10%] h-[80vh] w-[80vh] rounded-full bg-[#ff2ed1] opacity-25 blur-[140px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-aurora absolute left-[20%] bottom-[-20%] h-[70vh] w-[70vh] rounded-full bg-[#9b5cff] opacity-25 blur-[130px]"
        style={{ animationDelay: "-12s" }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 3px)",
        }}
      />
    </div>
  );
}
