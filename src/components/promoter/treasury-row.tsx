"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { upsertTreasuryEntryAction } from "@/lib/promoter/actions";

interface Props {
  programmeId: string;
  monthIso: string; // YYYY-MM
  monthLabel: string;
  initialIncome: number;
  initialExpense: number;
}

export function TreasuryRow({
  programmeId,
  monthIso,
  monthLabel,
  initialIncome,
  initialExpense,
}: Props) {
  const router = useRouter();
  const [income, setIncome] = useState(String(initialIncome));
  const [expense, setExpense] = useState(String(initialExpense));
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const incomeNum = parseFloat(income) || 0;
  const expenseNum = parseFloat(expense) || 0;
  const balance = incomeNum - expenseNum;
  const dirty = incomeNum !== initialIncome || expenseNum !== initialExpense;

  function save() {
    startTransition(async () => {
      const result = await upsertTreasuryEntryAction({
        programmeId,
        month: monthIso,
        income: incomeNum,
        expense: expenseNum,
      });
      if (result.ok) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 3000);
        router.refresh();
      }
    });
  }

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="px-4 py-2 text-sm font-medium">{monthLabel}</td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          className="h-9 text-right"
          aria-label={`Entrées prévisionnelles ${monthLabel}`}
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={expense}
          onChange={(e) => setExpense(e.target.value)}
          className="h-9 text-right"
          aria-label={`Dépenses prévisionnelles ${monthLabel}`}
        />
      </td>
      <td
        className={`px-4 py-2 text-right text-sm font-medium ${balance < 0 ? "text-red-700" : "text-emerald-700"}`}
      >
        {balance.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        })}
      </td>
      <td className="px-4 py-2 text-right">
        <Button
          size="sm"
          variant={dirty ? "primary" : "ghost"}
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? "…" : justSaved ? "✓" : "Enregistrer"}
        </Button>
      </td>
    </tr>
  );
}
