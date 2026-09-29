import { ALERT_LEVELS, type AlertLevel } from "@/lib/stats";

/** 만기·연체 등급 표시 (색 + 아이콘 + 글자) */
export default function AlertBadge({ level }: { level: AlertLevel }) {
  const a = ALERT_LEVELS[level];
  return (
    <span className={`badge gap-1 whitespace-nowrap ${a.className}`}>
      <span aria-hidden>{a.icon}</span>
      {a.label}
    </span>
  );
}
