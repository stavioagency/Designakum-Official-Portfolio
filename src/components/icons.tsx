import type { SVGProps } from "react";
import type { SocialPlatform } from "@/lib/types";

type P = SVGProps<SVGSVGElement>;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Base = ({ children, ...p }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden {...p}>
    {children}
  </svg>
);

/* ------------------------------------------------------------------- social */

export const Instagram = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5.2" {...stroke} />
    <circle cx="12" cy="12" r="4.1" {...stroke} />
    <circle cx="17.2" cy="6.8" r="1.05" fill="currentColor" />
  </Base>
);

export const XIcon = (p: P) => (
  <Base {...p}>
    <path
      d="M3.4 3h4.3l4.28 5.86L16.9 3h3.7l-6.6 7.6L21 21h-4.3l-4.6-6.3L6.9 21H3.2l7-8.06L3.4 3Z"
      fill="currentColor"
    />
  </Base>
);

export const Telegram = (p: P) => (
  <Base {...p}>
    <path
      d="M21.2 4.3 2.9 11.2c-.9.34-.88 1.63.03 1.94l4.5 1.53 1.72 5.1c.25.73 1.18.92 1.7.35l2.4-2.62 4.5 3.3c.6.44 1.45.11 1.6-.62l3-13.9c.17-.8-.6-1.47-1.15-1.98Z"
      fill="currentColor"
      opacity=".92"
    />
    <path d="m7.43 14.67 9.9-6.9-7.9 8.3-.3 3.1" fill="none" stroke="#0b0b12" strokeWidth="1.1" strokeLinejoin="round" opacity=".35" />
  </Base>
);

export const Behance = (p: P) => (
  <Base {...p}>
    <path d="M2.6 6.6h4.6c1.7 0 2.7.8 2.7 2.1 0 1-.5 1.6-1.4 2 1.2.3 1.9 1.1 1.9 2.4 0 1.7-1.2 2.7-3.2 2.7H2.6Z" {...stroke} />
    <path d="M13.4 12.6h6.2c.1-2-1.1-3.4-3-3.4s-3.2 1.4-3.2 3.3 1.2 3.3 3.2 3.3c1.4 0 2.4-.6 2.8-1.6" {...stroke} />
    <path d="M14.6 6.9h4.6" {...stroke} />
  </Base>
);

export const Dribbble = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M5 7.6c4.5 1.3 9 1 12.6-1.2M3.4 14c4.6-1.6 9.6-.4 12.5 3.6M9.2 3.6C13 7.6 15.2 12.8 15.6 20" {...stroke} />
  </Base>
);

export const Linkedin = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4.6" {...stroke} />
    <path d="M7.4 10.4V17M7.4 7.3v.02M11.4 17v-3.7c0-1.6 1-2.6 2.3-2.6s2.3.9 2.3 2.6V17" {...stroke} />
  </Base>
);

export const TikTok = (p: P) => (
  <Base {...p}>
    <path
      d="M14.2 3h2.5c.3 2 1.5 3.3 3.5 3.6v2.5c-1.4.1-2.6-.3-3.6-1.1v5.9c0 3.2-2.2 5.4-5.2 5.4-2.9 0-5-2.1-5-4.9 0-3 2.4-5.2 5.6-4.8v2.7c-1.7-.4-3.1.6-3.1 2.1 0 1.3 1 2.3 2.4 2.3 1.5 0 2.5-1 2.5-2.7V3Z"
      fill="currentColor"
    />
  </Base>
);

export const Youtube = (p: P) => (
  <Base {...p}>
    <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="4.2" {...stroke} />
    <path d="m10.4 9.6 4.6 2.4-4.6 2.4z" fill="currentColor" />
  </Base>
);

