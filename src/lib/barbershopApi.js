import { formatCedulaNumber, isPromotionService } from '../features/app/shared';
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
const DEFAULT_CATALOGS = {
  service_categories: ['Cortes', 'Barba', 'Tratamientos', 'Facial', 'Producto', 'Combo', 'Promocion'],
  inventory_product_categories: ['Reventa', 'Cabello', 'Barba', 'Color', 'Tratamiento', 'Facial', 'Higiene', 'Herramientas', 'Otros'],
};
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

const normalizeCatalogValues = (values = [], fallback = []) => {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => fixMojibakeText(value).trim())
    .filter(Boolean);
  return Array.from(new Set([...(normalized.length ? normalized : fallback)]));
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
  cedula: formatCedulaNumber(row.cedula || ''),
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

const toUiService = (row, comboMap, usageMap = new Map()) => ({
  id: row.id,
  name: row.name,
  price: Number(row.price || 0),
  category: row.category,
  items: comboMap.get(row.id) || [],
  inventoryUsage: usageMap.get(row.id) || [],
  appliesTo: row.applies_to || 'General',
  discountType: row.discount_type || 'percentage',
  discountValue: Number(row.discount_value || 0),
  targetServiceIds: Array.isArray(row.target_service_ids) ? row.target_service_ids : [],
  isOptional: row.is_optional ?? true,
});

const toUiInventoryItem = (row) => ({
  id: row.id,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  serviceId: row.service_id || null,
  name: row.product_name || row.name || 'Producto sin nombre',
  productName: row.product_name || row.name || 'Producto sin nombre',
  productCategory: row.product_category || 'Otros',
  usageType: row.usage_type || 'retail',
  sku: row.sku || '',
  barcode: row.barcode || '',
  unitName: row.unit_name || 'unidad',
  presentationName: row.presentation_name || 'unidad',
  unitsPerPresentation: Number(row.units_per_presentation || 1),
  trackStock: row.track_stock ?? true,
  minStock: Number(row.min_stock || 0),
  maxStock: row.max_stock == null ? null : Number(row.max_stock),
  costPrice: Number(row.cost_price || 0),
  salePrice: Number(row.sale_price || 0),
  currentStock: Number(row.current_stock || 0),
  notes: row.notes || '',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const inventoryItemToProductService = (item) => ({
  id: item.serviceId || `inventory:${item.id}`,
  inventoryItemId: item.id,
  name: item.productName || item.name || 'Producto sin nombre',
  price: Number(item.salePrice || 0),
  category: 'Producto',
  inventoryCategory: item.productCategory || 'Otros',
  usageType: item.usageType || 'retail',
  currentStock: Number(item.currentStock || 0),
  costPrice: Number(item.costPrice || 0),
  unitName: item.unitName || 'unidad',
  sku: item.sku || '',
  barcode: item.barcode || '',
  isInventoryProduct: true,
  items: [],
  appliesTo: 'General',
  discountType: 'percentage',
  discountValue: 0,
  targetServiceIds: [],
  isOptional: true,
});

const toUiPosSale = (row) => ({
  id: row.id,
  ticketNumber: Number(row.ticket_number ?? row.ticketNumber ?? 0),
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  cashSessionId: row.cash_session_id || row.cashSessionId || null,
  paymentMethod: row.payment_method || row.paymentMethod || 'cash',
  clientId: row.client_id || row.clientId || null,
  clientName: row.client_name || row.clientName || '',
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
  canceledAt: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.canceledAt || null : null;
    } catch {
      return null;
    }
  })(),
  canceledBy: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.canceledBy || null : null;
    } catch {
      return null;
    }
  })(),
  cancellationReason: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.cancellationReason || '' : '';
    } catch {
      return '';
    }
  })(),
  createdBy: row.created_by || null,
  createdAt: row.created_at,
});

const toUiCashSession = (row) => ({
  id: row.id,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  openedBy: row.opened_by || null,
  closedBy: row.closed_by || null,
  openedAt: row.opened_at,
  closedAt: row.closed_at || null,
  openingAmount: Number(row.opening_amount || 0),
  closingAmount: Number(row.closing_amount ?? row.counted_cash_amount ?? 0),
  expectedCashAmount: Number(row.expected_cash_amount || 0),
  countedCashAmount: Number(row.counted_cash_amount ?? row.closing_amount ?? 0),
  differenceAmount: Number(row.difference_amount || 0),
  status: row.status || (row.closed_at ? 'closed' : 'open'),
  notes: row.notes || '',
});

const toUiCashMovement = (row) => ({
  id: row.id,
  cashSessionId: row.cash_session_id || null,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  type: row.type || 'in',
  movementKind: row.movement_kind || 'manual',
  paymentMethod: row.payment_method || 'cash',
  amount: Number(row.amount || 0),
  notes: row.notes || '',
  referenceType: row.reference_type || null,
  referenceId: row.reference_id || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
});

