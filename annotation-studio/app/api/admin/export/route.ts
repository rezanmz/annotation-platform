import { handle, json, service } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const language = params.get("language");
    const exported = await (await service()).export(params.get("projectId") ?? "", language);
    const filename = [exported.project.id, language, "annotations"].filter(Boolean).join("-");
    return json(exported, 200, { "Content-Disposition": `attachment; filename="${filename}.json"` });
  });
}
