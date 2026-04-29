import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "bg-equatis-surface text-slate-900",
      "h-11 w-full rounded-md border border-slate-300 px-3 text-sm",
      "focus-visible:border-equatis-turquoise-500 focus-visible:outline-equatis-turquoise-500",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "aria-[invalid=true]:border-red-500",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