const toUiAppointment = (row) => ({
  id: row.id,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
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
  paidAt: row.paid_at || null,
  paidBy: row.paid_by || null,
  settlementId: row.settlement_id || null,
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
    cedula: formatCedulaNumber(barber.cedula || ''),
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

const toDbInventoryProduct = (product, barbershopId, branchId = null, currentUserId = null) =>
  withScopeIds({
    id: product.id,
    service_id: product.serviceId || null,
    product_name: product.productName || product.name,
    product_category: product.productCategory || 'Otros',
    usage_type: product.usageType || 'retail',
    sku: product.sku || null,
    barcode: product.barcode || null,
    unit_name: product.unitName || 'unidad',
    presentation_name: product.presentationName || product.presentation_name || 'unidad',
    units_per_presentation: Math.max(1, Number(product.unitsPerPresentation || product.units_per_presentation || 1)),
    track_stock: product.trackStock !== false,
    min_stock: Number(product.minStock || 0),
    max_stock: product.maxStock === '' || product.maxStock == null ? null : Number(product.maxStock),
    cost_price: Number(product.costPrice || 0),
    sale_price: Number(product.salePrice || product.price || 0),
    current_stock: Number(product.currentStock || 0),
    notes: product.notes || null,
    is_active: product.isActive ?? true,
    created_by: product.id ? undefined : currentUserId || null,
    updated_by: currentUserId || null,
  }, barbershopId, branchId);

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
    client_name: appointment.clientName || null,
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
    paid_at: appointment.paidAt || null,
    paid_by: appointment.paidBy || null,
    settlement_id: appointment.settlementId || null,
    rating: appointment.rating ?? null,
    notes: appointment.notes || null,
    created_by: appointment.createdBy || null,
    updated_by: appointment.updatedBy || null,
  }, barbershopId, appointment.branchId ?? branchId);
};

