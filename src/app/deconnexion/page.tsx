import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";

export default async function DeconnexionPage() {
  await logoutAction();
  redirect("/connexion?reason=logged_out");
}
