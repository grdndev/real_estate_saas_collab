"use client";

import { useRouter } from "next/navigation";

interface Props {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function ClickableRow({ href, className, children }: Props) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer ${className ?? ""}`}
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
