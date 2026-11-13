/**
 * Home-screen hero photo. The file is bundled in /public and precached by the service worker,
 * so it shows offline. To change it, replace public/hero-truck.jpg (landscape or portrait both work).
 */
export function HeroTruck({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <img
        src={`${import.meta.env.BASE_URL}hero-truck.jpg`}
        alt="Moving truck at sunset"
        className="absolute inset-0 size-full object-cover object-[center_45%]"
        decoding="async"
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-[var(--bg)]" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" aria-hidden />
    </div>
  );
}