const toDbPosSale = (sale, barbershopId, branchId = null, createdBy = null) =>
  withScopeIds({
    id: sale.id,
    cash_session_id: sale.cashSessionId || null,
    payment_method: sale.paymentMethod || 'cash',
    client_id: sale.clientId || null,
    client_name: sale.clientName || null,
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

const fetchActiveCashSessionRow = async (barbershopId, branchId) => {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('barbershop_id', barbershopId)
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .is('closed_at', null)
    .maybeSingle();

  if (error) throw normalizeError(error, 'No se pudo validar la caja abierta.');
  return data || null;
};

const toUiCashAdvance = (row) => ({
  id: row.id,
  barberId: row.barber_id,
  barberName: row.barber_name || '',
  amount: Number(row.amount || 0),
  note: row.note || '',
  date: row.advance_date,
  createdAt: row.created_at,
  createdBy: row.created_by || null,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  settledAt: row.settled_at || null,
  settlementId: row.settlement_id || null,
});

const toDbCashAdvance = (advance, barbershopId, branchId = null, createdBy = null) =>
  withScopeIds({
    id: advance.id,
    barber_id: advance.barberId,
    barber_name: advance.barberName || '',
    amount: Number(advance.amount || 0),
    note: advance.note || null,
    advance_date: advance.date || formatDateOnly(new Date()),
    created_by: createdBy || advance.createdBy || null,
    created_at: advance.createdAt || new Date().toISOString(),
    settled_at: advance.settledAt || null,
    settlement_id: advance.settlementId || null,
  }, barbershopId, branchId);

const toUiPayrollSettlement = (row, appointmentMap = new Map()) => ({
  id: row.id,
  barberId: row.barber_id,
  barberName: row.barber_name || '',
  barberFullName: row.barber_full_name || row.barber_name || '',
  grossTotal: Number(row.gross_total || 0),
  withdrawalsTotal: Number(row.withdrawals_total || 0),
  total: Number(row.net_total || 0),
  pendingServices: Number(row.pending_services || 0),
  type: row.settlement_type || 'individual',
  notes: row.notes || '',
  paidBy: row.paid_by || null,
  paidAt: row.paid_at,
  createdAt: row.created_at,
  barbershopId: row.barbershop_id || null,
  branchId: row.branch_id || null,
  appointmentIds: appointmentMap.get(row.id) || [],
});

const toDbPayrollSettlement = (settlement, barbershopId, branchId = null, paidBy = null) =>
  withScopeIds({
    id: settlement.id,
    barber_id: settlement.barberId,
    barber_name: settlement.barberName || '',
    barber_full_name: settlement.barberFullName || settlement.barberName || null,
    gross_total: Number(settlement.grossTotal || 0),
    withdrawals_total: Number(settlement.withdrawalsTotal || 0),
    net_total: Number(settlement.total || 0),
    pending_services: Number(settlement.pendingServices || 0),
    settlement_type: settlement.type || 'individual',
    notes: settlement.notes || null,
    paid_by: paidBy || settlement.paidBy || null,
    paid_at: settlement.paidAt || new Date().toISOString(),
    created_at: settlement.createdAt || settlement.paidAt || new Date().toISOString(),
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

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const combineInventoryConsumptions = (consumptions = []) => {
  const byItem = new Map();

  for (const consumption of consumptions) {
    if (!consumption.inventoryItemId) continue;
    const key = String(consumption.inventoryItemId);
    const current = byItem.get(key) || {
      ...consumption,
      quantity: 0,
      sources: [],
    };
    current.quantity += Number(consumption.quantity || 0);
    current.sources.push(...(consumption.sources || []));
    byItem.set(key, current);
  }

  return Array.from(byItem.values()).filter((consumption) => consumption.quantity > 0);
};

const resolveInventoryConsumptionsForSale = async (sale) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  if (!items.length) return [];

  const serviceIdsNeedingUsage = items
    .map((item) => ({
      ...item,
      resolvedServiceId: item.serviceId || item.id,
    }))
    .filter((item) => item.category !== 'Producto' && isUuid(item.resolvedServiceId) && !(Array.isArray(item.inventoryUsage) && item.inventoryUsage.length))
    .map((item) => item.resolvedServiceId);

  let usageRows = [];
  if (serviceIdsNeedingUsage.length) {
    const { data, error } = await supabase
      .from('service_inventory_usage')
      .select('*')
      .eq('is_active', true)
      .in('service_id', serviceIdsNeedingUsage);
    if (error) throw normalizeError(error, 'No se pudieron leer los insumos de los servicios.');
    usageRows = data || [];
  }

  const usageByService = new Map();
  for (const row of usageRows) {
    const current = usageByService.get(row.service_id) || [];
    usageByService.set(row.service_id, [
      ...current,
      {
        inventoryItemId: row.inventory_item_id,
        quantity: Number(row.quantity || 0),
      },
    ]);
  }

  const consumptions = [];
  for (const item of items) {
    const qty = Number(item.qty || 1);
    if (item.category === 'Producto' && item.inventoryItemId) {
      consumptions.push({
        inventoryItemId: item.inventoryItemId,
        reason: 'sale',
        quantity: qty,
        unitPrice: Number(item.price || 0),
        sources: [{ type: 'product', itemId: item.id, name: item.name, qty }],
      });
      continue;
    }

    const itemUsage = Array.isArray(item.inventoryUsage) && item.inventoryUsage.length
      ? item.inventoryUsage
      : usageByService.get(item.serviceId || item.id) || [];

    for (const usage of itemUsage) {
      consumptions.push({
        inventoryItemId: usage.inventoryItemId,
        reason: 'service_use',
        quantity: Number(usage.quantity || 0) * qty,
        unitPrice: Number(item.price || 0),
        sources: [{ type: 'service', serviceId: item.serviceId || item.id, name: item.name, qty }],
      });
    }
  }

  return combineInventoryConsumptions(consumptions);
};

const applyInventoryConsumptionForSale = async (sale, posSaleId, currentUserId) => {
  const combinedConsumptions = await resolveInventoryConsumptionsForSale(sale);
  const results = [];

  for (const consumption of combinedConsumptions) {
    const { data, error } = await supabase.rpc('register_inventory_movement_atomic', {
      p_inventory_item_id: consumption.inventoryItemId,
      p_movement_type: 'out',
      p_reason: consumption.reason || 'service_use',
      p_quantity: Number(consumption.quantity || 0),
      p_unit_cost: null,
      p_unit_price: consumption.unitPrice || null,
      p_reference_type: 'pos_sale',
      p_reference_id: posSaleId,
      p_cash_session_id: sale.cashSessionId || null,
      p_pos_sale_id: posSaleId,
      p_purchase_id: null,
      p_notes: consumption.reason === 'sale' ? 'Salida automática por venta de producto' : 'Salida automática por servicio cobrado',
      p_metadata: { sources: consumption.sources || [] },
      p_created_by: currentUserId || null,
    });
    if (error) throw normalizeError(error, 'No se pudo descontar el inventario automáticamente.');
    results.push(data);
  }

  return results;
};

const restoreInventoryForCancelledSale = async (sale, reason, currentUserId) => {
  const combinedConsumptions = await resolveInventoryConsumptionsForSale(sale);
  const results = [];

  for (const consumption of combinedConsumptions) {
    const { data, error } = await supabase.rpc('register_inventory_movement_atomic', {
      p_inventory_item_id: consumption.inventoryItemId,
      p_movement_type: 'in',
      p_reason: consumption.reason === 'sale' ? 'sale_void' : 'service_use_void',
      p_quantity: Number(consumption.quantity || 0),
      p_unit_cost: null,
      p_unit_price: consumption.unitPrice || null,
      p_reference_type: 'pos_sale_void',
      p_reference_id: sale.id || null,
      p_cash_session_id: sale.cashSessionId || null,
      p_pos_sale_id: sale.id || null,
      p_purchase_id: null,
      p_notes: consumption.reason === 'sale'
        ? `Devolucion automatica por anulacion de venta${reason ? `: ${reason}` : ''}`
        : `Devolucion de insumos por anulacion de servicio${reason ? `: ${reason}` : ''}`,
      p_metadata: { sources: consumption.sources || [], cancellationReason: reason || '' },
      p_created_by: currentUserId || null,
    });
    if (error) throw normalizeError(error, 'No se pudo devolver el inventario automaticamente.');
    results.push(data);
  }

  return results;
};

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
    cashSessionsResult,
    cashMovementsResult,
    cashAdvancesResult,
    payrollSettlementsResult,
    settlementAppointmentsResult,
    inventoryItemsResult,
    serviceInventoryUsageResult,
    catalogsResult,
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
    applyTenantScope(
      supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(60),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('barber_cash_advances')
        .select('*')
        .order('created_at', { ascending: true }),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('payroll_settlements')
        .select('*')
        .order('paid_at', { ascending: false }),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('payroll_settlement_appointments')
        .select('*')
        .order('created_at', { ascending: true }),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    settleQuery(
      applyTenantScope(
        supabase
          .from('inventory_items')
          .select('*')
          .eq('is_active', true)
          .order('product_name', { ascending: true }),
        scope,
        { includeLegacyBarbershopRows: true },
      ),
      [],
    ),
    settleQuery(
      supabase
        .from('service_inventory_usage')
        .select('*')
        .order('created_at', { ascending: true }),
      [],
    ),
    settleQuery(
      applyTenantScope(
        supabase
          .from('barbershop_catalogs')
          .select('*')
          .in('catalog_key', ['service_categories', 'inventory_product_categories']),
        scope,
        { branchColumn: null },
      ),
      [],
    ),
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

  let cashSessionsData = [];
  let cashMovementsData = [];
  let cashLoadError = null;
  if (cashSessionsResult?.error || cashMovementsResult?.error) {
    const normalizedError = normalizeError(
      cashSessionsResult?.error || cashMovementsResult?.error,
      'No se pudo cargar la caja.',
    );
    cashLoadError = normalizedError.message;
    console.warn('No se pudo cargar la caja para el snapshot principal:', normalizedError);
  } else {
    cashSessionsData = cashSessionsResult?.data || [];
    cashMovementsData = cashMovementsResult?.data || [];
  }

  let cashAdvancesData = [];
  let payrollSettlementsData = [];
  let settlementAppointmentsData = [];
  const payrollLoadWarnings = [];
  if (cashAdvancesResult?.error) {
    const normalizedError = normalizeError(cashAdvancesResult.error, 'No se pudieron cargar los adelantos de barbero.');
    payrollLoadWarnings.push(normalizedError.message);
    console.warn('No se pudieron cargar los adelantos de barbero:', normalizedError);
  } else {
    cashAdvancesData = cashAdvancesResult?.data || [];
  }
  if (payrollSettlementsResult?.error) {
    const normalizedError = normalizeError(payrollSettlementsResult.error, 'No se pudo cargar el historial de pagos.');
    payrollLoadWarnings.push(normalizedError.message);
    console.warn('No se pudo cargar el historial de pagos:', normalizedError);
  } else {
    payrollSettlementsData = payrollSettlementsResult?.data || [];
  }
  if (settlementAppointmentsResult?.error) {
    const normalizedError = normalizeError(settlementAppointmentsResult.error, 'No se pudieron cargar los turnos ligados al historial de pagos.');
    payrollLoadWarnings.push(normalizedError.message);
    console.warn('No se pudieron cargar los turnos ligados al historial de pagos:', normalizedError);
  } else {
    settlementAppointmentsData = settlementAppointmentsResult?.data || [];
  }

  let inventoryItemsData = [];
  let inventoryLoadError = null;
  if (inventoryItemsResult?.error) {
    const normalizedError = normalizeError(inventoryItemsResult.error, 'No se pudo cargar inventario.');
    inventoryLoadError = normalizedError.message;
    console.warn('No se pudo cargar inventario:', normalizedError);
  } else {
    inventoryItemsData = inventoryItemsResult?.data || [];
  }

  let serviceInventoryUsageData = [];
  if (serviceInventoryUsageResult?.error) {
    console.warn('No se pudo cargar la configuración de insumos por servicio:', serviceInventoryUsageResult.error);
  } else {
    serviceInventoryUsageData = serviceInventoryUsageResult?.data || [];
  }

  let catalogsData = [];
  if (catalogsResult?.error) {
    console.warn('No se pudieron cargar catálogos configurables:', catalogsResult.error);
  } else {
    catalogsData = catalogsResult?.data || [];
  }

  const scopedServiceIds = new Set((servicesData || []).map((row) => row.id));
  const comboMap = new Map();
  for (const row of comboItemsData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.combo_service_id)) continue;
    const current = comboMap.get(row.combo_service_id) || [];
    comboMap.set(row.combo_service_id, [...current, row.item_service_id]);
  }

  const usageMap = new Map();
  for (const row of serviceInventoryUsageData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.service_id)) continue;
    const current = usageMap.get(row.service_id) || [];
    usageMap.set(row.service_id, [
      ...current,
      {
        id: row.id,
        inventoryItemId: row.inventory_item_id,
        quantity: Number(row.quantity || 0),
      },
    ]);
  }

  const inventoryItems = (inventoryItemsData || []).map(toUiInventoryItem);
  const inventoryServiceIds = new Set(
    inventoryItems
      .map((item) => item.serviceId)
      .filter(Boolean)
      .map(String),
  );
  const baseServices = (servicesData || [])
    .filter((row) => row.category !== 'Producto' || !inventoryServiceIds.has(String(row.id)))
    .map((row) => toUiService(row, comboMap, usageMap));
  const inventoryProductServices = inventoryItems
    .filter((item) => ['retail', 'both'].includes(item.usageType || 'retail'))
    .map(inventoryItemToProductService);
  const services = [...baseServices, ...inventoryProductServices];
  const catalogMap = new Map((catalogsData || []).map((row) => [row.catalog_key, row.values]));
  const catalogs = {
    serviceCategories: normalizeCatalogValues(catalogMap.get('service_categories'), DEFAULT_CATALOGS.service_categories),
    inventoryProductCategories: normalizeCatalogValues(catalogMap.get('inventory_product_categories'), DEFAULT_CATALOGS.inventory_product_categories),
  };
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
  const cashSessions = (cashSessionsData || []).map(toUiCashSession);
  const cashMovements = (cashMovementsData || []).map(toUiCashMovement);
  const settlementAppointmentMap = new Map();
  for (const row of settlementAppointmentsData || []) {
    const current = settlementAppointmentMap.get(row.settlement_id) || [];
    settlementAppointmentMap.set(row.settlement_id, [...current, row.appointment_id]);
  }
  const cashWithdrawals = (cashAdvancesData || []).map(toUiCashAdvance);
  const payrollSettlements = (payrollSettlementsData || []).map((row) => toUiPayrollSettlement(row, settlementAppointmentMap));
  return {
    services,
    clients,
    barbers,
    appointments,
    posSales,
    cashSessions,
    cashMovements,
    inventoryItems,
    catalogs,
    cashWithdrawals,
    payrollSettlements,
    posSalesLoadError,
    cashLoadError,
    inventoryLoadError,
    payrollLoadWarnings,
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

export async function upsertInventoryProducts(products, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!products?.length) return [];

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = scope.currentBarbershopId || products.find((product) => product.barbershopId)?.barbershopId || null;
  const resolvedBranchId = scope.currentBranchId ?? products.find((product) => product.branchId !== undefined)?.branchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para guardar el producto.');

  const rows = products.map((product) => {
    const row = toDbInventoryProduct(product, resolvedBarbershopId, product.branchId ?? resolvedBranchId, currentUserId);
    return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
  });

  const { data, error } = await supabase
    .from('inventory_items')
    .upsert(rows, { onConflict: 'id' })
    .select('*');
  if (error) throw normalizeError(error, 'No se pudieron guardar los productos de inventario.');

  return (data || []).map(toUiInventoryItem);
}

