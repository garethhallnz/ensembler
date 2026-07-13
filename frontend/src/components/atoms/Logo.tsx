interface LogoProps {
  /** Tailwind size + color classes. The ring uses `currentColor`, so set a text
   *  color (e.g. text-gray-400 dark:text-gray-500) to tune it per background. */
  className?: string;
}

// The Ensembler mark: a coordinating hub at the centre, services on the ring
// around it. Inline SVG so it stays sharp at any size and the ring can adapt to
// the surrounding text color. The ensemble hues and the amber hub are fixed —
// they read on both light and dark grounds.
export default function Logo({ className = 'w-9 h-9 text-gray-400 dark:text-gray-500' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Ensembler"
      fill="none"
    >
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3.4" />
      <circle cx="50" cy="20" r="7.5" fill="#2DAF9E" />
      <circle cx="76" cy="65" r="7.5" fill="#EC6A5B" />
      <circle cx="24" cy="65" r="7.5" fill="#6C7BE0" />
      <circle cx="50" cy="50" r="11" stroke="#E9963C" strokeWidth="4.5" />
      <circle cx="50" cy="50" r="3.5" fill="#E9963C" />
    </svg>
  );
}
