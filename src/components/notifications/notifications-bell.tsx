import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function NotificationsBell() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <button
        type="button"
        aria-label="Notifications"
        className="text-equatis-night-700 inline-flex size-9 items-center justify-center rounded-md"
        disabled
      >
        <Bell className="size-4" aria-hidden />
      </button>
    );
  }

  const unread = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0 ? `${unread} notifications non lues` : "Notifications"
      }
      className="text-equatis-night-700 hover:bg-equatis-night-50 relative inline-flex size-9 items-center justify-center rounded-md transition"
    >
      <Bell className="size-4" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="bg-equatis-turquoise-500 absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