export const Snapchat = (p: P) => (
  <Base {...p}>
    <path
      d="M12 3.2c2.6 0 4.2 1.9 4.2 4.4 0 .8-.1 1.5-.1 2 .5.3 1.1.1 1.6 0 .6-.1 1 .6.5 1-.6.5-1.6.8-1.7 1.2-.2.7 2 3.4 3.6 3.8.4.1.4.6 0 .8-.8.3-1.8.4-2.1.8-.2.3-.1.9-.5 1-.5.2-1.6-.3-2.7-.1-1 .2-1.8 1.7-3.3 1.7s-2.3-1.5-3.3-1.7c-1.1-.2-2.2.3-2.7.1-.4-.1-.3-.7-.5-1-.3-.4-1.3-.5-2.1-.8-.4-.2-.4-.7 0-.8 1.6-.4 3.8-3.1 3.6-3.8-.1-.4-1.1-.7-1.7-1.2-.5-.4-.1-1.1.5-1 .5.1 1.1.3 1.6 0 0-.5-.1-1.2-.1-2 0-2.5 1.6-4.4 4.2-4.4Z"
      {...stroke}
    />
  </Base>
);

export const Globe = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M3.2 12h17.6M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" {...stroke} />
  </Base>
);

export const Mail = (p: P) => (
  <Base {...p}>
    <rect x="2.8" y="5" width="18.4" height="14" rx="3.6" {...stroke} />
    <path d="m4.6 8 6.3 4.3c.7.5 1.5.5 2.2 0L19.4 8" {...stroke} />
  </Base>
);

export const Whatsapp = (p: P) => (
  <Base {...p}>
    <path
      d="M12 2.8a9.1 9.1 0 0 0-7.9 13.6L2.9 21l4.8-1.2A9.1 9.1 0 1 0 12 2.8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="M8.9 7.6c.3 0 .5.1.7.5l.7 1.6c.1.3.1.5-.1.8l-.5.6c-.2.2-.2.4-.1.6.5 1 1.5 1.9 2.6 2.4.3.1.5.1.7-.1l.6-.7c.2-.3.4-.3.7-.2l1.6.8c.3.2.4.4.4.7 0 1.1-.9 1.9-2 1.9-3.3 0-6.9-3.7-6.9-6.9 0-1.1.8-2 1.6-2Z"
      fill="currentColor"
    />
  </Base>
);

export const SOCIAL_META: Record<SocialPlatform, { label: string; Icon: (p: P) => React.JSX.Element; prefix?: string }> = {
  instagram: { label: "إنستغرام", Icon: Instagram },
  x: { label: "إكس", Icon: XIcon },
  telegram: { label: "تيليجرام", Icon: Telegram },
  behance: { label: "بيهانس", Icon: Behance },
  dribbble: { label: "دريبل", Icon: Dribbble },
  linkedin: { label: "لينكدإن", Icon: Linkedin },
  tiktok: { label: "تيك توك", Icon: TikTok },
  youtube: { label: "يوتيوب", Icon: Youtube },
  snapchat: { label: "سناب شات", Icon: Snapchat },
  website: { label: "الموقع", Icon: Globe },
  email: { label: "البريد", Icon: Mail, prefix: "mailto:" },
};

/* --------------------------------------------------------------- interface */

export const Share = (p: P) => (
  <Base {...p}>
    <path d="M12 3.4v11M8.4 6.8 12 3.2l3.6 3.6M5.4 12.6v5.2c0 1.3.9 2.2 2.2 2.2h8.8c1.3 0 2.2-.9 2.2-2.2v-5.2" {...stroke} />
  </Base>
);

export const Star = (p: P) => (
  <Base {...p}>
    <path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor" />
  </Base>
);

export const Sparkle = (p: P) => (
  <Base {...p}>
    <path d="M12 3.2 13.6 9 19.4 10.6 13.6 12.2 12 18 10.4 12.2 4.6 10.6 10.4 9z" fill="currentColor" />
    <path d="M18.4 15.2 19.2 17.6 21.6 18.4 19.2 19.2 18.4 21.6 17.6 19.2 15.2 18.4 17.6 17.6z" fill="currentColor" opacity=".7" />
  </Base>
);

export const Briefcase = (p: P) => (
  <Base {...p}>
    <rect x="2.9" y="7" width="18.2" height="13" rx="3.4" {...stroke} />
    <path d="M8.6 7V5.8c0-1 .8-1.8 1.8-1.8h3.2c1 0 1.8.8 1.8 1.8V7M3 12.4h18" {...stroke} />
  </Base>
);

export const Users = (p: P) => (
  <Base {...p}>
    <circle cx="9.4" cy="8.4" r="3.4" {...stroke} />
    <path d="M3.4 19.4c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8M16.4 5.4a3.2 3.2 0 0 1 0 6.1M18 14.9c2 .6 3.4 2.1 3.4 4.5" {...stroke} />
  </Base>
);

