import { cn } from "@/lib/utils";
import { getBadgeMeta, type ContestBadge } from "@/types/contest";

const badgeToneMap: Record<ContestBadge, string> = {
  deadline_urgent: "border-[rgba(184,92,74,0.18)] bg-[rgba(184,92,74,0.08)] text-[var(--danger)]",
  high_prize: "border-[rgba(154,123,27,0.18)] bg-[rgba(154,123,27,0.08)] text-[var(--warning)]",
  student_friendly: "border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] text-[var(--success)]",
  global: "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]",
  trending_ai: "border-[rgba(139,164,216,0.22)] bg-[rgba(139,164,216,0.1)] text-[var(--foreground)]",
  developer_friendly: "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]",
  beginner_friendly: "border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.06)] text-[var(--success)]",
};

interface BadgePillProps {
  badge: ContestBadge;
  className?: string;
}

export function BadgePill({ badge, className }: BadgePillProps) {
  const meta = getBadgeMeta(badge);

  return (
    <span className={cn("badge-pill", badgeToneMap[badge], className)} title={meta.description}>
      {meta.label}
    </span>
  );
}
