export const STYLIST_REASON_META = "stylist-closure-v1";

export function encodeStylistReason(reasonText: string | null | undefined, stylistId: string) {
  return JSON.stringify({
    type: STYLIST_REASON_META,
    version: 1,
    stylistId,
    label: reasonText ?? "",
    encodedAt: new Date().toISOString(),
  });
}

export function decodeStylistReason(reasonValue: any) {
  if (!reasonValue || typeof reasonValue !== "string") return null;
  const trimmed = reasonValue.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && (parsed.stylistId || parsed.type === STYLIST_REASON_META)) {
      return {
        stylistId: typeof parsed.stylistId === "string" ? parsed.stylistId : null,
        label: typeof parsed.label === "string" ? parsed.label : "",
      };
    }
  } catch (error) {
    console.warn("[decodeStylistReason] Impossible de parser reason:", error);
  }
  return null;
}

export function normalizeClosedDateRecord(record: any) {
  if (!record) return record;
  const normalized = { ...record };
  const parsed = decodeStylistReason(record.reason);
  if (parsed) {
    normalized.reason = parsed.label || "";
    if (!normalized.stylist_id && parsed.stylistId) {
      normalized.stylist_id = parsed.stylistId;
    }
    normalized._hasEncodedStylist = true;
  }
  return normalized;
}




