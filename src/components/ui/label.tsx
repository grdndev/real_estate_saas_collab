import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-equatis-night-800 mb-1.5 block text-sm font-medium",
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span aria-hidden className="ml-0.5 text-red-600">
        *
      </span>
    )}
  </label>
));
Label.displayName = "Label";
