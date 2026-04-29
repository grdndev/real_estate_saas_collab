import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collaborateur",
};

export default function CollaborateurHomePage() {
  return (
    <main id="main" className="px-6 py-10">
      <h1 className="text-equatis-night-800 text-2xl font-semibold">
        Espace Collaborateur
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Tableau de bord opérationnel (à implémenter en Phase 2).
      </p>
    </main>
  );
}
