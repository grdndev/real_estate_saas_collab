import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-700",
        info: "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
        success: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
        warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        danger: "bg-red-50 text-red-800 ring-1 ring-red-200",
        accent:
          "bg-equatis-turquoise-50 text-equatis-turquoise-800 ring-1 ring-equatis-turquoise-200",
        primary:
          "bg-equatis-night-50 text-equatis-night-800 ring-1 ring-equatis-night-100",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
