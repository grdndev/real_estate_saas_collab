import * as React from "react";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-equatis-turquoise-700 mb-8 inline-block text-xs font-semibold tracking-widest uppercase"
        >
          Équatis
        </Link>
        <div className="bg-equatis-surface rounded-xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-slate-600">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