export const Clock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M12 7.2V12l3.2 2" {...stroke} />
  </Base>
);

export const Eye = (p: P) => (
  <Base {...p}>
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" {...stroke} />
    <circle cx="12" cy="12" r="3.1" {...stroke} />
  </Base>
);

export const Plus = (p: P) => (
  <Base {...p}>
    <path d="M12 5.4v13.2M5.4 12h13.2" {...stroke} />
  </Base>
);

export const Trash = (p: P) => (
  <Base {...p}>
    <path d="M4.6 6.6h14.8M9.4 6.6V5.4c0-.9.7-1.6 1.6-1.6h2c.9 0 1.6.7 1.6 1.6v1.2M6.6 6.6l.8 12c.06.9.8 1.6 1.7 1.6h5.8c.9 0 1.64-.7 1.7-1.6l.8-12" {...stroke} />
  </Base>
);

export const Pencil = (p: P) => (
  <Base {...p}>
    <path d="M15.6 4.6a2.2 2.2 0 0 1 3.1 0l.7.7a2.2 2.2 0 0 1 0 3.1L9.3 18.5l-4.3 1.2 1.2-4.3z" {...stroke} />
  </Base>
);

export const Check = (p: P) => (
  <Base {...p}>
    <path d="m5 12.6 4.4 4.4L19 7.4" {...stroke} />
  </Base>
);

export const ChevronUp = (p: P) => (
  <Base {...p}>
    <path d="m6.6 14.6 5.4-5.4 5.4 5.4" {...stroke} />
  </Base>
);

export const ChevronDown = (p: P) => (
  <Base {...p}>
    <path d="m6.6 9.4 5.4 5.4 5.4-5.4" {...stroke} />
  </Base>
);

export const ArrowLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5.4M11 5.4 4.6 12l6.4 6.6" {...stroke} />
  </Base>
);

export const Logout = (p: P) => (
  <Base {...p}>
    <path d="M14.6 7.4V5.8c0-1.2-1-2.2-2.2-2.2H6.2C5 3.6 4 4.6 4 5.8v12.4c0 1.2 1 2.2 2.2 2.2h6.2c1.2 0 2.2-1 2.2-2.2v-1.6M9.8 12h10.4M17 8.8l3.4 3.2-3.4 3.2" {...stroke} />
  </Base>
);

export const Shield = (p: P) => (
  <Base {...p}>
    <path d="M12 3.2 5 6v5.8c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6z" {...stroke} />
    <path d="m9.2 12 2 2 3.6-3.8" {...stroke} />
  </Base>
);

export const Image = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4.6" width="18" height="14.8" rx="3.6" {...stroke} />
    <circle cx="8.6" cy="9.6" r="1.6" {...stroke} />
    <path d="m3.8 17.4 4.4-4a2 2 0 0 1 2.7 0l3.5 3.2a2 2 0 0 0 2.7 0l3.1-2.8" {...stroke} />
  </Base>
);

export const Link = (p: P) => (
  <Base {...p}>
    <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3" {...stroke} />
  </Base>
);

export const STAT_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  star: Star,
  briefcase: Briefcase,
  users: Users,
  clock: Clock,
  sparkle: Sparkle,
  eye: Eye,
};

export const STAT_ICON_OPTIONS = [
  { value: "star", label: "تقييم" },
  { value: "briefcase", label: "أعمال" },
  { value: "users", label: "عملاء" },
  { value: "clock", label: "خبرة" },
  { value: "sparkle", label: "تميّز" },
  { value: "eye", label: "مشاهدات" },
  { value: "", label: "بدون أيقونة" },
];

/* ------------------------------------------------------------------ console */

export const Grid = (p: P) => (
  <Base {...p}>
    <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2.2" {...stroke} />
    <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2.2" {...stroke} />
    <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2.2" {...stroke} />
    <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2.2" {...stroke} />
  </Base>
);

export const Flag = (p: P) => (
  <Base {...p}>
    <path d="M5.6 21V4.2M5.6 5.2h10.7l-1.7 3.4 1.7 3.4H5.6" {...stroke} />
  </Base>
);

