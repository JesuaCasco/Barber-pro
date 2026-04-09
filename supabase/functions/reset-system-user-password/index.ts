import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ResetPasswordPayload = {
  userId?: string;
  password?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Faltan variables de entorno de Supabase.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return json({ error: 'No se recibió token de autenticación.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: actor },
      error: actorError,
    } = await admin.auth.getUser(token);

    if (actorError || !actor) {
      return json({ error: 'No se pudo validar la sesión actual.' }, 401);
    }

    const { data: actorRoles, error: actorRolesError } = await admin
      .from('user_roles')
      .select('role_name')
      .eq('user_id', actor.id);

    if (actorRolesError) {
      return json({ error: actorRolesError.message || 'No se pudieron validar los permisos.' }, 403);
    }

    const actorIsSuperAdmin = (actorRoles || []).some((row) => row.role_name === 'super_admin');
    const actorIsAdmin = actorIsSuperAdmin || (actorRoles || []).some((row) => row.role_name === 'admin');
    if (!actorIsAdmin) {
      return json({ error: 'Solo un administrador puede restablecer contraseñas.' }, 403);
    }

    const payload = (await req.json()) as ResetPasswordPayload;
    const userId = `${payload.userId || ''}`.trim();
    const password = `${payload.password || ''}`;

    if (!userId || !password) {
      return json({ error: 'Faltan datos para restablecer la contraseña.' }, 400);
    }

    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await admin
      .from('profiles')
      .select('id, barbershop_id')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      return json({ error: 'No se encontró el perfil del usuario.' }, 404);
    }

    const { data: targetRoles, error: targetRolesError } = await admin
      .from('user_roles')
      .select('role_name')
      .eq('user_id', userId);

    if (targetRolesError) {
      return json({ error: targetRolesError.message || 'No se pudieron validar los roles del usuario.' }, 403);
    }

    const targetIsSuperAdmin = (targetRoles || []).some((row) => row.role_name === 'super_admin');
    const targetIsAdmin = (targetRoles || []).some((row) => row.role_name === 'admin');

    if (!actorIsSuperAdmin) {
      const { data: actorProfile, error: actorProfileError } = await admin
        .from('profiles')
        .select('barbershop_id')
        .eq('id', actor.id)
        .maybeSingle();

      if (actorProfileError) {
        return json({ error: actorProfileError.message || 'No se pudo validar la barbería del administrador.' }, 403);
      }

      if (!actorProfile?.barbershop_id || actorProfile.barbershop_id !== targetProfile.barbershop_id) {
        return json({ error: 'Solo puedes gestionar usuarios de tu barbería.' }, 403);
      }

      if (targetIsSuperAdmin || targetIsAdmin) {
        return json({ error: 'El administrador de barbería solo puede restablecer contraseñas de usuarios Caja.' }, 403);
      }
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        must_change_password: true,
      },
    });

    if (updateError) {
      return json({ error: updateError.message || 'No se pudo restablecer la contraseña.' }, 400);
    }

    return json({ ok: true, userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al restablecer la contraseña.';
    return json({ error: message }, 500);
  }
});
