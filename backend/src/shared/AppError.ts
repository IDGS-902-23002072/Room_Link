export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 423 | 503 = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorResponse = (error: unknown): { error: string; code: string; status: number } => {
  if (error instanceof AppError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  return { error: "Error interno del servidor", code: "INTERNAL_ERROR", status: 500 };
};
