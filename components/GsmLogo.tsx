/**
 * Logo GSM — dau tick/canh chim + wordmark, ve bang SVG.
 *
 * MOT TONG duy nhat: `currentColor`. Logo that co them mau vang, nhung
 * DESIGN.md chot "khong co mau accent thu hai" va CLAUDE.md quy tac 4 cam
 * tu sinh token mau moi — nen wordmark dung chinh cyan voi do dam khac nhau.
 *
 * Mau lay tu class cha (`text-primary` / `text-primary-dark`), khong go hex.
 */

interface GsmLogoProps {
  /** `mark`: chi canh chim (dung o side rail). `full`: canh chim + chu GREEN SM. */
  variant?: 'mark' | 'full';
  /** Chieu cao, don vi px. */
  size?: number;
  className?: string;
}

/** Canh chim cach dieu — mot net gap khuc nhu dau tick. */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M4 7.5 13.2 25a1.6 1.6 0 0 0 2.9 0L20 17"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 18.5c1.8-4.5 4.8-8 8.5-10.5-1 4.8-3.4 8.6-6.6 11.2a1.6 1.6 0 0 1-2.5-.7Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export function GsmLogo({ variant = 'mark', size = 32, className }: GsmLogoProps) {
  if (variant === 'mark') {
    return (
      <span className={className} aria-label="Green SM" role="img">
        <Mark size={size} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-sm ${className ?? ''}`} role="img" aria-label="Green SM">
      <Mark size={size} />
      {/* Wordmark bang chu that, khong ve path — de doc duoc va an theo font Inter. */}
      <span className="t-display-sm leading-none tracking-normal" style={{ fontSize: size * 0.72 }}>
        GREEN<span className="opacity-60"> SM</span>
      </span>
    </span>
  );
}
