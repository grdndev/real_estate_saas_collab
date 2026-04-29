import { AuthHeader } from "@/components/layout/auth-header";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
