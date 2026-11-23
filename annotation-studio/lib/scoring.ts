export const cannotAssessReasons = {
  missing_material: "Missing material",
  insufficient_expertise: "Insufficient expertise",
} as const;

export type CannotAssessReason = keyof typeof cannotAssessReasons;

export function isCannotAssessReason(value: unknown): value is CannotAssessReason {
  return typeof value === "string" && Object.hasOwn(cannotAssessReasons, value);
}

export function requiresComment(score: number | null | undefined) {
  return score === null || score === 1 || score === 2 || score === 3;
}
