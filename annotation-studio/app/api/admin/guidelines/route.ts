import { adminActor, handle } from "@/lib/server/http";
import { GUIDELINE_DOMAINS, guidelineStatus } from "@/lib/server/guidelines";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await adminActor();
    return { guidelines: await Promise.all(GUIDELINE_DOMAINS.map((domain) => guidelineStatus(domain))) };
  });
}
