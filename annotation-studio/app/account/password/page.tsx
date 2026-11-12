import { redirect } from "next/navigation";
import PasswordForm from "@/components/auth/password-form";
import { actor } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  if (!(await actor())) redirect("/login");
  return <PasswordForm />;
}
