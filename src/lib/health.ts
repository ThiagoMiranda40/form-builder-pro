export type HealthResponseBody =
  | { ok: true; db: true }
  | { ok: false };

export interface HealthResult {
  status: 200 | 503;
  body: HealthResponseBody;
}

/**
 * Função pura que determina o status e o corpo da resposta de saúde.
 * - Sem erro -> status 200 e corpo {"ok": true, "db": true}
 * - Com erro ou configuração ausente -> status 503 e corpo {"ok": false}
 *
 * O corpo NUNCA contém mensagem de erro, ID de projeto ou qualquer detalhe.
 */
export function healthResponse(error?: unknown): HealthResult {
  if (error !== undefined && error !== null) {
    return {
      status: 503,
      body: { ok: false },
    };
  }

  return {
    status: 200,
    body: { ok: true, db: true },
  };
}
