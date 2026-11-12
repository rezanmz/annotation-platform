import { redirect } from "next/navigation";
import AnnotationApp from "@/components/annotation/annotation-app";
import { actor } from "@/lib/server/http";
import { demoEnabled } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  // The sample workspace is intentionally public; everything else requires a session.
  const demo = params.demo === "1" && demoEnabled();
  if (!demo && !(await actor())) redirect("/login");
  return <AnnotationApp />;
}
