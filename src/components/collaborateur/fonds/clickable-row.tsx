"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function ClickableRow({ href, className, children }: Props) {
  const router = useRouter();
  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors hover:bg-slate-50/50",
        className,
      )}
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
