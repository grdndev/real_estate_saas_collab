import Link from "next/link";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-2xl text-center">
        <p className="text-equatis-turquoise-600 text-sm font-semibold tracking-widest uppercase">
          Équatis
        </p>
        <h1 className="text-equatis-night-800 mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Plateforme de coordination immobilière
        </h1>
        <p className="mt-6 text-base text-slate-600 sm:text-lg">
          Espace privé sécurisé. Réservé aux collaborateurs Équatis, aux
          promoteurs partenaires, aux notaires et aux clients acquéreurs.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/connexion"
            className="bg-equatis-night-800 hover:bg-equatis-night-900 inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium text-white transition"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="text-equatis-night-800 ring-equatis-night-200 hover:bg-equatis-night-50 inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium ring-1 transition"
          >
            Créer un compte client
          </Link>
        </div>

        <p className="mt-12 text-xs text-slate-500">
          Phase 1 — Setup en cours. CDC v1.0 du 13 avril 2026.
        </p>
      </div>
    </main>
  );
}
