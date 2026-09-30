import { describe, it, expect } from 'vitest';
import { healthResponse } from './health';

describe('healthResponse', () => {
  it('sem erro -> status 200 e corpo {"ok":true,"db":true}', () => {
    const res = healthResponse();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it('com erro -> status 503 e corpo {"ok":false}', () => {
    const res = healthResponse(new Error('Falha de conexão com o banco'));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false });
  });

  it('com configuração ausente -> status 503 e corpo {"ok":false}', () => {
    const res = healthResponse('missing_config');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false });
  });

  it('erro com mensagem sensível -> o corpo nunca contém a mensagem, ID de projeto ou qualquer detalhe', () => {
    const sensitiveError = new Error('Database password123 at project-ref-xyz with secret sb_secret_999');
    const res = healthResponse(sensitiveError);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('password123');
    expect(serialized).not.toContain('project-ref-xyz');
    expect(serialized).not.toContain('sb_secret_999');
  });
});
