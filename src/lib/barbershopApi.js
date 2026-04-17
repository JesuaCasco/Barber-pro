import { isPromotionService } from '../features/app/shared';
import { hasSupabaseConfig, supabase, supabasePublishableKey, supabaseUrl } from './supabase';

const STATUS_TO_DB = {
  Confirmada: 'confirmada',
  'En Espera': 'en_espera',
  'En Corte': 'en_corte',
  Finalizada: 'finalizada',
  Cancelada: 'cancelada',
  'Cita Perdida': 'cita_perdida',
};

const STATUS_FROM_DB = {
  confirmada: 'Confirmada',
  en_espera: 'En Espera',
  en_corte: 'En Corte',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  cita_perdida: 'Cita Perdida',
};

const normalizeDbStatus = (status) => {
  if (!status) return 'Confirmada';

  const rawStatus = `${status}`.trim();
  const normalizedKey = rawStatus
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return (
    STATUS_FROM_DB[normalizedKey]
    || STATUS_FROM_DB[rawStatus]
    || STATUS_TO_DB[rawStatus] && rawStatus
    || {
      'en espera': 'En Espera',
      'en corte': 'En Corte',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      confirmada: 'Confirmada',
      'cita perdida': 'Cita Perdida',
    }[rawStatus.toLowerCase()]
    || 'Confirmada'
  );
};

