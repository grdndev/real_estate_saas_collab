import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "bg-equatis-surface text-slate-900 placeholder:text-slate-400",
      "h-11 w-full rounded-md border border-slate-300 px-3 text-sm",
      "focus-visible:border-equatis-turquoise-500 focus-visible:outline-equatis-turquoise-500",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:outline-red-500",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "bg-equatis-surface text-slate-900 placeholder:text-slate-400",
      "min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm",
      "focus-visible:border-equatis-turquoise-500 focus-visible:outline-equatis-turquoise-500",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:outline-red-500",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
