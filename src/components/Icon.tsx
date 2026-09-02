"use client";

type IconProps = { size?: number; className?: string };

const paths: Record<string, string> = {
  public:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.93A8.01 8.01 0 0 1 4.07 13H7v2a2 2 0 0 0 2 2h2v2.93zM18.9 16H17a2 2 0 0 0-2-2h-1v-3h4.32a8 8 0 0 1 .58 5zM11 9V7h2V5h-2V4.07A8 8 0 0 1 18.32 9H11z",
  article:
    "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8 17h5v-2H8v2zm8-4H8v-2h8v2zm0-4H8V7h8v2z",
  shield:
    "M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5l-8-3zm0 10.5h5.2c-.6 3.2-2.7 6-5.2 7v-7H6.8V6.4L12 4.4v8.1z",
  security:
    "M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
  bolt: "M11 21h-1l1-7H6.5c-.9 0-.3-.8-.3-.8C8 10.3 10.4 6.2 13 2h1l-1 7h4.5c.9 0 .3.8.3.8-1.9 3-4.5 7.2-6.8 11.2z",
  drop: "M12 2C8 6.3 6 9.7 6 12.4A6 6 0 0 0 12 18a6 6 0 0 0 6-5.6C18 9.7 16 6.3 12 2zm0 14a4 4 0 0 1-4-3.6c0-1.7 1.4-4.3 4-7.3 2.6 3 4 5.6 4 7.3A4 4 0 0 1 12 16z",
  trending:
    "M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6h-6z",
  radar:
    "M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2zm0 4a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4V6zm0 4a2 2 0 1 0 2 2h-2v-2z",
  refresh:
    "M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  close:
    "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z",
  open: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3h-7z",
  search:
    "M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z",
  place:
    "M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  schedule:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z",
  insights:
    "M21 8a2 2 0 0 1-2-2 2 2 0 1 1 2 2zm-6.9 2.1a2 2 0 0 1-3.1 1.7l-2.4 2.4A2 2 0 1 1 5 13.5l2.4-2.4a2 2 0 0 1 2.7-2.4L12.5 6A2 2 0 1 1 16 8.4l-1.9 1.7zM3 21h18v-2H3v2z",
  layers:
    "m12 16.5 7.4-5.8 1.6 1.3-9 7-9-7 1.6-1.2 7.4 5.7zM12 2l9 7-9 7-9-7 9-7zm0 2.5L6.2 9 12 13.5 17.8 9 12 4.5z",
};

export function Icon({ name, size = 20, className }: IconProps & { name: keyof typeof paths | string }) {
  const d = paths[name] ?? paths.article;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export function WatchfloorMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#6d3c00" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#ffb77c" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="4.5" fill="#ffb77c" />
      <path d="M16 1v6M16 25v6M1 16h6M25 16h6" stroke="#7fd6c9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
