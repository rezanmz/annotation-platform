import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { actor } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await actor())) redirect("/login");
  return children;
}
