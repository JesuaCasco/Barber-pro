import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateUserPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  roleName?: string;
  barbershopId?: string | null;
  branchId?: string | null;
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
      return json({ error: 'Solo un usuario administrador puede crear usuarios.' }, 403);
    }

    const payload = (await req.json()) as CreateUserPayload;
    const email = `${payload.email || ''}`.trim().toLowerCase();
    const password = `${payload.password || ''}`;
    const fullName = `${payload.fullName || ''}`.trim();
    const roleName = `${payload.roleName || ''}`.trim();
    const barbershopId = payload.barbershopId || null;
    const branchId = payload.branchId || null;

    if (!email || !password || !fullName || !roleName) {
      return json({ error: 'Faltan campos obligatorios para crear el usuario.' }, 400);
    }

    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
    }
    if (!['admin', 'cashier'].includes(roleName)) {
      return json({ error: 'Rol no permitido.' }, 400);
    }

    const { data: actorProfile, error: actorProfileError } = await admin
      .from('profiles')
      .select('barbershop_id, branch_id')
      .eq('id', actor.id)
      .maybeSingle();

    if (actorProfileError) {
      return json({ error: actorProfileError.message || 'No se pudo validar la barber?a del usuario actual.' }, 403);
    }

    const normalizedBarbershopId = actorIsSuperAdmin ? barbershopId : actorProfile?.barbershop_id || null;
    const normalizedBranchId = actorIsSuperAdmin ? branchId : branchId || actorProfile?.branch_id || null;

    if (!actorIsSuperAdmin && roleName !== 'cashier') {
      return json({ error: 'El administrador de barber?a solo puede crear usuarios de caja.' }, 403);
    }

    if (!normalizedBarbershopId) {
      return json({ error: 'Debes asignar una barber?a a este usuario.' }, 400);
    }

    if (normalizedBranchId) {
      const { data: branch, error: branchError } = await admin
        .from('branches')
        .select('id, barbershop_id')
        .eq('id', normalizedBranchId)
        .maybeSingle();

      if (branchError || !branch) {
        return json({ error: 'La sucursal seleccionada no existe.' }, 400);
      }

      if (branch.barbershop_id !== normalizedBarbershopId) {
        return json({ error: 'La sucursal no pertenece a la barbería seleccionada.' }, 400);
      }
    }

    const { data: createdAuthUser, error: createAuthError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
      },
    });

    if (createAuthError || !createdAuthUser.user) {
      return json({ error: createAuthError?.message || 'No se pudo crear la cuenta en Auth.' }, 400);
    }

    const newUser = createdAuthUser.user;

    const { error: profileError } = await admin.from('profiles').upsert(
      [{
        id: newUser.id,
        email,
        full_name: fullName,
        barbershop_id: normalizedBarbershopId,
        branch_id: normalizedBranchId,
      }],
      { onConflict: 'id' },
    );

    if (profileError) {
      return json({ error: profileError.message || 'No se pudo crear el perfil.' }, 400);
    }

    const { error: roleError } = await admin.from('user_roles').insert({
      user_id: newUser.id,
      role_name: roleName,
    });

    if (roleError) {
      return json({ error: roleError.message || 'No se pudo asignar el rol.' }, 400);
    }

    return json({
      id: newUser.id,
      email,
      fullName,
      roleName,
      barbershopId: normalizedBarbershopId,
      branchId: normalizedBranchId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al crear el usuario.';
    return json({ error: message }, 500);
  }
});
