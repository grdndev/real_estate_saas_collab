import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgrammeForm } from "./programme-form";

export const metadata: Metadata = { title: "Nouveau programme" };

export default function NewProgrammePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/programmes"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour à la liste
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Nouveau programme
        </h1>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgrammeForm />
        </CardContent>
      </Card>
    </div>
  );
}
