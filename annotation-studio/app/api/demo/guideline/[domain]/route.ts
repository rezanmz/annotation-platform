import { handle, pdfResponse } from "@/lib/server/http";
import { readGuideline } from "@/lib/server/guidelines";
import { ApiError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

// Only the two reference guides are available in sample mode.
// Private dataset documents and annotations always require project membership.
export async function GET(_request: Request, context: { params: Promise<{ domain: string }> }) {
  return handle(async () => {
    const { domain } = await context.params;
    if (domain !== "legal" && domain !== "chemistry") throw new ApiError(404, "Guideline not found.");
    const bytes = await readGuideline(domain);
    return pdfResponse(bytes, `${domain}_annotation_guidelines.pdf`);
  });
}