export async function upsertBarbershopCatalog(catalogKey, values, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = scope.currentBarbershopId || null;
  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para guardar el catálogo.');

  const normalizedValues = normalizeCatalogValues(values, DEFAULT_CATALOGS[catalogKey] || []);
  const { data, error } = await supabase
    .from('barbershop_catalogs')
    .upsert({
      barbershop_id: resolvedBarbershopId,
      catalog_key: catalogKey,
      values: normalizedValues,
    }, { onConflict: 'barbershop_id,catalog_key' })
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo guardar el catálogo.');
  return normalizeCatalogValues(data?.values, normalizedValues);
}

export async function deleteInventoryProduct(productId) {
  assertSupabase();
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', productId);
  if (error) throw normalizeError(error, 'No se pudo desactivar el producto de inventario.');
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

export async function syncServiceInventoryUsage(service, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!service?.id) return;

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const barbershopId = scope.currentBarbershopId || service.barbershopId || null;
  if (!barbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para guardar los insumos del servicio.');

  const { error: deleteError } = await supabase
    .from('service_inventory_usage')
    .delete()
    .eq('service_id', service.id);
  if (deleteError) throw normalizeError(deleteError, 'No se pudo limpiar la configuración anterior de insumos.');

  const rows = (service.inventoryUsage || [])
    .map((usage) => ({
      barbershop_id: barbershopId,
      branch_id: usage.branchId || null,
      service_id: service.id,
      inventory_item_id: usage.inventoryItemId,
      quantity: Number(usage.quantity || 0),
      is_active: true,
      created_by: currentUserId || null,
      updated_by: currentUserId || null,
    }))
    .filter((row) => row.inventory_item_id && row.quantity > 0);

  if (!rows.length) return;

  const { error: insertError } = await supabase
    .from('service_inventory_usage')
    .insert(rows);
  if (insertError) throw normalizeError(insertError, 'No se pudieron guardar los insumos del servicio.');
}

export async function deleteServiceRecord(serviceId) {
  assertSupabase();
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el servicio.');
}

export async function openCashSession(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = payload.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para abrir caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para abrir caja.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const existingSession = await fetchActiveCashSessionRow(resolvedBarbershopId, resolvedBranchId);
  if (existingSession) {
    throw normalizeError(null, 'Ya hay una caja abierta para esta sucursal.');
  }

  const { data, error } = await supabase.rpc('open_cash_session_atomic', {
    p_barbershop_id: resolvedBarbershopId,
    p_branch_id: resolvedBranchId,
    p_opened_by: currentUserId || null,
    p_opening_amount: Math.max(Number(payload.openingAmount || 0), 0),
    p_notes: payload.notes || null,
  });

  if (error) throw normalizeError(error, 'No se pudo abrir la caja.');

  return {
    session: toUiCashSession(data.session),
    movement: toUiCashMovement(data.movement),
  };
}

export async function createCashMovement(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = payload.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para registrar el movimiento.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para registrar el movimiento.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const sessionRow = payload.cashSessionId
    ? await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', payload.cashSessionId)
      .eq('barbershop_id', resolvedBarbershopId)
      .eq('branch_id', resolvedBranchId)
      .eq('status', 'open')
      .is('closed_at', null)
      .maybeSingle()
    : { data: await fetchActiveCashSessionRow(resolvedBarbershopId, resolvedBranchId), error: null };
  if (sessionRow.error) throw normalizeError(sessionRow.error, 'No se pudo validar la caja abierta.');
  const cashSessionId = sessionRow.data?.id || null;
  if (!cashSessionId) throw normalizeError(null, 'Debes abrir caja antes de registrar movimientos.');

  const amount = Math.max(Number(payload.amount || 0), 0);
  if (amount <= 0) throw normalizeError(null, 'El monto del movimiento debe ser mayor a cero.');

  const movementType = payload.type === 'out' ? 'out' : 'in';
  const movementKind = payload.movementKind || 'manual';
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_session_id: cashSessionId,
      barbershop_id: resolvedBarbershopId,
      branch_id: resolvedBranchId,
      type: movementType,
      movement_kind: movementKind,
      payment_method: payload.paymentMethod || 'cash',
      amount,
      notes: payload.notes || (movementType === 'out' ? 'Salida manual de caja' : 'Entrada manual de caja'),
      reference_type: payload.referenceType || null,
      reference_id: payload.referenceId || null,
      created_by: currentUserId || null,
    })
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar el movimiento de caja.');
  return toUiCashMovement(data);
}

