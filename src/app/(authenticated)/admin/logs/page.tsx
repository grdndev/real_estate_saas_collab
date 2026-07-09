import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminLogsPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
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
      <div>
        {users.map((user) => (
          <Link key={user.id} href={`/admin/logs/${user.id}`} className="mb-4">
            <h2 className="text-equatis-night-800 text-lg font-medium">
              {user.firstName} {user.lastName}
            </h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
