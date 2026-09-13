import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  like: <path d="M8 10l4-7h2v6h6v11H8zM3 10h5v10H3z" />,
  dislike: <path d="M8 14l4 7h2v-6h6V4H8zM3 14h5V4H3z" />,
  bell: (
    <>
      <path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5zM10 21h4" />
    </>
  ),
  shield: <path d="M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z" />,
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  market: (
    <>
      <path d="M3 3v18h18M6 15l5-5 4 3 6-8" />
      <path d="M16 5h5v5" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  holdings: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16l2 12v4H2v-4L4 4ZM2 15h6l2 3h4l2-3h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  sources: (
    <>
      <path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  microphone: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  learn: (
    <>
      <path d="m2 9 10-6 10 6-10 6zM6 12v6l6 3 6-3v-6M22 9v8" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.overview}
    </svg>
  );
}
export function money(minor: string) {
  const value = BigInt(minor);
  return `₹${new Intl.NumberFormat('en-IN').format(value / 100n)}.${(value % 100n).toString().padStart(2, '0')}`;
}
export function shortDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Not yet saved';
}