export async function createCashAuditMovement(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = payload.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para registrar auditoría de caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para registrar auditoría de caja.');
  if (!payload.cashSessionId) throw normalizeError(null, 'No se pudo resolver la caja para registrar auditoría.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const amount = Math.max(Number(payload.amount || 0), 0);
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_session_id: payload.cashSessionId,
      barbershop_id: resolvedBarbershopId,
      branch_id: resolvedBranchId,
      type: payload.type === 'out' ? 'out' : 'in',
      movement_kind: payload.movementKind || 'closing_adjustment',
      payment_method: payload.paymentMethod || 'cash',
      amount,
      notes: payload.notes || 'Movimiento de auditoría',
      reference_type: payload.referenceType || null,
      reference_id: payload.referenceId || null,
      created_by: currentUserId || null,
    })
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar el movimiento de auditoría.');
  return toUiCashMovement(data);
}

export async function closeCashSession(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = payload.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barbería para cerrar caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cerrar caja.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const activeSession = payload.cashSessionId
    ? { id: payload.cashSessionId }
    : await fetchActiveCashSessionRow(resolvedBarbershopId, resolvedBranchId);
  const cashSessionId = activeSession?.id || null;
  if (!cashSessionId) throw normalizeError(null, 'No hay una caja abierta para cerrar.');

  const { data, error } = await supabase.rpc('close_cash_session_atomic', {
    p_cash_session_id: cashSessionId,
    p_barbershop_id: resolvedBarbershopId,
    p_branch_id: resolvedBranchId,
    p_closed_by: currentUserId || null,
    p_counted_cash_amount: Math.max(Number(payload.countedCashAmount ?? payload.closingAmount ?? 0), 0),
    p_notes: payload.notes || null,
  });

  if (error) throw normalizeError(error, 'No se pudo cerrar la caja.');
  return toUiCashSession(data);
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
    throw normalizeError(null, 'No se pudo resolver la barber?a para registrar la venta.');
  }

  if (!resolvedBranchId) {
    throw normalizeError(null, 'No se pudo resolver la sucursal para registrar la venta.');
  }

  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const activeCashSession = sale.cashSessionId
    ? await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', sale.cashSessionId)
      .eq('barbershop_id', resolvedBarbershopId)
      .eq('branch_id', resolvedBranchId)
      .eq('status', 'open')
      .is('closed_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw normalizeError(error, 'No se pudo validar la caja abierta.');
        return data;
      })
    : await fetchActiveCashSessionRow(resolvedBarbershopId, resolvedBranchId);
  if (!activeCashSession?.id) {
    throw normalizeError(null, 'Debes abrir caja antes de registrar ventas.');
  }

  const payload = toDbPosSale(
    { ...sale, cashSessionId: activeCashSession.id, paymentMethod: sale.paymentMethod || 'cash' },
    resolvedBarbershopId,
    resolvedBranchId,
    currentUserId,
  );
  const { data, error } = await supabase.rpc('register_pos_sale_atomic', {
    p_sale_id: payload.id || null,
    p_barbershop_id: resolvedBarbershopId,
    p_branch_id: resolvedBranchId,
    p_cash_session_id: activeCashSession.id,
    p_payment_method: payload.payment_method || 'cash',
    p_raw_subtotal: Number(payload.raw_subtotal || 0),
    p_discount_total: Number(payload.discount_total || 0),
    p_subtotal: Number(payload.subtotal || 0),
    p_product_total: Number(payload.product_total || 0),
    p_service_total: Number(payload.service_total || 0),
    p_items: payload.items || [],
    p_promotion_id: payload.promotion_id || null,
    p_promotion_name: payload.promotion_name || null,
    p_discount_label: payload.discount_label || null,
    p_notes: payload.notes || null,
    p_client_id: payload.client_id || null,
    p_client_name: payload.client_name || null,
    p_created_by: currentUserId || null,
  });

  if (error) throw normalizeError(error, 'No se pudo registrar la venta de POS.');
  const persistedSaleId = data.sale?.id || payload.id || sale.id;
  let inventoryConsumption = [];
  let inventoryConsumptionError = null;
  try {
    inventoryConsumption = await applyInventoryConsumptionForSale(
      { ...sale, cashSessionId: activeCashSession.id },
      persistedSaleId,
      currentUserId,
    );
  } catch (inventoryError) {
    inventoryConsumptionError = normalizeError(inventoryError, 'La venta se registr?, pero no se pudo descontar el inventario.');
    console.warn('No se pudo descontar inventario de la venta POS:', inventoryConsumptionError);
  }
  const updatedInventoryItems = inventoryConsumption
    .map((result) => result?.item)
    .filter(Boolean)
    .map(toUiInventoryItem);

  return {
    ...sale,
    ...toUiPosSale(data.sale),
    cashMovement: data.movement ? toUiCashMovement(data.movement) : null,
    updatedInventoryItems,
    inventoryConsumptionError: inventoryConsumptionError?.message || null,
    ticketNumber: Number(data.sale?.ticket_number ?? sale.ticketNumber ?? 0),
  };
}

