import { prisma } from "@/lib/prisma";
import ActivityLog from "./activity-log";
import Link from "next/link";

export default async function AdminUserLogsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <Link
            href="/admin/logs"
            className="text-equatis-night-800 text-sm hover:underline"
          >
            ← Retour à la liste des utilisateurs
          </Link>
        </div>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    where: { userId: id },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/logs"
          className="text-equatis-night-800 text-sm hover:underline"
        >
          ← Retour à la liste des utilisateurs
        </Link>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Journal d&apos;activité: {user.firstName} {user.lastName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Suivez les actions des utilisateurs et les événements système.
        </p>
      </div>
      <ActivityLog logs={logs} />
    </div>
  );
}
