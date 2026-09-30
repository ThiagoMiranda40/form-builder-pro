import { createFileRoute } from '@tanstack/react-router';
import { healthResponse } from '@/lib/health';

export const Route = createFileRoute('/saude')({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env['SUPABASE_URL'];
        const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

        if (!supabaseUrl || !supabaseServiceRoleKey) {
          console.error('[saude] Falha na verificação de saúde: código MISSING_CONFIG');
          const { status, body } = healthResponse('missing_config');
          return Response.json(body, {
            status,
            headers: {
              'Cache-Control': 'no-store',
            },
          });
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { error } = await supabaseAdmin
            .from('forms')
            .select('id', { head: true })
            .limit(1);

          if (error) {
            console.error(`[saude] Falha na verificação de saúde: código ${error.code || 'DB_ERROR'}`);
            const { status, body } = healthResponse(error.code || 'DB_ERROR');
            return Response.json(body, {
              status,
              headers: {
                'Cache-Control': 'no-store',
              },
            });
          }

          const { status, body } = healthResponse();
          return Response.json(body, {
            status,
            headers: {
              'Cache-Control': 'no-store',
            },
          });
        } catch (err: unknown) {
          const errorCode =
            err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
              ? (err as { code: string }).code
              : 'SERVER_ERROR';
          console.error(`[saude] Falha na verificação de saúde: código ${errorCode}`);
          const { status, body } = healthResponse(errorCode);
          return Response.json(body, {
            status,
            headers: {
              'Cache-Control': 'no-store',
            },
          });
        }
      },
    },
  },
});