const safeTime = (value = '00:00') => `${value}`.slice(0, 5);
const formatDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};
const OPERATIONAL_APPOINTMENTS_PAST_DAYS = 365;
const OPERATIONAL_APPOINTMENTS_FUTURE_DAYS = 45;
const getOperationalAppointmentsRange = () => ({
  from: formatDateOnly(addDays(new Date(), -OPERATIONAL_APPOINTMENTS_PAST_DAYS)),
  to: formatDateOnly(addDays(new Date(), OPERATIONAL_APPOINTMENTS_FUTURE_DAYS)),
});
const CLIENT_DIRECTORY_APPOINTMENTS_PAST_DAYS = 730;
const getClientDirectoryAppointmentsRange = () => ({
  from: formatDateOnly(addDays(new Date(), -CLIENT_DIRECTORY_APPOINTMENTS_PAST_DAYS)),
  to: formatDateOnly(new Date()),
});
const normalizeSlug = (value = '') =>
  `${value}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const assertSupabase = () => {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase no est\u00e1 configurado.');
  }
};

const fixMojibakeText = (value = '') =>
  `${value ?? ''}`
    .replaceAll('barberÃ­a', 'barbería')
    .replaceAll('barberÃ­as', 'barberías')
    .replaceAll('sesiÃ³n', 'sesión')
    .replaceAll('vÃ¡lida', 'válida')
    .replaceAll('configuraciÃ³n', 'configuración')
    .replaceAll('funciÃ³n', 'función')
    .replaceAll('contraseÃ±a', 'contraseña')
    .replaceAll('contraseÃ±as', 'contraseñas')
    .replaceAll('encontrÃ³', 'encontró')
    .replaceAll('nÃ³mina', 'nómina')
    .replaceAll('Ã¡', 'á')
    .replaceAll('Ã©', 'é')
    .replaceAll('Ã­', 'í')
    .replaceAll('Ã³', 'ó')
    .replaceAll('Ãº', 'ú')
    .replaceAll('Ã±', 'ñ');

const normalizeError = (error, fallback) => {
  if (!error) return new Error(fixMojibakeText(fallback));

  if (error instanceof Error) {
    return new Error(fixMojibakeText(error.message || fallback));
  }

  return new Error(fixMojibakeText(error.message || fallback));
};

const settleQuery = async (query, fallbackData = []) => {
  try {
    const result = await query;
    return {
      data: result?.data ?? fallbackData,
      error: result?.error ?? null,
    };
  } catch (error) {
    return {
      data: fallbackData,
      error,
    };
  }
};

const encodeBranchScope = (branchId) => `branch_id.is.null,branch_id.eq.${branchId}`;

const applyTenantScope = (query, { isSuperAdmin, currentBarbershopId, currentBranchId }, options = {}) => {
  const {
    barbershopColumn = 'barbershop_id',
    branchColumn = 'branch_id',
    includeGlobalBranchRows = true,
    includeLegacyBarbershopRows = false,
  } = options;

  let nextQuery = query;

  if (!isSuperAdmin && currentBarbershopId) {
    nextQuery = includeLegacyBarbershopRows
      ? nextQuery.or(`${barbershopColumn}.is.null,${barbershopColumn}.eq.${currentBarbershopId}`)
      : nextQuery.eq(barbershopColumn, currentBarbershopId);
  }

  if (!isSuperAdmin && currentBranchId && branchColumn) {
    nextQuery = includeGlobalBranchRows
      ? nextQuery.or(encodeBranchScope(currentBranchId))
      : nextQuery.eq(branchColumn, currentBranchId);
  }

  return nextQuery;
};

const validateBranchBelongsToBarbershop = async (barbershopId, branchId) => {
  if (!branchId) return;
  if (!barbershopId) {
    throw normalizeError(null, 'Debes asignar una barber\u00eda antes de seleccionar una sucursal.');
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id, barbershop_id')
    .eq('id', branchId)
    .maybeSingle();

  if (error) throw normalizeError(error, 'No se pudo validar la sucursal seleccionada.');
  if (!data) throw normalizeError(null, 'La sucursal seleccionada no existe.');
  if (String(data.barbershop_id || '') !== String(barbershopId || '')) {
    throw normalizeError(null, 'La sucursal seleccionada no pertenece a la barber\u00eda indicada.');
  }
};

const toUiClient = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  notes: row.notes || '',
  points: Number(row.points || 0),
  createdAt: row.created_at,
  completedVisits: Number(row.completed_visits || 0),
  totalSpent: Number(row.total_spent || 0),
  lastVisitAt: row.last_visit_at || null,
  favoriteBarberId: row.favorite_barber_id || null,
  favoriteBarberName: row.favorite_barber_name || '',
  favoriteServiceName: row.favorite_service_name || '',
  statsUpdatedAt: row.stats_updated_at || null,
});

const toUiBarber = (row) => ({
  id: row.id,
  name: row.name,
  fullName: row.full_name || row.name,
  cedula: row.cedula || '',
  avatar: row.avatar || '',
  color: row.color || '',
  bg: row.bg || '',
  shadow: row.shadow || '',
  paymentMode: row.payment_mode || 'salario',
  salary: Number(row.salary || 0),
  commission: Number(row.commission || 0),
  paymentFrequency: row.payment_frequency || 'Quincenal',
  level: row.level || 'Junior',
  phone: row.phone || '',
  email: row.email || '',
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  isActive: row.is_active ?? true,
});

const toUiService = (row, comboMap) => ({
  id: row.id,
  name: row.name,
  price: Number(row.price || 0),
  category: row.category,
  items: comboMap.get(row.id) || [],
  appliesTo: row.applies_to || 'General',
  discountType: row.discount_type || 'percentage',
  discountValue: Number(row.discount_value || 0),
  targetServiceIds: Array.isArray(row.target_service_ids) ? row.target_service_ids : [],
  isOptional: row.is_optional ?? true,
});

const toUiPosSale = (row) => ({
  id: row.id,
  ticketNumber: Number(row.ticket_number ?? row.ticketNumber ?? 0),
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  rawSubtotal: Number(row.raw_subtotal ?? row.rawSubtotal ?? row.subtotal ?? 0),
  discountTotal: Number(row.discount_total ?? row.discountTotal ?? 0),
  subtotal: Number(row.subtotal || 0),
  productTotal: Number(row.product_total || 0),
  serviceTotal: Number(row.service_total || 0),
  items: Array.isArray(row.items) ? row.items : [],
  promotionId: row.promotion_id || row.promotionId || null,
  promotionName: row.promotion_name || row.promotionName || '',
  discountLabel: row.discount_label || row.discountLabel || '',
  notes: row.notes || '',
  createdBy: row.created_by || null,
  createdAt: row.created_at,
});

const toUiAppointment = (row) => ({
  id: row.id,
  clientId: row.client_id,
  barberId: row.barber_id,
  rawBarberId: row.raw_barber_id || row.barber_id,
  barberName: row.barber_name || '',
  serviceId: row.service_id,
  service: row.service_name || '',
  price: Number(row.price || 0),
  grossAmount: Number(row.gross_amount ?? row.grossAmount ?? row.price ?? 0),
  discountAmount: Number(row.discount_amount ?? row.discountAmount ?? 0),
  promotionName: row.promotion_name || row.promotionName || '',
  date: row.appointment_date,
  time: safeTime(row.appointment_time),
  durationMinutes: Number(row.duration_minutes || 30),
  type: row.type || 'reserva',
  status: normalizeDbStatus(row.status),
  cancellationReason: row.cancellation_reason || '',
  checkInAt: row.check_in_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  cancelledAt: row.cancelled_at,
  reminderSentAt: row.reminder_sent_at,
  clientConfirmedAt: row.client_confirmed_at,
  isPaid: Boolean(row.is_paid),
  rating: row.rating,
  notes: row.notes || '',
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toUiRole = (row) => ({
  roleName: row.role_name,
  description: row.description || '',
});

const toUiBarbershop = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug || normalizeSlug(row.name),
  ownerEmail: row.owner_email || '',
  phone: row.phone || '',
  city: row.city || '',
  plan: row.plan || 'starter',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

const toUiBranch = (row, barbershopMap) => ({
  id: row.id,
  barbershopId: row.barbershop_id,
  barbershopName: barbershopMap.get(row.barbershop_id)?.name || row.barbershop_name || 'Negocio sin nombre',
  name: row.name,
  code: row.code || '',
  city: row.city || '',
  address: row.address || '',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

const toUiProfile = (row, roleMap, barbershopMap, branchMap) => {
  const resolvedBranch = row.branch_id ? branchMap.get(row.branch_id) : null;
  const resolvedBarbershopId = row.barbershop_id || resolvedBranch?.barbershopId || null;
  const resolvedBarbershopName = resolvedBarbershopId
    ? barbershopMap.get(resolvedBarbershopId)?.name
      || resolvedBranch?.barbershopName
      || row.barbershop_name
      || 'Negocio sin nombre'
    : '';

  return {
    id: row.id,
    email: row.email || '',
    fullName: row.full_name || row.name || row.email || 'Usuario',
    createdAt: row.created_at,
    roles: roleMap.get(row.id) || [],
    barbershopId: resolvedBarbershopId,
    barbershopName: resolvedBarbershopName,
    branchId: row.branch_id || null,
    branchName: row.branch_id ? resolvedBranch?.name || 'Sucursal sin nombre' : '',
  };
};

const withScopeIds = (payload, barbershopId, branchId = null) => ({
  ...payload,
  ...(barbershopId ? { barbershop_id: barbershopId } : {}),
  ...(branchId ? { branch_id: branchId } : {}),
});

const normalizeLegacyBarberId = (barberId, barbers = []) => {
  if (barberId === null || barberId === undefined || barberId === '') return barberId;
  const normalizedBarbers = Array.isArray(barbers) ? barbers : [];
  const hasExactMatch = normalizedBarbers.some((barber) => String(barber.id) === String(barberId));
  if (hasExactMatch) return barberId;

  const legacyIndex = Number.parseInt(String(barberId), 10);
  if (Number.isNaN(legacyIndex) || legacyIndex < 1) return barberId;

  return normalizedBarbers[legacyIndex - 1]?.id || barberId;
};

const normalizeLegacyEntityId = (entityId, items = []) => {
  if (entityId === null || entityId === undefined || entityId === '') return entityId;
  const normalizedItems = Array.isArray(items) ? items : [];
  const hasExactMatch = normalizedItems.some((item) => String(item.id) === String(entityId));
  if (hasExactMatch) return entityId;

  const legacyIndex = Number.parseInt(String(entityId), 10);
  if (Number.isNaN(legacyIndex) || legacyIndex < 1) return entityId;

  return normalizedItems[legacyIndex - 1]?.id || entityId;
};

const toDbClient = (client, barbershopId) =>
  withScopeIds({
    id: client.id,
    name: client.name,
    phone: client.phone || '',
    notes: client.notes || '',
    points: Number(client.points || 0),
    completed_visits: Number(client.completedVisits || 0),
    total_spent: Number(client.totalSpent || 0),
    last_visit_at: client.lastVisitAt || null,
    favorite_barber_id: client.favoriteBarberId || null,
    favorite_barber_name: client.favoriteBarberName || null,
    favorite_service_name: client.favoriteServiceName || null,
    stats_updated_at: client.statsUpdatedAt || null,
  }, barbershopId, null);

const toDbBarber = (barber, barbershopId, branchId = null) => {
  const resolvedBarbershopId = barber.barbershopId ?? barbershopId ?? null;
  const resolvedBranchId = barber.branchId ?? branchId ?? null;

  return withScopeIds({
    id: barber.id,
    name: barber.name,
    full_name: barber.fullName || barber.name || '',
    cedula: barber.cedula || '',
    phone: barber.phone || null,
    email: barber.email || null,
    payment_mode: barber.paymentMode || 'salario',
    salary: Number(barber.salary || 0),
    commission: Number(barber.commission || 0),
    payment_frequency: barber.paymentFrequency || 'Quincenal',
    level: barber.level || 'Junior',
    color: barber.color || null,
    bg: barber.bg || null,
    shadow: barber.shadow || null,
    avatar: barber.avatar || null,
    is_active: barber.isActive ?? true,
  }, resolvedBarbershopId, resolvedBranchId);
};

const toDbService = (service, barbershopId) => ({
  id: service.id,
  name: service.name,
  category: service.category,
  price: Number(service.price || 0),
  applies_to: isPromotionService(service) ? (service.appliesTo || 'General') : null,
  discount_type: isPromotionService(service) ? (service.discountType || 'percentage') : null,
  discount_value: isPromotionService(service) ? Number(service.discountValue || 0) : 0,
  target_service_ids: isPromotionService(service)
    ? (Array.isArray(service.targetServiceIds) ? service.targetServiceIds : [])
    : [],
  is_optional: isPromotionService(service) ? (service.isOptional ?? true) : true,
  is_active: service.isActive ?? true,
  ...(barbershopId ? { barbershop_id: barbershopId } : {}),
  branch_id: null,
});

const toDbBarbershop = (barbershop) => ({
  id: barbershop.id,
  name: barbershop.name,
  slug: normalizeSlug(barbershop.slug || barbershop.name),
  owner_email: barbershop.ownerEmail || '',
  phone: barbershop.phone || null,
  city: barbershop.city || null,
  plan: barbershop.plan || 'starter',
  is_active: barbershop.isActive ?? true,
});

const toDbBranch = (branch) => ({
  id: branch.id,
  barbershop_id: branch.barbershopId,
  name: branch.name,
  code: branch.code || null,
  city: branch.city || null,
  address: branch.address || null,
  is_active: branch.isActive ?? true,
});

const toDbAppointment = (appointment, services = [], barbershopId, branchId = null, barbers = [], clients = []) => {
  const matchedService = (services || []).find((service) => service.name === appointment.service);
  const normalizedBarberId = normalizeLegacyBarberId(appointment.barberId, barbers);
  const matchedBarber = (barbers || []).find((barber) => String(barber.id) === String(normalizedBarberId));
  const normalizedClientId = normalizeLegacyEntityId(appointment.clientId, clients);
  const normalizedServiceId = matchedService?.id || normalizeLegacyEntityId(appointment.serviceId, services) || null;
  const netPrice = Number(appointment.price || 0);
  const discountAmount = Number(appointment.discountAmount || 0);
  const grossAmount = Number(
    appointment.grossAmount
      ?? (discountAmount > 0 ? netPrice + discountAmount : netPrice),
  );

  return withScopeIds({
    id: appointment.id,
    client_id: normalizedClientId,
    barber_id: normalizedBarberId,
    barber_name: appointment.barberName || matchedBarber?.name || null,
    service_id: normalizedServiceId,
    service_name: appointment.service || matchedService?.name || null,
    price: netPrice,
    gross_amount: grossAmount,
    discount_amount: discountAmount,
    promotion_name: appointment.promotionName || null,
    appointment_date: appointment.date,
    appointment_time: safeTime(appointment.time),
    duration_minutes: Number(appointment.durationMinutes || 30),
    type: appointment.type || 'reserva',
    status: STATUS_TO_DB[appointment.status] || 'confirmada',
    cancellation_reason: appointment.cancellationReason || null,
    check_in_at: appointment.checkInAt || null,
    started_at: appointment.startedAt || null,
    finished_at: appointment.finishedAt || null,
    cancelled_at: appointment.cancelledAt || null,
    reminder_sent_at: appointment.reminderSentAt || null,
    client_confirmed_at: appointment.clientConfirmedAt || null,
    is_paid: Boolean(appointment.isPaid),
    rating: appointment.rating ?? null,
    notes: appointment.notes || null,
    created_by: appointment.createdBy || null,
    updated_by: appointment.updatedBy || null,
  }, barbershopId, branchId);
};

const toDbPosSale = (sale, barbershopId, branchId = null, createdBy = null) =>
  withScopeIds({
    id: sale.id,
    raw_subtotal: Number(sale.rawSubtotal || sale.subtotal || 0),
    discount_total: Number(sale.discountTotal || 0),
    subtotal: Number(sale.subtotal || 0),
    product_total: Number(sale.productTotal || 0),
    service_total: Number(sale.serviceTotal || 0),
    items: Array.isArray(sale.items) ? sale.items : [],
    promotion_id: sale.promotionId || null,
    promotion_name: sale.promotionName || null,
    discount_label: sale.discountLabel || null,
    notes: sale.notes || null,
    created_by: createdBy || sale.createdBy || null,
  }, barbershopId, branchId);

const getComboRows = (services = []) =>
  services
    .filter((service) => service.category === 'Combo' && Array.isArray(service.items))
    .flatMap((combo) =>
      combo.items.map((itemId) => ({
        combo_service_id: combo.id,
        item_service_id: itemId,
      })),
    );

const getComboRowKey = (comboServiceId, itemServiceId) => `${comboServiceId}::${itemServiceId}`;

const resolveUserScope = async (currentUserId, scopeOverride = {}) => {
  if (!currentUserId) return { isSuperAdmin: false, currentBarbershopId: null, currentBranchId: null };

  try {
    const [{ data: profile, error: profileError }, { data: userRoles, error: rolesError }] = await Promise.all([
      supabase.from('profiles').select('id, barbershop_id, branch_id').eq('id', currentUserId).maybeSingle(),
      supabase.from('user_roles').select('role_name').eq('user_id', currentUserId),
    ]);

    if (profileError) throw profileError;
    if (rolesError) throw rolesError;

    const currentUserRoles = (userRoles || []).map((row) => row.role_name);
    const hasBarbershopOverride = Boolean(scopeOverride?.currentBarbershopId);
    const effectiveBarbershopId = hasBarbershopOverride
      ? scopeOverride.currentBarbershopId
      : profile?.barbershop_id || null;
    const effectiveBranchId = Object.prototype.hasOwnProperty.call(scopeOverride || {}, 'currentBranchId')
      ? scopeOverride.currentBranchId
      : (hasBarbershopOverride ? null : profile?.branch_id || null);

    return {
      isSuperAdmin: currentUserRoles.includes('super_admin') && !hasBarbershopOverride,
      currentBarbershopId: effectiveBarbershopId,
      currentBranchId: effectiveBranchId,
    };
    } catch (error) {
    console.error('No se pudo resolver el scope del usuario actual en Supabase.', {
      currentUserId,
      error,
    });
    return { isSuperAdmin: false, currentBarbershopId: null, currentBranchId: null };
  }
};

export async function fetchBarbershopSnapshot(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const appointmentsRange = getOperationalAppointmentsRange();

  const [
    { data: servicesData, error: servicesError },
    { data: comboItemsData, error: comboItemsError },
    { data: clientsData, error: clientsError },
    { data: barbersData, error: barbersError },
    { data: appointmentsData, error: appointmentsError },
    posSalesResult,
  ] = await Promise.all([
    applyTenantScope(
      supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      scope,
      { branchColumn: null, includeLegacyBarbershopRows: true },
    ),
    supabase
      .from('service_combo_items')
      .select('*'),
    applyTenantScope(
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true }),
      scope,
      { branchColumn: null },
    ),
    applyTenantScope(
      supabase
        .from('barbers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      scope,
    ),
    applyTenantScope(
      supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', appointmentsRange.from)
        .lte('appointment_date', appointmentsRange.to)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true }),
      scope,
    ),
    applyTenantScope(
      supabase
        .from('pos_sales')
        .select('*')
        .gte('created_at', `${appointmentsRange.from}T00:00:00`)
        .lte('created_at', `${appointmentsRange.to}T23:59:59.999`)
        .order('created_at', { ascending: true }),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
  ]);

  if (servicesError) throw normalizeError(servicesError, 'No se pudieron cargar los servicios.');
  if (clientsError) throw normalizeError(clientsError, 'No se pudieron cargar los clientes.');
  if (barbersError) throw normalizeError(barbersError, 'No se pudo cargar el staff.');
  if (appointmentsError) throw normalizeError(appointmentsError, 'No se pudo cargar la agenda.');
  if (comboItemsError) {
    console.warn('No se pudieron cargar los combos para el snapshot principal:', comboItemsError);
  }

  let posSalesData = [];
  let posSalesLoadError = null;
  if (posSalesResult?.error) {
    const normalizedError = normalizeError(posSalesResult.error, 'No se pudieron cargar las ventas de POS para el rango operativo actual.');
    posSalesLoadError = normalizedError.message;
    console.warn('No se pudieron cargar las ventas de POS para el snapshot principal:', normalizedError);
  } else {
    posSalesData = posSalesResult?.data || [];
  }

  const scopedServiceIds = new Set((servicesData || []).map((row) => row.id));
  const comboMap = new Map();
  for (const row of comboItemsData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.combo_service_id)) continue;
    const current = comboMap.get(row.combo_service_id) || [];
    comboMap.set(row.combo_service_id, [...current, row.item_service_id]);
  }

  const services = (servicesData || []).map((row) => toUiService(row, comboMap));
  const clients = (clientsData || []).map(toUiClient);
  const barbers = (barbersData || []).map(toUiBarber);
  const appointments = (appointmentsData || []).map((row) =>
    toUiAppointment({
      ...row,
      raw_barber_id: row.barber_id,
      barber_id: normalizeLegacyBarberId(row.barber_id, barbers),
    }),
  );
  const posSales = (posSalesData || []).map(toUiPosSale);
  return {
    services,
    clients,
    barbers,
    appointments,
    posSales,
    posSalesLoadError,
  };
}

export async function fetchScopedClients(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const clientsQuery = applyTenantScope(
    supabase.from('clients').select('*').order('created_at', { ascending: true }),
    scope,
    { branchColumn: null },
  );

  const { data, error } = await clientsQuery;
  if (error) throw normalizeError(error, 'No se pudieron cargar los clientes.');

  return (data || []).map(toUiClient);
}

export async function fetchScopedServices(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const servicesQuery = applyTenantScope(
    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    scope,
    { branchColumn: null, includeLegacyBarbershopRows: true },
  );

  const { data: servicesData, error: servicesError } = await servicesQuery;
  if (servicesError) throw normalizeError(servicesError, 'No se pudieron cargar los servicios.');

  const { data: comboItemsData, error: comboItemsError } = await supabase
    .from('service_combo_items')
    .select('*');
  if (comboItemsError) {
    console.warn('No se pudieron cargar los combos para la lista de servicios:', comboItemsError);
  }

  const scopedServiceIds = new Set((servicesData || []).map((row) => row.id));
  const comboMap = new Map();
  for (const row of comboItemsData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.combo_service_id)) continue;
    const current = comboMap.get(row.combo_service_id) || [];
    comboMap.set(row.combo_service_id, [...current, row.item_service_id]);
  }

  return (servicesData || []).map((row) => toUiService(row, comboMap));
}

export async function fetchScopedBarbers(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const barbersQuery = applyTenantScope(
    supabase.from('barbers').select('*').eq('is_active', true).order('created_at', { ascending: true }),
    scope,
  );

  const { data, error } = await barbersQuery;
  if (error) throw normalizeError(error, 'No se pudieron cargar los barberos.');

  return (data || []).map(toUiBarber);
}

export async function fetchClientDirectorySnapshot(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const barbershopWideScope = { ...scope, currentBranchId: null };
  const clientDirectoryRange = getClientDirectoryAppointmentsRange();
  const warnings = [];

  const [
    { data: clientsData, error: clientsError },
    barbersResult,
    appointmentsResult,
  ] = await Promise.all([
    applyTenantScope(
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true }),
      barbershopWideScope,
      { branchColumn: null },
    ),
    settleQuery(applyTenantScope(
      supabase
        .from('barbers')
        .select('id, name, full_name')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      barbershopWideScope,
    ), []),
    settleQuery(applyTenantScope(
      supabase
        .from('appointments')
        .select('id, client_id, barber_id, barber_name, service_name, price, appointment_date, appointment_time, status')
        .eq('status', 'finalizada')
        .gte('appointment_date', clientDirectoryRange.from)
        .lte('appointment_date', clientDirectoryRange.to)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true }),
      barbershopWideScope,
    ), []),
  ]);

  if (clientsError) throw normalizeError(clientsError, 'No se pudieron cargar los clientes.');

  const barbersData = barbersResult?.data || [];
  if (barbersResult?.error) {
    const normalizedError = normalizeError(barbersResult.error, 'No se pudo cargar el staff para la vista de clientes.');
    warnings.push(normalizedError.message);
    console.error('No se pudo cargar el staff para clientes:', normalizedError);
  }

  const appointmentsData = appointmentsResult?.data || [];
  if (appointmentsResult?.error) {
    const normalizedError = normalizeError(appointmentsResult.error, 'No se pudo cargar el historial de clientes para calcular visitas y favoritos.');
    warnings.push(normalizedError.message);
    console.error('No se pudo cargar el historial de clientes:', normalizedError);
  }

  return {
    clients: (clientsData || []).map(toUiClient),
    barbers: (barbersData || []).map(toUiBarber),
    appointments: (appointmentsData || []).map((row) =>
      toUiAppointment({
        ...row,
        raw_barber_id: row.barber_id,
        barber_id: normalizeLegacyBarberId(row.barber_id, barbersData || []),
      }),
    ),
    warnings,
  };
}

export async function fetchAccessControlSnapshot(currentUserId) {
  assertSupabase();

  const [
    { data: rolesData, error: rolesError },
    { data: currentProfile, error: currentProfileError },
    { data: currentUserRoleRows, error: currentUserRolesError },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('*')
      .order('role_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', currentUserId)
      .order('role_name', { ascending: true }),
  ]);
  if (rolesError) throw normalizeError(rolesError, 'No se pudieron cargar los roles.');
  if (currentProfileError) throw normalizeError(currentProfileError, 'No se pudo cargar el perfil del usuario actual.');
  if (currentUserRolesError) throw normalizeError(currentUserRolesError, 'No se pudieron cargar los permisos del usuario actual.');

  const currentUserRoles = (currentUserRoleRows || []).map((row) => row.role_name);
  const isSuperAdmin = currentUserRoles.includes('super_admin');
  const currentBarbershopId = currentProfile?.barbershop_id || null;
  const currentBranchId = currentProfile?.branch_id || null;

  const barbershopsPromise = isSuperAdmin
    ? supabase
      .from('barbershops')
      .select('*')
      .order('created_at', { ascending: true })
    : currentBarbershopId
      ? supabase
        .from('barbershops')
        .select('*')
        .eq('id', currentBarbershopId)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const branchesPromise = isSuperAdmin
    ? supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    : currentBarbershopId
      ? supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .eq('barbershop_id', currentBarbershopId)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const [
    { data: barbershopsData, error: barbershopsError },
    { data: branchesData, error: branchesError },
  ] = await Promise.all([barbershopsPromise, branchesPromise]);

  if (barbershopsError) {
    throw normalizeError(barbershopsError, 'No se pudieron cargar las barber\u00edas visibles para este usuario.');
  }
  if (branchesError) {
    throw normalizeError(branchesError, 'No se pudieron cargar las sucursales visibles para este usuario.');
  }

  let profilesData = [];
  if (isSuperAdmin) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los perfiles.');
    profilesData = data || [];
  } else if (currentBarbershopId) {
    const branchIds = branchesData.map((branch) => branch.id);
    const [{ data: profilesByBarbershop, error: profilesByBarbershopError }, { data: profilesByBranch, error: profilesByBranchError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('barbershop_id', currentBarbershopId)
        .order('created_at', { ascending: true }),
      branchIds.length
        ? supabase
          .from('profiles')
          .select('*')
          .in('branch_id', branchIds)
          .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesByBarbershopError) throw normalizeError(profilesByBarbershopError, 'No se pudieron cargar los perfiles.');
    if (profilesByBranchError) throw normalizeError(profilesByBranchError, 'No se pudieron cargar los perfiles.');

    const mergedProfiles = [...(profilesByBarbershop || []), ...(profilesByBranch || []), ...(currentProfile ? [currentProfile] : [])];
    profilesData = Array.from(new Map(mergedProfiles.map((profile) => [String(profile.id), profile])).values());
  } else {
    profilesData = currentProfile ? [currentProfile] : [];
  }

  const scopedUserIds = Array.from(new Set(profilesData.map((profile) => profile.id).filter(Boolean)));
  let userRolesData = currentUserRoleRows || [];
  if (isSuperAdmin) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('role_name', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los permisos.');
    userRolesData = data || [];
  } else if (scopedUserIds.length) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .in('user_id', scopedUserIds)
      .order('role_name', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los permisos.');
    userRolesData = data || [];
  }

  const roleMap = new Map();
  for (const row of userRolesData || []) {
    const current = roleMap.get(row.user_id) || [];
    roleMap.set(row.user_id, [...current, row.role_name]);
  }

  const barbershopMap = new Map((barbershopsData || []).map((row) => [row.id, toUiBarbershop(row)]));
  const branchMap = new Map((branchesData || []).map((row) => [row.id, toUiBranch(row, barbershopMap)]));
  const roles = (rolesData || []).map(toUiRole);
  const users = (profilesData || []).map((row) => toUiProfile(row, roleMap, barbershopMap, branchMap));
  const barbershops = (barbershopsData || []).map(toUiBarbershop);
  const branches = (branchesData || []).map((row) => toUiBranch(row, barbershopMap));

  return {
    roles,
    users,
    currentUserRoles,
    currentBarbershopId,
    currentBranchId,
    barbershops,
    branches,
  };
}

export async function upsertClients(clients, barbershopId = null) {
  assertSupabase();
  if (!clients?.length) return;

  const { error } = await supabase
    .from('clients')
    .upsert(clients.map((client) => toDbClient(client, barbershopId)), { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudieron guardar los clientes.');
}

export async function deleteClientRecord(clientId) {
  assertSupabase();
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el cliente.');
}

export async function replaceUserRoles(userId, roleNames = []) {
  assertSupabase();

  const uniqueRoles = [...new Set((roleNames || []).filter(Boolean))];
  const { data: existingRows, error: existingError } = await supabase
    .from('user_roles')
    .select('role_name')
    .eq('user_id', userId);
  if (existingError) throw normalizeError(existingError, 'No se pudieron leer los roles actuales.');

  const currentRoles = [...new Set((existingRows || []).map((row) => row.role_name).filter(Boolean))];
  const rolesToInsert = uniqueRoles.filter((roleName) => !currentRoles.includes(roleName));
  const rolesToDelete = currentRoles.filter((roleName) => !uniqueRoles.includes(roleName));

  if (rolesToInsert.length) {
    const { error: insertError } = await supabase
      .from('user_roles')
      .upsert(
        rolesToInsert.map((roleName) => ({ user_id: userId, role_name: roleName })),
        { onConflict: 'user_id,role_name' },
      );
    if (insertError) throw normalizeError(insertError, 'No se pudieron guardar los nuevos roles.');
  }

  if (rolesToDelete.length) {
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .in('role_name', rolesToDelete);
    if (deleteError) throw normalizeError(deleteError, 'No se pudieron retirar los roles anteriores.');
  }
}

export async function upsertBarbershop(barbershop) {
  assertSupabase();

  const { data, error } = await supabase
    .from('barbershops')
    .upsert([toDbBarbershop(barbershop)], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw normalizeError(error, 'No se pudo guardar el negocio.');

  return toUiBarbershop(data);
}

export async function upsertBranch(branch) {
  assertSupabase();

  const { data, error } = await supabase
    .from('branches')
    .upsert([toDbBranch(branch)], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw normalizeError(error, 'No se pudo guardar la sucursal.');

  return data;
}

export async function assignProfileBarbershop(userId, barbershopId) {
  assertSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({ barbershop_id: barbershopId || null })
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo asociar el usuario al negocio.');
}

export async function assignProfileBranch(userId, branchId) {
  assertSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({ branch_id: branchId || null })
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo asociar el usuario a la sucursal.');
}

export async function updateManagedUserProfile(userId, payload = {}) {
  assertSupabase();

  let nextBarbershopId = Object.prototype.hasOwnProperty.call(payload, 'barbershopId')
    ? payload.barbershopId || null
    : undefined;
  const nextBranchId = Object.prototype.hasOwnProperty.call(payload, 'branchId')
    ? payload.branchId || null
    : undefined;

  if (nextBranchId && !nextBarbershopId) {
    const { data: branchData, error: branchError } = await supabase
      .from('branches')
      .select('id, barbershop_id')
      .eq('id', nextBranchId)
      .maybeSingle();

    if (branchError) throw normalizeError(branchError, 'No se pudo validar la sucursal del usuario.');
    if (!branchData) throw normalizeError(null, 'La sucursal seleccionada no existe.');

    nextBarbershopId = branchData.barbershop_id || null;
  }

  if (nextBranchId) {
    await validateBranchBelongsToBarbershop(
      nextBarbershopId !== undefined ? nextBarbershopId : null,
      nextBranchId,
    );
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'fullName')) {
    updates.full_name = payload.fullName || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'barbershopId')) {
    updates.barbershop_id = nextBarbershopId;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'branchId')) {
    updates.branch_id = nextBranchId;
  }

  if (!Object.keys(updates).length) return;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo actualizar el perfil del usuario.');
}

export async function createManagedUser(payload, currentUserId = null) {
  assertSupabase();

  let normalizedPayload = { ...(payload || {}) };
  if (currentUserId) {
    const scope = await resolveUserScope(currentUserId);

    if (!scope.isSuperAdmin) {
      if (!scope.currentBarbershopId) {
        throw normalizeError(null, 'Tu usuario administrador no tiene una barber\u00eda asignada.');
      }

      normalizedPayload = {
        ...normalizedPayload,
        barbershopId: scope.currentBarbershopId,
      };

      if (normalizedPayload.branchId) {
        await validateBranchBelongsToBarbershop(scope.currentBarbershopId, normalizedPayload.branchId);
      }
    } else if (normalizedPayload.branchId && normalizedPayload.barbershopId) {
      await validateBranchBelongsToBarbershop(normalizedPayload.barbershopId, normalizedPayload.branchId);
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || null;
  if (!accessToken) throw normalizeError(null, 'No se encontró una sesión válida para crear usuarios.');
  if (!supabaseUrl || !supabasePublishableKey) throw normalizeError(null, 'Falta la configuración de Supabase.');

  const response = await fetch(`${supabaseUrl}/functions/v1/create-system-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(normalizedPayload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const backendMessage =
      body?.error ||
      body?.message ||
      body?.msg ||
      'La función devolvió un error al crear el usuario.';
    throw normalizeError(null, backendMessage);
  }

  if (body?.error) {
    throw normalizeError(body.error, body?.error?.error || body?.error?.message || 'No se pudo crear el usuario.');
  }

  return body;
}

