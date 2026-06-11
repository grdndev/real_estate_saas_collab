import { prisma } from "@/lib/prisma";
import ActivityLog from "./activity-log";

export default async function AdminLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true } } },
    take: 1000,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Journal d&apos;activité
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Suivez les actions des utilisateurs et les événements système.
        </p>
      </div>
      <ActivityLog logs={logs} />
    </div>
  );
}
