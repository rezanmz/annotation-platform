import { redirect } from "next/navigation";
import AnnotationApp from "@/components/annotation/annotation-app";
import { actor } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  // The sample workspace is intentionally public; everything else requires a session.
  if (params.demo !== "1" && !(await actor())) redirect("/login");
  return <AnnotationApp />;
}
