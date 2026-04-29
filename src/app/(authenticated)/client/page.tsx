import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon espace",
};

export default function ClientHomePage() {
  return (
    <main id="main" className="px-6 py-10">
      <h1 className="text-equatis-night-800 text-2xl font-semibold">
        Mon espace acquéreur
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Suivi de mon dossier (à implémenter en Phase 2).
      </p>
    </main>
  );
}