export const LifeBuoy = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.8" {...stroke} />
    <circle cx="12" cy="12" r="3.6" {...stroke} />
    <path d="m5.9 5.9 3.6 3.6M14.5 14.5l3.6 3.6M18.1 5.9l-3.6 3.6M9.5 14.5l-3.6 3.6" {...stroke} />
  </Base>
);

export const Gift = (p: P) => (
  <Base {...p}>
    <rect x="3" y="8.6" width="18" height="12.2" rx="2.6" {...stroke} />
    <path d="M3 13h18M12 8.6V21" {...stroke} />
    <path d="M12 8.6S10.6 4 8.2 4a2.2 2.2 0 0 0 0 4.6zM12 8.6S13.4 4 15.8 4a2.2 2.2 0 0 1 0 4.6z" {...stroke} />
  </Base>
);

export const CreditCard = (p: P) => (
  <Base {...p}>
    <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="3" {...stroke} />
    <path d="M2.6 9.8h18.8M6.4 14.6h3.4" {...stroke} />
  </Base>
);

export const BarChart = (p: P) => (
  <Base {...p}>
    <path d="M4 20.4V13M9.4 20.4V7.4M14.8 20.4v-9M20.2 20.4V4.6" {...stroke} />
  </Base>
);

export const History = (p: P) => (
  <Base {...p}>
    <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1L3.4 8.6" {...stroke} />
    <path d="M3.2 4.6v4.2h4.2M12 7.6V12l3 1.8" {...stroke} />
  </Base>
);

export const Megaphone = (p: P) => (
  <Base {...p}>
    <path d="M4 10.2v3.6a2 2 0 0 0 2 2h1.6l9.6 4.2V4L7.6 8.2H6a2 2 0 0 0-2 2Z" {...stroke} />
    <path d="M19.4 9.2a3.4 3.4 0 0 1 0 5.6M7.6 16v4.2" {...stroke} />
  </Base>
);

export const Sliders = (p: P) => (
  <Base {...p}>
    <path d="M4 7.4h16M4 12h16M4 16.6h16" {...stroke} />
    <circle cx="9" cy="7.4" r="2" {...stroke} />
    <circle cx="15" cy="12" r="2" {...stroke} />
    <circle cx="7.4" cy="16.6" r="2" {...stroke} />
  </Base>
);

export const Search = (p: P) => (
  <Base {...p}>
    <circle cx="10.8" cy="10.8" r="6.6" {...stroke} />
    <path d="m15.8 15.8 4 4" {...stroke} />
  </Base>
);

export const X = (p: P) => (
  <Base {...p}>
    <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" {...stroke} />
  </Base>
);

export const AlertTriangle = (p: P) => (
  <Base {...p}>
    <path d="M10.3 4.3 2.9 17.2a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" {...stroke} />
    <path d="M12 9.6v4.2M12 17.2v.02" {...stroke} />
  </Base>
);

export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9.6 6.6 5.4 5.4-5.4 5.4" {...stroke} />
  </Base>
);

export const ChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="m14.4 6.6-5.4 5.4 5.4 5.4" {...stroke} />
  </Base>
);

export const ExternalLink = (p: P) => (
  <Base {...p}>
    <path d="M14 4.6h5.4V10M19.4 4.6 11.6 12.4" {...stroke} />
    <path d="M18.4 14v4.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2H10" {...stroke} />
  </Base>
);

export const Ban = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.8" {...stroke} />
    <path d="m5.8 5.8 12.4 12.4" {...stroke} />
  </Base>
);

export const Wallet = (p: P) => (
  <Base {...p}>
    <path d="M3.4 7.6a2.4 2.4 0 0 1 2.4-2.4h11a2 2 0 0 1 2 2v1.4" {...stroke} />
    <rect x="3.4" y="7.6" width="17.2" height="11.8" rx="2.6" {...stroke} />
    <circle cx="16.6" cy="13.4" r="1.2" fill="currentColor" />
  </Base>
);

export const Bell = (p: P) => (
  <Base {...p}>
    <path d="M18 9.4a6 6 0 0 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" {...stroke} />
    <path d="M13.7 19.4a2 2 0 0 1-3.4 0" {...stroke} />
  </Base>
);
