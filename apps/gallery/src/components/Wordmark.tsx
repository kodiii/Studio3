// Its own module so pages without the site header (the full-screen demo frame) do not load the header to draw it.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-[-0.04em] ${className}`}>
      Maquette<span className="font-serif font-normal italic tracking-normal text-signal">kit</span>
    </span>
  );
}
