import { handle, pdfResponse, service } from "@/lib/server/http";
import { readAnnotatorGuideline } from "@/lib/server/guidelines";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const project = await (await service()).assertMember((await context.params).id, true);
    const bytes = await readAnnotatorGuideline(project.domain);
    return pdfResponse(bytes, `${project.domain}_annotation_guidelines.pdf`);
  });
}
