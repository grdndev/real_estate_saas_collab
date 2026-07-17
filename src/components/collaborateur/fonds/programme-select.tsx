"use client";

import { useRouter } from "next/navigation";

interface ProgrammeOption {
  id: string;
  name: string;
}

interface Props {
  programmes: ProgrammeOption[];
  selectedId: string | null;
  basePath?: string;
}

export function ProgrammeSelect({
  programmes,
  selectedId,
  basePath = "/collaborateur/fonds",
}: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val) router.push(`${basePath}?programme=${val}`);
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={handleChange}
      className="focus:border-equatis-turquoise-400 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
    >
      {!selectedId && <option value="">— Sélectionner un programme —</option>}
      {programmes.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