export async function deletePosSaleRecord(saleId, currentUserId, scopeOverride = {}, saleScope = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = saleScope.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = saleScope.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barber?a para cancelar la venta.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cancelar la venta.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const { error } = await supabase.rpc('cancel_pos_sale_atomic', {
    p_sale_id: saleId,
    p_barbershop_id: resolvedBarbershopId,
    p_branch_id: resolvedBranchId,
  });
  if (error) throw normalizeError(error, 'No se pudo cancelar la venta de POS.');
}

export async function cancelPosSaleWithReversal(sale, reason = '', currentUserId, scopeOverride = {}, options = {}) {
  assertSupabase();
  if (!sale?.id) throw normalizeError(null, 'No se pudo resolver la venta para anular.');
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = sale.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = sale.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barber?a para cancelar la venta.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cancelar la venta.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const canceledAt = new Date().toISOString();
  const cancellationPayload = {
    source: 'cancel_pos_sale',
    previousNotes: sale.notes || '',
    canceledAt,
    canceledBy: currentUserId || null,
    cancellationReason: reason || 'Sin motivo especificado',
    inventoryRestored: Boolean(options?.restoreInventory),
  };

  const { data: updatedSales, error: saleError } = await supabase
    .from('pos_sales')
    .update({ notes: JSON.stringify(cancellationPayload) })
    .eq('id', sale.id)
    .eq('barbershop_id', resolvedBarbershopId)
    .eq('branch_id', resolvedBranchId)
    .select('*');
  if (saleError) throw normalizeError(saleError, 'No se pudo marcar la venta como anulada.');
  const updatedSale = Array.isArray(updatedSales) && updatedSales.length > 0
    ? toUiPosSale(updatedSales[0])
    : {
      ...sale,
      notes: JSON.stringify(cancellationPayload),
      canceledAt,
      canceledBy: currentUserId || null,
      cancellationReason: reason || 'Sin motivo especificado',
    };

  const movement = await createCashAuditMovement({
    cashSessionId: sale.cashSessionId,
    barbershopId: resolvedBarbershopId,
    branchId: resolvedBranchId,
    type: 'out',
    movementKind: 'sale',
    paymentMethod: sale.paymentMethod || 'cash',
    amount: Number(sale.subtotal || 0),
    notes: `Anulaci?n venta POS #${sale.ticketNumber || ''} - ${reason || 'Sin motivo'}`,
    referenceType: 'pos_sale_void',
    referenceId: sale.id,
    ticketNumber: sale.ticketNumber || 0,
  }, currentUserId, scopeOverride);

  let inventoryRestoration = [];
  let inventoryRestorationError = null;
  if (options?.restoreInventory) {
    try {
      inventoryRestoration = await restoreInventoryForCancelledSale(
        { ...sale, barbershopId: resolvedBarbershopId, branchId: resolvedBranchId },
        reason,
        currentUserId,
      );
    } catch (inventoryError) {
      inventoryRestorationError = normalizeError(inventoryError, 'La venta se anulo, pero no se pudo devolver el inventario.');
      console.warn('No se pudo devolver inventario por anulacion de venta POS:', inventoryRestorationError);
    }
  }

  const updatedInventoryItems = inventoryRestoration
    .map((result) => result?.item)
    .filter(Boolean)
    .map(toUiInventoryItem);

  return {
    sale: updatedSale,
    movement,
    updatedInventoryItems,
    inventoryRestorationError: inventoryRestorationError?.message || null,
  };
}

