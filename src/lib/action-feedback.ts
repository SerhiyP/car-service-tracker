function firstValidationKey(errors: unknown): string | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const record = errors as Record<string, unknown> & { _errors?: string[] };
  if (Array.isArray(record._errors) && record._errors.length > 0) {
    return record._errors[0];
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "_errors") continue;
    const nested = firstValidationKey(value);
    if (nested) return nested;
  }
  return undefined;
}

/** Maps a next-safe-action result to a translatable error key, or null on success. */
export function actionErrorKey(
  result:
    | { data?: unknown; serverError?: string; validationErrors?: unknown }
    | undefined
    | null,
): string | null {
  if (result?.data !== undefined) return null;
  return (
    result?.serverError ??
    firstValidationKey(result?.validationErrors) ??
    "errors.offline"
  );
}
