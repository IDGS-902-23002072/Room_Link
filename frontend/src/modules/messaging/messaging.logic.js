export function validateMessage(body) { const normalized = body.trim(); return normalized.length < 1 || normalized.length > 4000 ? { error: "El mensaje debe tener entre 1 y 4000 caracteres.", body: normalized } : { error: null, body: normalized }; }
export function normalizeHistory(messages) { return [...messages].sort((left, right) => left.id - right.id); }
