import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-surface-raised text-ink-muted",
        drive: "bg-drive-soft text-drive",
        charge: "bg-charge-soft text-charge",
        battery: "bg-battery-soft text-battery",
        efficiency: "bg-efficiency-soft text-efficiency",
        alert: "bg-alert-soft text-alert",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

export function Badge({ className, tone, pulse, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {pulse && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />}
      {props.children}
    </span>
  );
}
