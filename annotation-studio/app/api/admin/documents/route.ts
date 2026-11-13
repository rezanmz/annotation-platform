import { adminActor, handle } from "@/lib/server/http";
import { AnnotationService } from "@/lib/server/service";
import { getDatabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await adminActor();
    const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
    if (!projectId) throw new ApiError(400, "A project is required.");
    return new AnnotationService(getDatabase(), { id: user.id, name: user.name, email: user.email, isAdmin: true }).listDocuments(projectId);
  });
}
