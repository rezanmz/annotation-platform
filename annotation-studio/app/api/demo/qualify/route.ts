import { handle, readJson } from "@/lib/server/http";
import { ApiError, object, validateAnswers } from "@/lib/server/validation";
import { qualificationKeys } from "@/lib/server/keys";

export const dynamic = "force-dynamic";

// Grades the sample test server-side without putting answers in the browser bundle.
// This endpoint never creates a live qualification or membership.
export async function POST(request: Request) {
  return handle(async () => {
    const answers = validateAnswers(object(await readJson(request)).answers);
    const key = qualificationKeys()?.answers.legal;
    if (!key) throw new ApiError(503, "The sample qualification test is not configured on this server.");
    const correct = key.reduce((count, answer, index) => count + (answers[String(index + 1)] === answer ? 1 : 0), 0);
    return { passed: correct === key.length, correct, total: key.length };
  });
}
