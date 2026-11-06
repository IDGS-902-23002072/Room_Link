export function validateDecision(decision, reason) {
  if (!["approved", "rejected", "removed"].includes(decision)) return "Selecciona una decisión válida.";
  return decision !== "approved" && !reason.trim() ? "El rechazo o la baja requieren un motivo." : null;
}
export function isListingReport(report) { return Boolean(report.listingId) && !report.targetUserId && !report.targetMessageId; }