export async function deleteCashMovementRecord(movementId, currentUserId, scopeOverride = {}, movementScope = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = movementScope.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = movementScope.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) throw normalizeError(null, 'No se pudo resolver la barber?a para anular el movimiento.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para anular el movimiento.');
  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const { error } = await supabase.rpc('cancel_cash_movement_atomic', {
    p_movement_id: movementId,
    p_barbershop_id: resolvedBarbershopId,
    p_branch_id: resolvedBranchId,
  });
  if (error) throw normalizeError(error, 'No se pudo anular el movimiento de caja.');
}
export async function createCashAdvance(advance, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!advance) return null;

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = advance.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = advance.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) {
    throw normalizeError(null, 'No se pudo resolver la barbería para registrar el adelanto.');
  }

  if (!resolvedBranchId) {
    throw normalizeError(null, 'No se pudo resolver la sucursal para registrar el adelanto.');
  }

  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const payload = toDbCashAdvance(advance, resolvedBarbershopId, resolvedBranchId, currentUserId);
  const { data, error } = await supabase
    .from('barber_cash_advances')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar el adelanto.');
  return toUiCashAdvance(data);
}

export async function createCashAdvanceWithMovement(advance, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!advance) return { advance: null, movement: null };

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedBarbershopId = advance.barbershopId || scope.currentBarbershopId || null;
  const resolvedBranchId = advance.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedBarbershopId) {
    throw normalizeError(null, 'No se pudo resolver la barberia para registrar el adelanto.');
  }

  if (!resolvedBranchId) {
    throw normalizeError(null, 'No se pudo resolver la sucursal para registrar el adelanto.');
  }

  await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

  const amount = Math.max(Number(advance.amount || 0), 0);
  if (amount <= 0) {
    throw normalizeError(null, 'El monto del adelanto debe ser mayor a cero.');
  }

  const sessionRow = advance.cashSessionId
    ? await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', advance.cashSessionId)
      .eq('barbershop_id', resolvedBarbershopId)
      .eq('branch_id', resolvedBranchId)
      .eq('status', 'open')
      .is('closed_at', null)
      .maybeSingle()
    : { data: await fetchActiveCashSessionRow(resolvedBarbershopId, resolvedBranchId), error: null };

  if (sessionRow.error) throw normalizeError(sessionRow.error, 'No se pudo validar la caja abierta.');
  const cashSessionId = sessionRow.data?.id || null;
  if (!cashSessionId) throw normalizeError(null, 'Debes abrir caja antes de registrar un adelanto.');

  const payload = toDbCashAdvance(advance, resolvedBarbershopId, resolvedBranchId, currentUserId);
  const { data: advanceData, error: advanceError } = await supabase
    .from('barber_cash_advances')
    .insert(payload)
    .select('*')
    .single();

  if (advanceError) throw normalizeError(advanceError, 'No se pudo registrar el adelanto.');

  const notes = `Adelanto a barbero - ${advance.barberName || 'Barbero'}${advance.note ? ` - ${advance.note}` : ''}`;
  const { data: movementData, error: movementError } = await supabase
    .from('cash_movements')
    .insert({
      cash_session_id: cashSessionId,
      barbershop_id: resolvedBarbershopId,
      branch_id: resolvedBranchId,
      type: 'out',
      movement_kind: 'manual',
      movement_type: 'retiro',
      payment_method: 'cash',
      amount,
      notes,
      description: notes,
      reference_type: 'cash_advance',
      reference_id: advanceData.id,
      created_by: currentUserId || advance.createdBy || null,
    })
    .select('*')
    .single();

  if (movementError) {
    await supabase
      .from('barber_cash_advances')
      .delete()
      .eq('id', advanceData.id)
      .eq('barbershop_id', resolvedBarbershopId);

    throw normalizeError(movementError, 'No se pudo registrar la salida de caja del adelanto.');
  }

  return {
    advance: toUiCashAdvance(advanceData),
    movement: toUiCashMovement(movementData),
  };
}

