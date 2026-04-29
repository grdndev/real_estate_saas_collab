import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notaire",
};

export default function NotaireHomePage() {
  return (
    <main id="main" className="px-6 py-10">
      <h1 className="text-equatis-night-800 text-2xl font-semibold">
        Espace Notaire
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Liste des dossiers reçus (à implémenter en Phase 3).
      </p>
    </main>
  );
}