export async function resetManagedUserPassword(payload) {
  assertSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || null;
  if (!accessToken) throw normalizeError(null, 'No se encontró una sesión válida para restablecer contraseñas.');
  if (!supabaseUrl || !supabasePublishableKey) throw normalizeError(null, 'Falta la configuración de Supabase.');

  const response = await fetch(`${supabaseUrl}/functions/v1/reset-system-user-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const backendMessage =
      body?.error ||
      body?.message ||
      body?.msg ||
      'La función devolvió un error al restablecer la contraseña.';
    throw normalizeError(null, backendMessage);
  }

  if (body?.error) {
    throw normalizeError(body.error, body?.error?.error || body?.error?.message || 'No se pudo restablecer la contraseña.');
  }

  return body;
}

export async function upsertBarbers(barbers, barbershopId = null, branchId = null, currentUserId = null) {
  assertSupabase();
  if (!barbers?.length) return;

  let resolvedBarbershopId = barbershopId;
  let resolvedBranchId = branchId;
  let scope = null;

  if (currentUserId) {
    scope = await resolveUserScope(currentUserId);
    resolvedBarbershopId = resolvedBarbershopId || scope.currentBarbershopId || null;
    resolvedBranchId = resolvedBranchId ?? scope.currentBranchId ?? null;
  }

  const normalizedBarbers = [];
  for (const barber of barbers) {
    const barberBarbershopId = barber.barbershopId || resolvedBarbershopId || null;
    const barberBranchId = barber.branchId ?? resolvedBranchId ?? null;
    if (!barberBranchId) {
      throw normalizeError(
        null,
        'Cada barbero debe tener una sucursal asignada antes de guardarse.',
      );
    }
    if (barberBranchId && !barberBarbershopId) {
      throw normalizeError(
        null,
        scope?.currentBarbershopId
          ? 'No se pudo resolver la barber\u00eda del barbero antes de asignar la sucursal.'
          : 'Tu usuario no tiene una barber\u00eda asignada. Asigna primero la barber\u00eda del administrador.',
      );
    }
    await validateBranchBelongsToBarbershop(barberBarbershopId, barberBranchId);
    normalizedBarbers.push({
      ...barber,
      barbershopId: barberBarbershopId,
      branchId: barberBranchId,
    });
  }

  const { error } = await supabase
    .from('barbers')
    .upsert(
      normalizedBarbers.map((barber) => toDbBarber(barber, barber.barbershopId, barber.branchId)),
      { onConflict: 'id' },
    );
  if (error) throw normalizeError(error, 'No se pudo guardar el barbero.');
}

export async function deleteBarberRecord(barberId) {
  assertSupabase();
  const { error } = await supabase.from('barbers').delete().eq('id', barberId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el barbero.');
}

export async function upsertServices(services, barbershopId = null) {
  assertSupabase();
  if (!services?.length) return;

  const { error } = await supabase
    .from('services')
    .upsert(services.map((service) => toDbService(service, barbershopId)), { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudieron guardar los servicios.');
}

export async function syncServiceComboItems(services) {
  assertSupabase();
  const scopedServices = services || [];
  const comboServices = scopedServices.filter((service) => service.category === 'Combo');
  const scopedServiceIds = scopedServices.map((service) => service.id).filter(Boolean);
  if (!scopedServiceIds.length) return;

  const desiredRows = getComboRows(comboServices);
  const desiredKeys = new Set(desiredRows.map((row) => getComboRowKey(row.combo_service_id, row.item_service_id)));

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('service_combo_items')
    .select('combo_service_id, item_service_id')
    .in('combo_service_id', scopedServiceIds);
  if (existingRowsError) throw normalizeError(existingRowsError, 'No se pudieron leer los combos actuales.');

  const normalizedExistingRows = existingRows || [];
  const existingKeys = new Set(normalizedExistingRows.map((row) => getComboRowKey(row.combo_service_id, row.item_service_id)));

  const rowsToInsert = desiredRows.filter((row) => !existingKeys.has(getComboRowKey(row.combo_service_id, row.item_service_id)));
  if (rowsToInsert.length) {
    const { error: insertError } = await supabase
      .from('service_combo_items')
      .insert(rowsToInsert);
    if (insertError) throw normalizeError(insertError, 'No se pudieron guardar los combos.');
  }

  const rowsToDelete = normalizedExistingRows.filter((row) => !desiredKeys.has(getComboRowKey(row.combo_service_id, row.item_service_id)));
  for (const row of rowsToDelete) {
    const { error: deleteError } = await supabase
      .from('service_combo_items')
      .delete()
      .eq('combo_service_id', row.combo_service_id)
      .eq('item_service_id', row.item_service_id);
    if (deleteError) throw normalizeError(deleteError, 'No se pudieron depurar los combos obsoletos.');
  }
}

export async function deleteServiceRecord(serviceId) {
  assertSupabase();
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el servicio.');
}

export async function upsertAppointments(appointments, services, barbershopId = null, branchId = null, barbers = [], clients = []) {
  assertSupabase();
  if (!appointments?.length) return;

  const payload = appointments.map((appointment) => toDbAppointment(appointment, services, barbershopId, branchId, barbers, clients));
  const { error } = await supabase
    .from('appointments')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudo guardar la cita.');
}

export async function createPosSale(sale, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!sale) return null;

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = sale.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = sale.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) {
    throw normalizeError(null, 'No se pudo resolver la barber\u00eda para registrar la venta.');
  }

  if (!resolvedBranchId) {
    throw normalizeError(null, 'No se pudo resolver la sucursal para registrar la venta.');
  }

  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const payload = toDbPosSale(sale, resolvedBarbershopId, resolvedBranchId, currentUserId);
  const { data, error } = await supabase
    .from('pos_sales')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar la venta de POS.');
  return {
    ...sale,
    ...toUiPosSale(data),
    ticketNumber: Number(data?.ticket_number ?? sale.ticketNumber ?? 0),
  };
}

export async function deletePosSaleRecord(saleId) {
  assertSupabase();
  const { error } = await supabase.from('pos_sales').delete().eq('id', saleId);
  if (error) throw normalizeError(error, 'No se pudo cancelar la venta de POS.');
}