export async function createPayrollSettlements(settlements = [], currentUserId, scopeOverride = {}) {
  assertSupabase();
  const normalizedSettlements = (settlements || []).filter(Boolean);
  if (!normalizedSettlements.length) return [];

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const createdRows = [];

  for (const settlement of normalizedSettlements) {
    const resolvedBarbershopId = settlement.barbershopId || scope.currentBarbershopId || null;
    const resolvedBranchId = settlement.branchId ?? scope.currentBranchId ?? null;

    if (!resolvedBarbershopId) {
      throw normalizeError(null, 'No se pudo resolver la barbería para guardar el pago.');
    }

    if (!resolvedBranchId) {
      throw normalizeError(null, 'No se pudo resolver la sucursal para guardar el pago.');
    }

    await validateBranchBelongsToBarbershop(resolvedBarbershopId, resolvedBranchId);

    const payload = toDbPayrollSettlement(settlement, resolvedBarbershopId, resolvedBranchId, currentUserId);
    const { data, error } = await supabase
      .from('payroll_settlements')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw normalizeError(error, 'No se pudo guardar el historial de pago.');

    const advanceIds = (settlement.advanceIds || []).filter(Boolean);
    if (advanceIds.length) {
      const { error: advancesError } = await supabase
        .from('barber_cash_advances')
        .update({
          settled_at: settlement.paidAt || new Date().toISOString(),
          settlement_id: settlement.id,
        })
        .in('id', advanceIds);

      if (advancesError) throw normalizeError(advancesError, 'No se pudieron marcar los adelantos como descontados.');
    }

    const appointmentRows = (settlement.appointmentIds || [])
      .filter(Boolean)
      .map((appointmentId) => withScopeIds({
        settlement_id: settlement.id,
        appointment_id: appointmentId,
      }, resolvedBarbershopId, resolvedBranchId));

    if (appointmentRows.length) {
      const { error: appointmentRowsError } = await supabase
        .from('payroll_settlement_appointments')
        .upsert(appointmentRows, { onConflict: 'settlement_id,appointment_id' });

      if (appointmentRowsError) {
        throw normalizeError(appointmentRowsError, 'No se pudieron ligar los turnos al pago.');
      }
    }

    createdRows.push(toUiPayrollSettlement(data));
  }

  return createdRows;
}
