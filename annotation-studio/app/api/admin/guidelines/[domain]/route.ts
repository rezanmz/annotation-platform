import { getDatabase } from "@/lib/server/db";
import { recordAudit } from "@/lib/server/audit";
import { adminActor, handle, pdfResponse, readPdf } from "@/lib/server/http";
import { isGuidelineDomain, readGuideline, removeGuideline, saveGuideline, type GuidelineDomain } from "@/lib/server/guidelines";
import { ApiError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

async function domainFrom(context: { params: Promise<{ domain: string }> }): Promise<GuidelineDomain> {
  const { domain } = await context.params;
  if (!isGuidelineDomain(domain)) throw new ApiError(404, "Guideline not found.");
  return domain;
}

export async function GET(_request: Request, context: { params: Promise<{ domain: string }> }) {
  return handle(async () => {
    await adminActor();
    const domain = await domainFrom(context);
    return pdfResponse(await readGuideline(domain), `${domain}_annotation_guidelines.pdf`);
  });
}

export async function PUT(request: Request, context: { params: Promise<{ domain: string }> }) {
  return handle(async () => {
    const user = await adminActor();
    const domain = await domainFrom(context);
    const bytes = await readPdf(request);
    const status = await saveGuideline(domain, bytes);
    await recordAudit(getDatabase(), user.id, "guideline.upload", domain, { bytes: bytes.byteLength, sha256: status.sha256 });
    return status;
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ domain: string }> }) {
  return handle(async () => {
    const user = await adminActor();
    const domain = await domainFrom(context);
    await removeGuideline(domain);
    await recordAudit(getDatabase(), user.id, "guideline.delete", domain);
    return { ok: true };
  });
}
