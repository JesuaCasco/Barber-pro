import React, { Suspense, createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  closeCashSession,
  cancelPosSaleWithReversal,
  createPublicBooking,
  fetchPublicBookingSnapshot,
  createCashAuditMovement,
  createCashAdvanceWithMovement,
  createCashMovement,
  createManagedUser,
  createPosSale,
  createPayrollSettlements,
  assignProfileBarbershop,
  deleteBarberRecord,
  deleteClientRecord,
  deleteInventoryProduct,
  deleteServiceRecord,
  fetchAccessControlSnapshot,
  fetchBarbershopSnapshot,
  fetchClientDirectorySnapshot,
  fetchScopedBarbers,
  fetchScopedClients,
  openCashSession,
  resetManagedUserPassword,
  replaceUserRoles,
  syncServiceComboItems,
  syncServiceInventoryUsage,
  upsertBarbershopCatalog,
  upsertBranch,
  upsertBarbershop,
  upsertAppointments,
  upsertBarbers,
  upsertClients,
  upsertInventoryProducts,
  upsertServices,
  updateManagedUserProfile,
} from './lib/barbershopApi';
import {
  hasSupabaseConfig,
  isLocalDevModeEnabled,
  shouldBlockWithoutSupabase,
  shouldSeedLocalDevMode,
  supabase,
} from './lib/supabase';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Scissors, 
  ShoppingBag, 
  BarChart3, 
  Plus, 
  Search,
  Clock,
  X,
  Loader2, 
  CalendarDays,
  Trash2,
  Package,
  Tags,
  Save,
  ChevronDown,
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Check,
  Edit2,
  Pencil,
  UserPlus,
  Info,
  Star,
  Zap,
  Phone,
  User,
  CreditCard,
  Medal,
  Award,
  Crown,
  CalendarCheck,
  Layers,
  Sparkles,
  UserCheck,
  Target,
  Gift,
  ArrowUpRight,
  Filter,
  Briefcase,
  IdCard,
  Smartphone,
  MapPin,
  History,
  MessageSquare,
  Menu,
  Timer,
  UserX,
  Wallet,
  Activity,
  Repeat,
  ArrowRight,
  ShieldCheck,
  Settings,
} from 'lucide-react';

import {
  CATEGORY_LABELS,
  BARBER_THEME_PALETTE,
  BARBER_PAYMENT_MODE_OPTIONS,
  BUSINESS_PLANS,
  CATEGORIES,
  INVENTORY_PRODUCT_CATEGORIES,
  PROTECTED_SERVICE_CATEGORIES,
  HOURS,
  MOCK_BARBERS,
  LOYALTY_REWARD_VISITS,
  PASSWORD_MIN_LENGTH,
  ROLE_META,
  ensureBarberTheme,
  findClientByPhone,
  barberHasBasePay,
  barberHasCommissionPay,
  formatCedulaNumber,
  formatExcelText,
  formatPhoneNumber,
  formatLocalDateYmd,
  getBarberNominaData,
  getBarberPaymentModeLabel,
  getCurrentTimeHHmm,
  getPhoneDigits,
  getPrimaryRole,
  getTodayString,
  isValidPhoneNumber,
  formatPromotionValue,
  normalizeFavoriteServiceName,
  clampPromotionDiscountValue,
  isPromotionService,
  makeId,
  mergeEntitiesById,
  parseLocalDate,
  standardizeDate,
  styleTag,
} from './features/app/shared';
import {
  BeardIcon,
  DelayTimer,
  ServiceTimer,
  WaitTimer,
} from './features/app/sharedComponents';
import { DashboardView, POSView } from './features/app/dashboardPosViews';
import { ClientDetailModal, ClientsTableView } from './features/app/clientViews';
import { FinalizeModal } from './features/app/finalizeModal';
import { ServiceEditorModal } from './features/app/serviceEditorModal';
import { CashClosureReceiptModal, PaymentReceiptModal, PosSaleReceiptModal, StaffSettlementModal } from './features/app/receiptModals';
import { LoginScreen, PasswordActionModal, UserEditorModal } from './features/system/accessUi';

const { useCallback } = React;

const accessUiFallback = (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300">
      Cargando interfaz...
    </div>
  </div>
);

const GENERIC_CLIENT_NAME = 'Cliente gen\u00e9rico';
const isWebAppointment = (appointment) => appointment?.source === 'web' || Boolean(appointment?.needsClientConfirmation || appointment?.guestName || appointment?.guestPhone);
const getAppointmentDisplayClientName = (appointment, client = null) => {
  if (client?.name) return client.name;
  if (isWebAppointment(appointment) && appointment?.guestName) return appointment.guestName;
  return appointment?.clientName || GENERIC_CLIENT_NAME;
};
const getAppointmentClientMetaLabel = (appointment) => {
  if (!isWebAppointment(appointment)) return '';
  return appointment?.claimsExistingClient ? 'WEB - dice ser cliente' : 'WEB - cliente por confirmar';
};
const CASH_WITHDRAWAL_QUICK_AMOUNTS = [10, 20, 50, 100, 200, 300, 400, 500];

const UiFeedbackContext = createContext({
  notify: () => {},
  confirmAction: async () => false,
});

const useUiFeedback = () => useContext(UiFeedbackContext);
const AUTH_RUNTIME_CACHE_KEY = 'bp_auth_runtime_cache_v1';

class AppSectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Falló la sección ${this.props.label || 'actual'}:`, error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-rose-500/35 bg-slate-900 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <Info size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Revisar pantalla</p>
              <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter">Caja no pudo cargar</h3>
              <p className="mt-3 text-sm font-bold leading-relaxed text-slate-300">
                La aplicación sigue activa, pero esta sección encontró un error. Detalle técnico:
              </p>
              <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-slate-700 bg-black/40 p-4 text-xs font-bold text-rose-100">
                {String(this.state.error?.message || this.state.error || 'Error desconocido')}
              </pre>
              <button
                type="button"
                onClick={this.props.onReset}
                className="mt-5 rounded-2xl bg-indigo-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all hover:bg-indigo-500"
              >
                Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const inventoryProductToService = (item) => ({
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
  presentationName: item.presentationName || 'unidad',
  unitsPerPresentation: Number(item.unitsPerPresentation || 1),
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


const buildInventoryProductServices = (inventoryItems = []) => (inventoryItems || [])
  .filter((item) => item?.isActive !== false && ['retail', 'both'].includes(item?.usageType || 'retail'))
  .map(inventoryProductToService);

const buildServiceMenuItems = (services = [], inventoryItems = []) => [
  ...(services || []).filter((service) => service?.category !== 'Producto'),
  ...buildInventoryProductServices(inventoryItems),
];
const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network request failed',
  'err_name_not_resolved',
  'dns_hostname_not_found',
  'fetch failed',
];

const isNetworkOrDnsError = (error) => {
  const rawMessage = String(error?.message || error || '').toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => rawMessage.includes(pattern));
};

const getMeaningfulErrorMessage = (error) => {
  const rawMessage = error?.message;

  if (typeof rawMessage === 'string') {
    const normalized = rawMessage.trim();
    if (normalized && normalized !== '{}' && normalized !== '[]' && normalized !== 'null' && normalized !== 'undefined') {
      return normalized;
    }
  }

  if (typeof error === 'string') {
    const normalized = error.trim();
    if (normalized && normalized !== '{}' && normalized !== '[]' && normalized !== 'null' && normalized !== 'undefined') {
      return normalized;
    }
  }

  if (typeof error?.error_description === 'string' && error.error_description.trim()) {
    return error.error_description.trim();
  }

  if (typeof error?.details === 'string' && error.details.trim()) {
    return error.details.trim();
  }

  return '';
};

const getFriendlySupabaseErrorMessage = (error, context = 'general') => {
  const meaningfulMessage = getMeaningfulErrorMessage(error);

  if (!isNetworkOrDnsError(error)) {
    return meaningfulMessage || 'Ocurri\u00f3 un problema inesperado al conectar con Supabase.';
  }

  if (context === 'login') {
    return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. Verifica tu conexi\u00f3n o intenta con otra red para iniciar sesi\u00f3n.';
  }

  if (context === 'dashboard') {
    return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. No pude actualizar los datos operativos en este momento.';
  }

  return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. Intenta nuevamente cuando la conexi\u00f3n est\u00e9 estable.';
};

const resolveWalkinQueueTime = ({ appointments = [], barberId, date = getTodayString() }) => {
  if (!barberId || !date) return getCurrentTimeHHmm();

  const toMinutes = (time = '00:00') => {
    if (!time || typeof time !== 'string') return 0;
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  };

  const toHHmm = (minutes) => {
    const safeMinutes = Math.min(23 * 60 + 59, Math.max(0, Number(minutes) || 0));
    const h = Math.floor(safeMinutes / 60);
    const m = safeMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const activeStatuses = new Set(['Confirmada', 'En Espera', 'En Corte']);
  const sameBarberDay = (appointments || []).filter((appointment) => (
    standardizeDate(appointment.date) === standardizeDate(date)
    && String(appointment.barberId) === String(barberId)
    && activeStatuses.has(appointment.status || 'Confirmada')
  ));

  const latestEnd = sameBarberDay.reduce((latest, appointment) => {
    const start = toMinutes(appointment.time);
    const duration = Number(appointment.durationMinutes) > 0 ? Number(appointment.durationMinutes) : 30;
    return Math.max(latest, start + duration);
  }, 0);

  const isToday = standardizeDate(date) === getTodayString();
  if (isToday) {
    const nowMinutes = toMinutes(getCurrentTimeHHmm());
    return toHHmm(Math.max(latestEnd, nowMinutes));
  }

  if (latestEnd > 0) return toHHmm(latestEnd);
  return '09:00';
};

const appointmentTimeToMinutes = (time = '00:00') => {
  if (!time || typeof time !== 'string') return 0;
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const hasAppointmentBarberConflict = ({ appointments = [], appointment, targetBarberId, targetDate, targetTime }) => {
  if (!appointment || !targetBarberId) return false;

  const activeStatuses = new Set(['Confirmada', 'En Espera', 'En Corte']);
  const normalizedTargetDate = standardizeDate(targetDate || appointment.date);
  const start = appointmentTimeToMinutes(targetTime || appointment.time);
  const duration = Number(appointment.durationMinutes) > 0 ? Number(appointment.durationMinutes) : 30;
  const end = start + duration;

  return (appointments || []).some((candidate) => {
    if (String(candidate.id) === String(appointment.id)) return false;
    if (standardizeDate(candidate.date) !== normalizedTargetDate) return false;
    if (String(candidate.barberId) !== String(targetBarberId)) return false;
    if (!activeStatuses.has(candidate.status || 'Confirmada')) return false;

    const candidateStart = appointmentTimeToMinutes(candidate.time);
    const candidateDuration = Number(candidate.durationMinutes) > 0 ? Number(candidate.durationMinutes) : 30;
    const candidateEnd = candidateStart + candidateDuration;
    return start < candidateEnd && candidateStart < end;
  });
};

const toHHmmFromMinutes = (minutes) => {
  const safeMinutes = Math.min(23 * 60 + 59, Math.max(0, Number(minutes) || 0));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const resolveUniqueAppointmentMinute = ({ appointments = [], barberId, date = getTodayString(), preferredTime = getCurrentTimeHHmm(), excludeId = null }) => {
  const occupied = new Set((appointments || [])
    .filter((appointment) => (
      String(appointment.id) !== String(excludeId || '')
      && String(appointment.barberId) === String(barberId)
      && standardizeDate(appointment.date) === standardizeDate(date)
    ))
    .map((appointment) => String(appointment.time || '').slice(0, 5)));
  let cursor = appointmentTimeToMinutes(preferredTime);

  for (let attempt = 0; attempt < 24 * 60; attempt += 1) {
    const candidate = toHHmmFromMinutes(cursor + attempt);
    if (!occupied.has(candidate)) return candidate;
  }

  return toHHmmFromMinutes(cursor);
};

const isSupabaseAppointmentTimeDuplicate = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('appointments_barber_id_appointment_date_appointment_time_key')
    || message.includes('duplicate key value')
  );
};

function SystemView({
  currentUser,
  accessControl,
  savingUserId,
  creatingUser,
  resettingPasswordUserId,
  onboardingBusy,
  onCreateSystemUser,
  onResetUserPassword,
  onUpdateUserProfile,
  onCreateBarbershop,
  onCreateBranch,
  isAdmin,
  isSuperAdmin,
}) {
  const { notify } = useUiFeedback();
  const [search, setSearch] = useState('');
  const [activeSystemPanel, setActiveSystemPanel] = useState('users');
  const [showCreateBarbershop, setShowCreateBarbershop] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedBranchesBarbershopId, setSelectedBranchesBarbershopId] = useState('all');
  const [selectedUsersBarbershopId, setSelectedUsersBarbershopId] = useState('all');
  const [selectedUsersBranchId, setSelectedUsersBranchId] = useState('all');
  const [onboarding, setOnboarding] = useState({ name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '' });
  const [branchForm, setBranchForm] = useState({ id: '', name: '', code: '', city: '', address: '', barbershopId: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', roleName: 'admin', barbershopId: '', branchId: '' });

  const roleCatalog = accessControl.roles.length
    ? accessControl.roles.filter((role) => ['super_admin', 'admin', 'cashier'].includes(role.roleName))
    : [
        { roleName: 'super_admin', description: 'Control total de la plataforma SaaS' },
  { roleName: 'admin', description: 'Administra la barbería y su configuración' },
  { roleName: 'cashier', description: 'Caja / recepción' },
      ];
  const editableRoleCatalog = roleCatalog.filter((role) => isSuperAdmin || role.roleName !== 'super_admin');
  const barbershops = useMemo(() => accessControl.barbershops || [], [accessControl.barbershops]);
  const branches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const currentBarbershop = barbershops.find((shop) => String(shop.id) === String(accessControl.currentBarbershopId || ''))
    || (!isSuperAdmin ? barbershops[0] || null : null);
  const effectiveCurrentBarbershopId = accessControl.currentBarbershopId || currentBarbershop?.id || barbershops[0]?.id || '';
  const currentBranch = branches.find((branch) => String(branch.id) === String(accessControl.currentBranchId || '')) || null;
  const defaultBarbershopId = effectiveCurrentBarbershopId;
  const branchesForCurrentBarbershop = branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveCurrentBarbershopId));
  const effectiveUsersBarbershopId = !isSuperAdmin
    ? (defaultBarbershopId || 'all')
    : (
        selectedUsersBarbershopId === 'all'
          ? 'all'
          : (barbershops.some((shop) => String(shop.id) === String(selectedUsersBarbershopId)) ? selectedUsersBarbershopId : 'all')
      );
  const branchesForSelectedUsersBarbershop = effectiveUsersBarbershopId === 'all'
    ? []
    : branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveUsersBarbershopId));
  const effectiveBranchesBarbershopId = !isSuperAdmin
    ? (defaultBarbershopId || 'all')
    : (
        selectedBranchesBarbershopId === 'all'
          ? 'all'
          : (barbershops.some((shop) => String(shop.id) === String(selectedBranchesBarbershopId)) ? selectedBranchesBarbershopId : 'all')
      );
  const effectiveUsersBranchId = effectiveUsersBarbershopId === 'all'
    ? 'all'
    : (
        selectedUsersBranchId !== 'all' && branchesForSelectedUsersBarbershop.some((branch) => String(branch.id) === String(selectedUsersBranchId))
          ? selectedUsersBranchId
          : 'all'
      );
  const effectiveBranchFormBarbershopId = isSuperAdmin
    ? (branchForm.barbershopId || defaultBarbershopId)
    : (defaultBarbershopId || accessControl.currentBarbershopId || '');
  const effectiveNewUserRole = isSuperAdmin ? newUser.roleName : 'cashier';
  const effectiveNewUserBarbershopId = isSuperAdmin
    ? (newUser.barbershopId || defaultBarbershopId)
    : (defaultBarbershopId || accessControl.currentBarbershopId || '');
  const filteredBranches = useMemo(() => {
    if (!isSuperAdmin) {
      return branchesForCurrentBarbershop;
    }

    if (effectiveBranchesBarbershopId === 'all') {
      return branches;
    }

    return branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveBranchesBarbershopId));
  }, [isSuperAdmin, branches, branchesForCurrentBarbershop, effectiveBranchesBarbershopId]);
  const branchCountByBarbershopId = useMemo(
    () => branches.reduce((accumulator, branch) => {
      const key = String(branch.barbershopId || '');
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    [branches],
  );
  const availableBranchOptionsForNewUser = isSuperAdmin
    ? branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveNewUserBarbershopId))
    : branchesForCurrentBarbershop;
  const effectiveNewUserBranchId = !newUser.branchId
    ? (!isSuperAdmin ? (currentBranch?.id || '') : '')
    : (availableBranchOptionsForNewUser.some((branch) => String(branch.id) === String(newUser.branchId)) ? newUser.branchId : '');
  const canCreateUsers = isAdmin;
  const onboardingCandidates = useMemo(
    () => (accessControl.users || []).filter((user) => !user.roles.includes('super_admin')),
    [accessControl.users],
  );
  const effectiveOnboardingAdminUserId = onboarding.adminUserId || onboardingCandidates[0]?.id || '';

  const resetBranchForm = () => {
    setBranchForm({
      id: '',
      name: '',
      code: '',
      city: '',
      address: '',
      barbershopId: '',
    });
  };

  const startBranchEdit = (branch) => {
    setActiveSystemPanel('branches');
    setShowBranchForm(true);
    setBranchForm({
      id: branch.id,
      name: branch.name || '',
      code: branch.code || '',
      city: branch.city || '',
      address: branch.address || '',
      barbershopId: branch.barbershopId || currentBarbershop?.id || '',
    });
  };

  const users = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const base = (accessControl.users || []).filter((user) => {
      if (!isSuperAdmin) return true;
      if (effectiveUsersBarbershopId === 'all') return true;
      if (String(user.barbershopId || '') !== String(effectiveUsersBarbershopId)) return false;
      if (effectiveUsersBranchId === 'all') return true;
      return String(user.branchId || '') === String(effectiveUsersBranchId);
    });
    if (!normalized) return base;

    return base.filter((user) =>
      (user.fullName || '').toLowerCase().includes(normalized) ||
      (user.email || '').toLowerCase().includes(normalized) ||
      (user.barbershopName || '').toLowerCase().includes(normalized) ||
      (user.roles || []).some((role) => role.toLowerCase().includes(normalized)),
    );
  }, [accessControl.users, isSuperAdmin, search, effectiveUsersBarbershopId, effectiveUsersBranchId]);

  const formatUserCreatedAt = (value) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const canResetPasswordForUser = (user) => {
    if (!isAdmin || !user) return false;
    if (String(user.id) === String(currentUser?.id)) return false;
    const primaryRole = getPrimaryRole(user);
    if (isSuperAdmin) return primaryRole !== 'super_admin';
    return primaryRole === 'cashier';
  };
  const canEditUser = (user) => {
    if (!isAdmin || !user) return false;
    const primaryRole = getPrimaryRole(user);
    if (primaryRole === 'super_admin') return false;
    if (isSuperAdmin) return true;
    return String(user.barbershopId || '') === String(effectiveCurrentBarbershopId || '') && primaryRole === 'cashier';
  };
  const getEditableRoleOptionsForUser = (user) => {
    if (!user) return [];
    if (isSuperAdmin) {
      return editableRoleCatalog.filter((role) => role.roleName !== 'super_admin');
    }
    return editableRoleCatalog.filter((role) => role.roleName === 'cashier');
  };

  const handleSubmitOnboarding = async (event) => {
    event.preventDefault();
    if (!onboarding.name.trim()) {
      notify('Ingresa el nombre de la barbería para completar el onboarding.', 'warning');
      return;
    }
    const created = await onCreateBarbershop({
      ...onboarding,
      adminUserId: effectiveOnboardingAdminUserId || '',
    });
    if (created) {
      setOnboarding({ name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '' });
      setShowCreateBarbershop(false);
    }
  };

  const handleSubmitNewUser = async (event) => {
    event.preventDefault();

    if (!newUser.fullName.trim() || !newUser.email.trim()) {
      notify('Completa nombre y correo para crear la cuenta.', 'warning');
      return;
    }

    if (newUser.password.trim().length < PASSWORD_MIN_LENGTH) {
      notify(`Define una contraseña temporal de al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 'warning');
      return;
    }

    const resolvedBarbershopId = isSuperAdmin
      ? effectiveNewUserBarbershopId
      : (defaultBarbershopId || accessControl.currentBarbershopId || '');
    const resolvedBranchId = isSuperAdmin
      ? (effectiveNewUserBranchId || null)
      : (effectiveNewUserBranchId || currentBranch?.id || null);
    const resolvedPassword = newUser.password.trim();

    if (!resolvedBarbershopId) {
      notify(
        isSuperAdmin
          ? 'Selecciona la barbería a la que pertenecerá este usuario.'
          : 'Tu cuenta de administrador todavía no está vinculada a una barbería.',
        'warning',
      );
      return;
    }

    const created = await onCreateSystemUser({
      fullName: newUser.fullName.trim(),
      email: newUser.email.trim().toLowerCase(),
      password: resolvedPassword,
      roleName: effectiveNewUserRole,
      barbershopId: resolvedBarbershopId,
      branchId: resolvedBranchId,
    });

    if (created) {
      notify(`Usuario ${newUser.email.trim().toLowerCase()} creado correctamente.`, 'success');
      setNewUser({
        fullName: '',
        email: '',
        password: '',
        roleName: isSuperAdmin ? 'admin' : 'cashier',
        barbershopId: '',
        branchId: '',
      });
      setShowCreateUser(false);
    }
  };

  const handleSubmitBranch = async (event) => {
    event.preventDefault();

    const resolvedBarbershopId = isSuperAdmin
      ? effectiveBranchFormBarbershopId
      : (defaultBarbershopId || accessControl.currentBarbershopId || '');

    if (!resolvedBarbershopId || !branchForm.name.trim()) {
      notify('Completa el nombre de la sucursal y la barbería correspondiente.', 'warning');
      return;
    }

    const created = await onCreateBranch({
      id: branchForm.id || undefined,
      name: branchForm.name.trim(),
      code: branchForm.code.trim(),
      city: branchForm.city.trim(),
      address: branchForm.address.trim(),
      barbershopId: resolvedBarbershopId,
    });

    if (created) {
      resetBranchForm();
      setShowBranchForm(false);
    }
  };

  const handleSubmitEditUser = async (payload) => {
    if (!editingUser) return false;
    const targetBarbershopId = isSuperAdmin
      ? (payload.barbershopId || null)
      : (currentBarbershop?.id || accessControl.currentBarbershopId || null);
    const targetBranchId = payload.branchId || null;
    const nextRoleName = isSuperAdmin ? payload.roleName : 'cashier';

    await onUpdateUserProfile(editingUser, {
      fullName: payload.fullName,
      roleName: nextRoleName,
      barbershopId: targetBarbershopId,
      branchId: targetBranchId,
    });
    setEditingUser(null);
    return true;
  };

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in text-white no-print">
      {isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'barbershops', label: 'Barberías' }, { id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.25)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {isSuperAdmin && showCreateBarbershop && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-5xl bg-slate-950 border border-cyan-300/15 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setShowCreateBarbershop(false)}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitOnboarding}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Configuración comercial</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    Nueva barbería
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre del negocio</label>
                  <input
                    value={onboarding.name}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Barbería Central"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo del dueño</label>
                  <input
                    value={onboarding.ownerEmail}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="dueno@barberia.com"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Teléfono</label>
                  <input
                    value={onboarding.phone}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0000-0000"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={onboarding.city}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Plan comercial</label>
                  <select
                    value={onboarding.plan}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    {BUSINESS_PLANS.map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Admin principal</label>
                  <select
                    value={effectiveOnboardingAdminUserId}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, adminUserId: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="">Asignar después</option>
                    {onboardingCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.fullName || user.email)}{user.email ? ` - ${user.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Crear barbería
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateBarbershop(false)}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBranchForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-slate-950 border border-cyan-300/15 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowBranchForm(false);
                resetBranchForm();
              }}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitBranch}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Cobertura operativa</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    {branchForm.id ? 'Editar sucursal' : 'Nueva sucursal'}
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {isSuperAdmin && (
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Barbería</label>
                    <select
                      value={effectiveBranchFormBarbershopId}
                      onChange={(e) => setBranchForm((prev) => ({ ...prev, barbershopId: e.target.value }))}
                      className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="">Selecciona una barbería</option>
                      {barbershops.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre de sucursal</label>
                  <input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Sucursal Metrocentro"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Código interno</label>
                  <input
                    value={branchForm.code}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="Ej. BR-01"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={branchForm.city}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Dirección</label>
                  <input
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Centro comercial, local 12"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {branchForm.id ? 'Guardar cambios' : 'Crear sucursal'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchForm(false);
                    resetBranchForm();
                  }}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.25)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {activeSystemPanel === 'barbershops' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Negocios activos</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Barberías registradas</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                <div className="rounded-[1.6rem] border border-white/5 bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {barbershops.length} barberías
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateBarbershop(true)}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nueva barbería
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {barbershops.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {barbershops.map((shop) => (
                    <div key={shop.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{shop.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                          <p className="mt-1 font-bold text-slate-300">{shop.city || 'Sin ciudad'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Propietario</p>
                          <p className="mt-1 font-bold text-slate-300 break-all">{shop.ownerEmail || 'Sin correo del dueño'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex px-3 py-2 rounded-xl border border-cyan-300/15 bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                          <span className="text-sm font-black text-white">{branchCountByBarbershopId[String(shop.id)] || 0} suc.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(220px,1.2fr)_160px_minmax(260px,1.2fr)_140px_140px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
                    <span>Barbería</span>
                    <span>Ciudad</span>
                    <span>Propietario</span>
                    <span>Plan</span>
                    <span>Sucursales</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {barbershops.map((shop) => (
                      <div
                        key={shop.id}
                        className="grid grid-cols-[minmax(220px,1.2fr)_160px_minmax(260px,1.2fr)_140px_140px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-black uppercase italic tracking-tighter text-white break-all">
                            {shop.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {shop.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {shop.ownerEmail || 'Sin correo del dueño'}
                          </p>
                          {shop.phone && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              {shop.phone}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="inline-flex px-3 py-2 rounded-xl border border-cyan-300/15 bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-black text-white">
                            {branchCountByBarbershopId[String(shop.id)] || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay barberías registradas</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'branches' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Cobertura</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Sucursales registradas</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                {isSuperAdmin && (
                  <div className="w-full sm:w-[260px]">
                    <select
                      value={effectiveBranchesBarbershopId}
                      onChange={(e) => setSelectedBranchesBarbershopId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="all">Todas las barberías</option>
                      {barbershops.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetBranchForm();
                    setShowBranchForm(true);
                  }}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nueva sucursal
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {filteredBranches.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {filteredBranches.map((branch) => (
                    <div key={branch.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{branch.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Barbería</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.barbershopName || currentBarbershop?.name || 'Sin barbería'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Código</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.code || 'Sin codigo'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.city || 'Sin ciudad'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Dirección</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.address || 'Sin dirección'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startBranchEdit(branch)}
                          className="mt-2 w-full px-4 py-3 rounded-[1.3rem] bg-white/5 hover:bg-indigo-600 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center justify-center gap-2"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_140px_150px_minmax(260px,1.3fr)_130px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
                    <span>Sucursal</span>
                    <span>Barbería</span>
                    <span>Código</span>
                    <span>Ciudad</span>
                    <span>Dirección</span>
                    <span>Acciones</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {filteredBranches.map((branch) => (
                      <div
                        key={branch.id}
                        className="grid grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_140px_150px_minmax(260px,1.3fr)_130px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-black uppercase italic tracking-tighter text-white break-all">
                            {branch.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {branch.barbershopName || currentBarbershop?.name || 'Sin barbería'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {branch.code || 'Sin codigo'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {branch.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {branch.address || 'Sin dirección'}
                          </p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => startBranchEdit(branch)}
                            className="px-4 py-3 rounded-[1.3rem] bg-white/5 hover:bg-indigo-600 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay sucursales registradas</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'users' && (
      <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <h4 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Usuarios del sistema</h4>
            </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
              {canCreateUsers && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser((prev) => !prev)}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} /> {showCreateUser ? 'Cerrar alta' : 'Nuevo usuario'}
                </button>
              )}
              {isSuperAdmin && (
                <div className="w-full sm:w-[260px]">
                  <select
                    value={effectiveUsersBarbershopId}
                    onChange={(e) => {
                      setSelectedUsersBarbershopId(e.target.value);
                      setSelectedUsersBranchId('all');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todas las barberías</option>
                    {barbershops.map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(isSuperAdmin ? effectiveUsersBarbershopId !== 'all' : branchesForCurrentBarbershop.length > 0) && (
                <div className="w-full sm:w-[240px]">
                  <select
                    value={effectiveUsersBranchId}
                    onChange={(e) => setSelectedUsersBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todas las sucursales</option>
                    {(isSuperAdmin ? branchesForSelectedUsersBarbershop : branchesForCurrentBarbershop).map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full xl:w-[360px] relative">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo, rol, barbería o sucursal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] pl-5 pr-12 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-5">
          {canCreateUsers && showCreateUser && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
              <div className="w-full max-w-4xl bg-slate-950 border border-cyan-300/15 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
                >
                  <X size={20} />
                </button>

                <form onSubmit={handleSubmitNewUser}>
                  <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="w-14 h-14 rounded-[1.6rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(99,102,241,0.35)] shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                          Nuevo usuario
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mt-2 leading-none">
                          Control de accesos
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre completo</label>
                      <input
                        value={newUser.fullName}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Ej. Administrador Sistema"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo de acceso</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Ej. admin@barberia.com"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Contraseña temporal</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={`Minimo ${PASSWORD_MIN_LENGTH} caracteres`}
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-[1fr_1fr_1.2fr_1.2fr]' : 'md:grid-cols-[1fr_1fr_1.2fr]'} gap-6`}>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rol de acceso</label>
                        <select
                          value={effectiveNewUserRole}
                          onChange={(e) => setNewUser((prev) => ({ ...prev, roleName: e.target.value }))}
                          disabled={!isSuperAdmin}
                          className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic disabled:opacity-60"
                        >
                          {isSuperAdmin && <option value="admin">Administrador</option>}
                          <option value="cashier">Caja</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Estado de cuenta</label>
                        <div className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white italic">
                          Activo
                        </div>
                      </div>

                      {isSuperAdmin && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Barbería</label>
                          <select
                            value={effectiveNewUserBarbershopId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, barbershopId: e.target.value, branchId: '' }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">Selecciona una barbería</option>
                            {barbershops.map((shop) => (
                              <option key={shop.id} value={shop.id}>{shop.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(isSuperAdmin ? availableBranchOptionsForNewUser.length > 0 : branchesForCurrentBarbershop.length > 0) && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sucursal</label>
                          <select
                            value={effectiveNewUserBranchId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, branchId: e.target.value }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">General / sin sucursal</option>
                            {(isSuperAdmin ? availableBranchOptionsForNewUser : branchesForCurrentBarbershop).map((branch) => (
                              <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                    >
                      {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Guardar configuración de acceso
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
{users.length > 0 && (
            <>
            <div className="grid gap-4 md:hidden">
              {users.map((user) => {
                const primaryRole = getPrimaryRole(user);
                const roleMeta = primaryRole
                  ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                  : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                const displayName = user.fullName || user.email || 'Usuario sin nombre';
                const scopeLabel = isSuperAdmin
                  ? [user.barbershopName, user.branchName].filter(Boolean).join(' • ')
                  : (user.branchName || '');
                return (
                  <div key={user.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{displayName}</p>
                        <p className="mt-2 text-sm font-bold text-slate-300 break-all">{user.email || 'Sin correo'}</p>
                      </div>
                      <span className={`inline-flex shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${roleMeta.badge}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                    {scopeLabel && (
                      <p className="mt-4 text-[11px] font-bold text-slate-500 break-words">{scopeLabel}</p>
                    )}
                    {canResetPasswordForUser(user) && (
                      <button
                        type="button"
                        onClick={() => setResetPasswordTarget(user)}
                        className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400 hover:text-indigo-300 transition-all"
                      >
                        Restablecer contraseña
                      </button>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-300">{formatUserCreatedAt(user.createdAt)}</span>
                      {canEditUser(user) ? (
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          disabled={savingUserId === user.id}
                          className="px-4 py-3 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2 disabled:opacity-60"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Sin edición</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-hidden">
              <div className="grid grid-cols-[minmax(170px,1.15fr)_minmax(230px,1.45fr)_minmax(120px,0.7fr)_115px_112px] gap-3 px-5 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                <span>Nombre de usuario</span>
                <span>Correo</span>
                <span>Rol</span>
                <span>Fecha de alta</span>
                <span>Acciones</span>
              </div>

              <div className="divide-y divide-white/5">
                {users.map((user) => {
                  const primaryRole = getPrimaryRole(user);
                  const roleMeta = primaryRole
                    ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                    : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                  const displayName = user.fullName || user.email || 'Usuario sin nombre';

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-[minmax(170px,1.15fr)_minmax(230px,1.45fr)_minmax(120px,0.7fr)_115px_112px] gap-3 px-5 py-5 items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase italic tracking-tighter text-white break-words">
                          {displayName}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-300 break-all leading-relaxed">
                          {user.email || 'Sin correo'}
                        </p>
                        {(() => {
                          const scopeLabel = isSuperAdmin
                            ? [user.barbershopName, user.branchName].filter(Boolean).join(' • ')
                            : (user.branchName || '');
                          return scopeLabel ? (
                            <p className="mt-1 text-[10px] text-slate-500 truncate">
                              {scopeLabel}
                            </p>
                          ) : null;
                        })()}
                        {canResetPasswordForUser(user) && (
                          <button
                            type="button"
                            onClick={() => setResetPasswordTarget(user)}
                            className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-400 hover:text-indigo-300 transition-all"
                          >
                            Restablecer contraseña
                          </button>
                        )}
                      </div>

                      <div>
                        <span className={`inline-flex max-w-full px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.16em] ${roleMeta.badge}`}>
                          {roleMeta.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-300">
                        {formatUserCreatedAt(user.createdAt)}
                      </div>

                      <div className="flex items-center justify-end">
                        {canEditUser(user) ? (
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            disabled={savingUserId === user.id}
                            className="w-full px-3 py-2.5 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[9px] tracking-[0.14em] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        ) : (
                          <span className="text-right text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                            Sin edición
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {!users.length && (
            <div className="rounded-[2.4rem] border border-dashed border-slate-800 bg-black/20 px-8 py-16 text-center">
              <p className="text-[11px] font-black uppercase italic tracking-[0.24em] text-slate-500">
            No encontramos usuarios con ese criterio de búsqueda
              </p>
            </div>
          )}

          {resetPasswordTarget && (
            <Suspense fallback={accessUiFallback}>
                <PasswordActionModal
              title="Contraseña temporal"
              subtitle={resetPasswordTarget.fullName || resetPasswordTarget.email}
              submitLabel="Guardar contraseña temporal"
              busy={resettingPasswordUserId === resetPasswordTarget.id}
                  onClose={() => setResetPasswordTarget(null)}
                  onSubmit={async ({ nextPassword }) => {
                    const success = await onResetUserPassword(resetPasswordTarget, nextPassword);
                    if (success) {
                      notify(`Contraseña temporal actualizada para ${resetPasswordTarget.email}.`, 'success');
                      setResetPasswordTarget(null);
                      return true;
                    }
                    return false;
                  }}
                  nextLabel="Nueva contraseña temporal"
                  nextPlaceholder="Minimo 6 caracteres"
                  initialNextPassword=""
                  initialConfirmPassword=""
                  nextInputType="password"
                  confirmInputType="password"
                />
            </Suspense>
              )}

          {editingUser && (
            <Suspense fallback={accessUiFallback}>
            <UserEditorModal
              key={editingUser.id}
              user={editingUser}
              roleOptions={getEditableRoleOptionsForUser(editingUser)}
              barbershops={isSuperAdmin ? barbershops : [currentBarbershop].filter(Boolean)}
              branches={isSuperAdmin ? branches : branchesForCurrentBarbershop}
              isSuperAdmin={isSuperAdmin}
              busy={savingUserId === editingUser.id}
              onClose={() => setEditingUser(null)}
              onSubmit={handleSubmitEditUser}
            />
            </Suspense>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

function PublicBookingView() {
  const today = getTodayString();
  const maxDate = formatLocalDateYmd(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [publicPicker, setPublicPicker] = useState(null);
  const [snapshot, setSnapshot] = useState({ barbershop: null, branch: null, services: [], barbers: [], appointments: [] });
  const [form, setForm] = useState({
    serviceId: '',
    barberId: '',
    date: today,
    time: '',
    guestName: '',
    guestPhone: '',
    claimsExistingClient: false,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!hasSupabaseConfig) {
        setError('Esta instalacion no tiene Supabase configurado.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchPublicBookingSnapshot(today, maxDate);
        if (cancelled) return;
        const services = (Array.isArray(data.services) ? data.services : []).filter((service) => {
          const category = String(service?.category || '').toLowerCase();
          const name = String(service?.name || '').toLowerCase();
          return category !== 'producto' && category !== 'promocion' && category !== 'promociones' && !name.startsWith('descuento');
        });
        const barbers = Array.isArray(data.barbers) ? data.barbers : [];
        setSnapshot({
          barbershop: data.barbershop || null,
          branch: data.branch || null,
          services,
          barbers,
          appointments: Array.isArray(data.appointments) ? data.appointments : [],
        });
        setForm((prev) => ({
          ...prev,
          serviceId: prev.serviceId || services[0]?.id || '',
          barberId: prev.barberId || barbers[0]?.id || '',
        }));
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || 'No pude cargar las reservas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [maxDate, today]);

  const selectedService = snapshot.services.find((service) => String(service.id) === String(form.serviceId));
  const selectedBarber = snapshot.barbers.find((barber) => String(barber.id) === String(form.barberId));
  const occupiedTimes = useMemo(() => new Set((snapshot.appointments || [])
    .filter((appointment) => String(appointment.barber_id) === String(form.barberId) && standardizeDate(appointment.appointment_date) === standardizeDate(form.date))
    .map((appointment) => safeTimeLabel(appointment.appointment_time))), [snapshot.appointments, form.barberId, form.date]);
  const availableTimes = HOURS.filter((hour) => !occupiedTimes.has(hour));

  useEffect(() => {
    if (form.time && !availableTimes.includes(form.time)) {
      setForm((prev) => ({ ...prev, time: '' }));
    }
  }, [availableTimes, form.time]);

  const formatPublicTime = (time) => {
    if (!time) return '';
    const [hourRaw, minuteRaw] = String(time).split(':').map(Number);
    const suffix = hourRaw >= 12 ? 'p. m.' : 'a. m.';
    const hour = hourRaw % 12 || 12;
    return `${hour}:${String(Number.isFinite(minuteRaw) ? minuteRaw : 0).padStart(2, '0')} ${suffix}`;
  };

  const formatGuestDisplayName = (value) => String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.serviceId || !form.barberId || !form.date || !form.time || !form.guestName.trim() || !form.guestPhone.trim()) {
      setError('Completa servicio, barbero, fecha, hora, nombre y telefono.');
      return;
    }
    const guestDisplayName = formatGuestDisplayName(form.guestName);
    setSaving(true);
    try {
      await createPublicBooking({
        serviceId: form.serviceId,
        barberId: form.barberId,
        date: form.date,
        time: form.time,
        guestName: guestDisplayName,
        guestPhone: formatPhoneNumber(form.guestPhone),
        claimsExistingClient: form.claimsExistingClient,
        notes: 'Reserva creada desde plataforma publica.',
      });
      setSuccess({
        name: guestDisplayName,
        date: form.date,
        time: form.time,
        service: selectedService?.name || 'Servicio',
        barber: selectedBarber?.name || 'Barbero',
      });
      const data = await fetchPublicBookingSnapshot(today, maxDate);
      setSnapshot((prev) => ({ ...prev, appointments: Array.isArray(data.appointments) ? data.appointments : prev.appointments }));
    } catch (saveError) {
      setError(saveError?.message || 'No pude guardar la reserva.');
    } finally {
      setSaving(false);
    }
  };


  const canSubmit = Boolean(form.serviceId && form.barberId && form.date && form.time && form.guestName.trim() && form.guestPhone.trim());
  const selectedDateLabel = (() => {
    if (!form.date) return '';
    const parsed = new Date(`${form.date}T12:00:00`);
    return parsed.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' });
  })();
  const FieldButton = ({ label, value, placeholder, onClick }) => (
    <button type="button" onClick={onClick} className="group w-full border-b border-cyan-300/20 pb-5 text-left transition-colors hover:border-cyan-300/60">
      <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">{label}</span>
      <span className={`mt-5 flex items-center justify-between gap-4 text-xl font-black uppercase italic tracking-wide ${value ? 'text-white' : 'text-slate-500'}`}>
        <span className="line-clamp-1">{value || placeholder}</span>
        <ChevronDown size={20} className="shrink-0 text-slate-500 transition-colors group-hover:text-cyan-300" />
      </span>
    </button>
  );

  const pickerTitle = publicPicker === 'service'
    ? 'Selecciona un servicio'
    : publicPicker === 'barber'
      ? 'Selecciona un barbero'
      : publicPicker === 'time'
        ? 'Selecciona una hora'
        : '';

  return (
    <div className="min-h-screen bg-[#020714] text-white">
      <style>{styleTag}</style>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-8 md:px-10">
        <main className="w-full">
          <header className="mb-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/barberpro-logo-ui.png" alt="BarberPro" className="h-12 w-12 object-contain" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">Reservaciones</p>
                <p className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-slate-400">{snapshot.barbershop?.name || 'BarberPro'}</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-cyan-300/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:inline-flex">{snapshot.branch?.name || 'Sucursal principal'}</span>
          </header>

          {loading ? (
            <section className="flex min-h-[28rem] flex-col items-center justify-center gap-4 border-y border-cyan-300/15 text-slate-400">
              <Loader2 className="animate-spin text-cyan-300" size={42} />
              <p className="text-[11px] font-black uppercase tracking-[0.22em]">Cargando disponibilidad</p>
            </section>
          ) : success ? (
            <section className="max-w-3xl border-y border-cyan-300/15 py-12">
              <CheckCircle2 className="text-cyan-300" size={56} />
              <h1 className="mt-5 text-5xl font-black uppercase italic tracking-tight text-white md:text-6xl">Reserva recibida</h1>
              <p className="mt-5 max-w-xl text-lg font-bold leading-8 text-slate-300"><span className="font-black text-white">{success.name}</span>, te esperamos el {success.date} a las {formatPublicTime(success.time)}.</p>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-cyan-200">{success.service} con {success.barber}</p>
              <button type="button" onClick={() => { setSuccess(null); setForm((prev) => ({ ...prev, time: '', guestName: '', guestPhone: '', claimsExistingClient: false, notes: '' })); }} className="mt-10 border-b border-cyan-300 pb-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Hacer otra reserva</button>
            </section>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-4xl">
              <p className="text-[12px] font-black uppercase tracking-[0.28em] text-slate-300">Reserva online</p>
              <h1 className="mt-6 text-5xl font-black uppercase italic tracking-tight text-white md:text-6xl">Agenda tu corte</h1>
              <p className="mt-5 max-w-2xl text-sm font-bold leading-7 text-slate-400">Completa tus datos y elige servicio, barbero y horario disponible.</p>

              {error && <div className="mt-8 border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-100">{error}</div>}

              <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
                <label className="block border-b border-cyan-300/20 pb-5">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Nombre completo</span>
                  <input value={form.guestName} onChange={(event) => setForm((prev) => ({ ...prev, guestName: event.target.value }))} className="mt-5 w-full bg-transparent text-xl font-black uppercase italic tracking-wide text-white outline-none placeholder:text-slate-500" placeholder="Carlos Mendoza" />
                </label>

                <label className="block border-b border-cyan-300/20 pb-5">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">WhatsApp</span>
                  <input value={form.guestPhone} onChange={(event) => setForm((prev) => ({ ...prev, guestPhone: event.target.value }))} className="mt-5 w-full bg-transparent text-xl font-black tracking-wide text-white outline-none placeholder:text-slate-500" placeholder="+505 8888 8888" />
                </label>

                <FieldButton label="Servicio" value={selectedService ? `${selectedService.name} - C$ ${Number(selectedService.price || 0).toLocaleString()}` : ''} placeholder="Selecciona un servicio" onClick={() => setPublicPicker('service')} />
                <FieldButton label="Barbero" value={selectedBarber?.name || ''} placeholder="Selecciona un barbero" onClick={() => setPublicPicker('barber')} />

                <label className="block border-b border-cyan-300/20 pb-5">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Fecha preferida</span>
                  <input type="date" min={today} max={maxDate} value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value, time: '' }))} className="mt-5 w-full bg-transparent text-xl font-black uppercase italic tracking-wide text-white outline-none [color-scheme:dark]" />
                </label>

                <FieldButton label="Hora preferida" value={form.time ? formatPublicTime(form.time) : ''} placeholder="Seleccionar hora" onClick={() => setPublicPicker('time')} />

                <label className="block border-b border-cyan-300/20 pb-5 md:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Notas adicionales (opcional)</span>
                  <input value={form.notes || ''} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-5 w-full bg-transparent text-xl font-black uppercase italic tracking-wide text-white outline-none placeholder:text-slate-500" placeholder="Algun requerimiento especial?" />
                </label>
              </div>

              <div className="mt-8 flex flex-col gap-5 border-b border-cyan-300/20 pb-8 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  <input type="checkbox" checked={form.claimsExistingClient} onChange={(event) => setForm((prev) => ({ ...prev, claimsExistingClient: event.target.checked }))} className="h-4 w-4 accent-cyan-300" />
                  Ya soy cliente de esta barberia
                </label>
                <div className="text-sm font-bold text-slate-400 md:text-right">
                  <p className="capitalize text-cyan-200">{selectedDateLabel || 'Selecciona una fecha'}</p>
                  <p>{selectedService?.name || 'Servicio'} {form.time ? `� ${formatPublicTime(form.time)}` : ''}</p>
                </div>
              </div>

              <button type="submit" disabled={saving || !canSubmit} className="mt-8 inline-flex min-w-64 items-center justify-center gap-3 border border-cyan-300 bg-cyan-300 px-8 py-4 text-[12px] font-black uppercase tracking-[0.2em] text-slate-950 transition-all hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-transparent disabled:text-slate-500">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CalendarCheck size={18} />} Confirmar reserva
              </button>
            </form>
          )}
        </main>
      </div>

      {publicPicker && !loading && !success && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md" onClick={() => setPublicPicker(null)}>
          <section className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-cyan-300/20 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.6)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-cyan-300/15 px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Reservacion</p>
                <h2 className="mt-1 text-2xl font-black italic text-white">{pickerTitle}</h2>
              </div>
              <button type="button" onClick={() => setPublicPicker(null)} className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 text-slate-300 hover:border-cyan-300 hover:text-cyan-200"><X size={20} /></button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-4">
              {publicPicker === 'service' && <div className="grid gap-3 sm:grid-cols-2">{snapshot.services.map((service) => {
                const active = String(form.serviceId) === String(service.id);
                return <button key={service.id} type="button" onClick={() => { setForm((prev) => ({ ...prev, serviceId: service.id })); setPublicPicker(null); }} className={`border p-4 text-left transition-all ${active ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-cyan-300/20 bg-slate-900/80 text-white hover:border-cyan-300/60'}`}><p className="text-sm font-black uppercase italic">{service.name}</p><p className={`mt-2 text-lg font-black ${active ? 'text-slate-950' : 'text-emerald-300'}`}>C$ {Number(service.price || 0).toLocaleString()}</p></button>;
              })}</div>}

              {publicPicker === 'barber' && <div className="grid gap-3 sm:grid-cols-2">{snapshot.barbers.map((barber) => {
                const active = String(form.barberId) === String(barber.id);
                const initials = String(barber.name || 'BP').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'BP';
                return <button key={barber.id} type="button" onClick={() => { setForm((prev) => ({ ...prev, barberId: barber.id, time: '' })); setPublicPicker(null); }} className={`flex items-center gap-3 border p-4 text-left transition-all ${active ? 'border-emerald-300 bg-emerald-300/15' : 'border-cyan-300/20 bg-slate-900/80 hover:border-emerald-300/60'}`}><span className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: barber.color || barber.bg || '#4de1ff' }}>{initials}</span><span><span className="block text-sm font-black uppercase italic text-white">{barber.name}</span><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Barbero disponible</span></span></button>;
              })}</div>}

              {publicPicker === 'time' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{availableTimes.map((time) => <button key={time} type="button" onClick={() => { setForm((prev) => ({ ...prev, time })); setPublicPicker(null); }} className={`border px-4 py-4 text-sm font-black uppercase tracking-[0.1em] transition-all ${form.time === time ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-cyan-300/20 bg-slate-900/80 text-white hover:border-cyan-300/60'}`}>{formatPublicTime(time)}</button>)}{availableTimes.length === 0 && <p className="col-span-full border border-dashed border-cyan-300/20 p-5 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">No hay horarios disponibles ese dia.</p>}</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const safeTimeLabel = (value) => {
  if (!value) return '';
  const [hour = '00', minute = '00'] = String(value).split(':');
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
export default function App() {
  const getScopedActiveTabStorageKey = React.useCallback(
    (userId) => `${AUTH_RUNTIME_CACHE_KEY}:activeTab:${userId}`,
    [],
  );

const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);
  const [accessControl, setAccessControl] = useState({ roles: [], users: [], currentUserRoles: [], currentBarbershopId: null, currentBranchId: null, barbershops: [], branches: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(!hasSupabaseConfig);
  const [clientDirectoryData, setClientDirectoryData] = useState({ clients: [], appointments: [], barbers: [] });
  const [clientDirectoryLoaded, setClientDirectoryLoaded] = useState(false);
  const [clientDirectoryWarnings, setClientDirectoryWarnings] = useState([]);
  const [operationalWarnings, setOperationalWarnings] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [superAdminViewBarbershopId, setSuperAdminViewBarbershopId] = useState('');
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [feedbackToastQueue, setFeedbackToastQueue] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const feedbackTimerRef = useRef(null);
  const reservationNearExpiryAlertsRef = useRef(new Set());
  const reservationExpiredAlertsRef = useRef(new Set());
  const reservationProcessingAlertsRef = useRef(new Set());
  
  const useBrowserCache = isLocalDevModeEnabled && !hasSupabaseConfig && !shouldBlockWithoutSupabase;
  const localDevStorage = useBrowserCache ? globalThis.sessionStorage : null;
  const [appointments, setAppointments] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_appointments') || null;
    const list = saved ? JSON.parse(saved) : [];
    return list.map(a => ({
      ...a,
      type: a.type || 'reserva',
      status: a.status || 'Confirmada',
      durationMinutes: Number(a.durationMinutes) > 0 ? Number(a.durationMinutes) : 30,
      isPaid: !!a.isPaid
    }));
  });
  
  const [services, setServices] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_services') || null;
    if (saved) return JSON.parse(saved);
    if (!shouldSeedLocalDevMode) return [];
    return [
      { id: '1', name: 'Corte Clásico', price: 250, category: 'Cortes' },
      { id: '2', name: 'Perfilado Barba', price: 150, category: 'Barba' },
      { id: '3', name: 'Pomada Premium', price: 350, category: 'Producto' },
      { id: '4', name: 'Combo Master', price: 400, category: 'Combo', items: ['1', '2'] },
      {
        id: '5',
        name: 'Corte gratis por fidelidad',
        price: 0,
        category: 'Promocion',
        appliesTo: 'Servicio',
        discountType: 'percentage',
        discountValue: 100,
        targetServiceIds: ['1'],
        isOptional: true,
      },
    ];
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [catalogSettings, setCatalogSettings] = useState({
    serviceCategories: CATEGORIES,
    inventoryProductCategories: INVENTORY_PRODUCT_CATEGORIES,
  });
  const serviceMenuItems = useMemo(() => buildServiceMenuItems(services, inventoryItems), [services, inventoryItems]);
  
  const [clients, setClients] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_clients') || null;
    const list = saved ? JSON.parse(saved) : (
      !shouldSeedLocalDevMode
        ? []
        : [{ id: 'c1', name: 'Carlos Mendoza', phone: '8888-0001', notes: 'Prefiere corte con tijera arriba.', points: 5, createdAt: new Date().toISOString() }]
    );
    return list.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') }));
  });

  const [barbers, setBarbers] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_barbers') || null;
    const list = saved ? JSON.parse(saved) : (!shouldSeedLocalDevMode ? [] : MOCK_BARBERS.map(b => ({ ...b, salary: 0, phone: '', email: '' })));
    return list.map((b, idx) => ensureBarberTheme(b, idx));
  });
  const [posSales, setPosSales] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_pos_sales') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [cashSessions, setCashSessions] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_cash_sessions') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [cashMovements, setCashMovements] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_cash_movements') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [cashWithdrawals, setCashWithdrawals] = useState([]);
  const [payrollSettlements, setPayrollSettlements] = useState([]);
  
  const [viewDate, setViewDate] = useState(getTodayString());
  const bootstrapCompletedRef = useRef(false);
  const hydratedFromCacheRef = useRef(false);
  const cacheRestoreAttemptedRef = useRef(false);
  const activeTabHydratedRef = useRef(false);
  const lastSessionUserIdRef = useRef(null);
  const currentUserRoles = useMemo(() => accessControl.currentUserRoles || [], [accessControl.currentUserRoles]);
  const isSuperAdmin = currentUserRoles.includes('super_admin');
  const sessionUserId = session?.user?.id || '';
  const availableBarbershops = useMemo(() => accessControl.barbershops || [], [accessControl.barbershops]);
  const availableBranches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const effectiveOperationalBarbershopId = isSuperAdmin
    ? (superAdminViewBarbershopId || availableBarbershops[0]?.id || null)
    : (accessControl.currentBarbershopId || null);
  const resolvedOperationalBarbershopId = effectiveOperationalBarbershopId || availableBarbershops[0]?.id || null;
  const effectiveOperationalBranchId = isSuperAdmin
    ? (
        availableBranches.find((branch) => String(branch.barbershopId || '') === String(resolvedOperationalBarbershopId || ''))?.id
        || null
      )
    : (accessControl.currentBranchId || null);
  const resolvedOperationalBranchId = effectiveOperationalBranchId
    || availableBranches.find((branch) => String(branch.barbershopId || '') === String(resolvedOperationalBarbershopId || ''))?.id
    || null;
  const superAdminScopeOverride = useMemo(() => (
    isSuperAdmin && resolvedOperationalBarbershopId
      ? { currentBarbershopId: resolvedOperationalBarbershopId, currentBranchId: resolvedOperationalBranchId }
      : {}
  ), [isSuperAdmin, resolvedOperationalBarbershopId, resolvedOperationalBranchId]);

  const dismissFeedbackToast = React.useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setFeedbackToast(null);
  }, []);

  const notify = React.useCallback((message, tone = 'info') => {
    const nextToast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      tone,
    };

    setFeedbackToastQueue((currentQueue) => [...currentQueue, nextToast]);
  }, []);

  useEffect(() => {
    if (feedbackToast || feedbackToastQueue.length === 0) return;

    const [nextToast, ...remainingQueue] = feedbackToastQueue;
    const requiresAcknowledgement =
      nextToast.tone === 'reservation-warning' || nextToast.tone === 'reservation-expired';

    setFeedbackToast(nextToast);
    setFeedbackToastQueue(remainingQueue);

    if (!requiresAcknowledgement) {
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackToast(null);
        feedbackTimerRef.current = null;
      }, 3600);
    }
  }, [feedbackToast, feedbackToastQueue]);

  const renderPersistentWarningBanner = (title, messages = []) => (
    <div className="mx-8 mt-6 rounded-[1.8rem] border border-amber-500/25 bg-amber-500/10 px-6 py-5 text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Info size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300 leading-none">{title}</p>
          <div className="mt-3 space-y-2">
            {messages.map((message, index) => (
              <p key={`${title}-${index}`} className="text-sm font-bold leading-relaxed text-amber-50">
                {message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const confirmAction = (options) => new Promise((resolve) => {
    setConfirmState({
      title: options?.title || 'Confirmar acción',
      message: options?.message || '',
      confirmLabel: options?.confirmLabel || 'Confirmar',
      cancelLabel: options?.cancelLabel || 'Cancelar',
      tone: options?.tone || 'danger',
      resolve,
    });
  });

  const feedbackContextValue = useMemo(() => ({
    notify,
    confirmAction,
  }), [notify]);

  const clearScopedOperationalState = () => {
    setAppointments([]);
    setServices([]);
    setInventoryItems([]);
    setCatalogSettings({
      serviceCategories: CATEGORIES,
      inventoryProductCategories: INVENTORY_PRODUCT_CATEGORIES,
    });
    setClients([]);
    setBarbers([]);
    setPosSales([]);
    setCashSessions([]);
    setCashMovements([]);
    setCashWithdrawals([]);
    setPayrollSettlements([]);
    setOperationalWarnings([]);
    setClientDirectoryData({ clients: [], appointments: [], barbers: [] });
    setClientDirectoryLoaded(false);
    setClientDirectoryWarnings([]);
  };

  const restoreRuntimeCache = React.useCallback((userId) => {
    if (!userId || cacheRestoreAttemptedRef.current) return false;

    // Datos operativos reales no deben restaurarse desde localStorage. Supabase
    // es la fuente de verdad; el navegador solo conserva preferencias de UI.
    cacheRestoreAttemptedRef.current = true;
    hydratedFromCacheRef.current = false;
    bootstrapCompletedRef.current = false;
    return false;
  }, []);

  useEffect(() => () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    if (confirmState?.resolve) {
      confirmState.resolve(false);
    }
  }, [confirmState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionUserId) return undefined;

    window.localStorage.setItem(getScopedActiveTabStorageKey(sessionUserId), activeTab);
    return undefined;
  }, [activeTab, getScopedActiveTabStorageKey, sessionUserId]);

  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_appointments', JSON.stringify(appointments));
  }, [appointments, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_services', JSON.stringify(services));
  }, [services, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_clients', JSON.stringify(clients));
  }, [clients, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_barbers', JSON.stringify(barbers));
  }, [barbers, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_pos_sales', JSON.stringify(posSales));
  }, [posSales, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_cash_sessions', JSON.stringify(cashSessions));
  }, [cashSessions, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_cash_movements', JSON.stringify(cashMovements));
  }, [cashMovements, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.removeItem('bp_dev_revenue');
  }, [useBrowserCache, localDevStorage]);
  const [modals, setModals] = useState({ 
    appointment: false, quickAppointment: false, cashWithdrawal: false, payrollHistory: false, service: false, finalize: false, client: false, clientDetail: false, appointmentActions: false, rescheduleAppointment: false, transferAppointment: false, paymentReceipt: false, staffSettlement: false, posSaleReceipt: false, cashClosureReceipt: false
  });
  
  const [selectedData, setSelectedData] = useState({ 
    appointment: null, quickAppointment: null, cashWithdrawal: null, payrollHistory: null, service: null, finalize: null, client: null, appointmentActions: null, rescheduleAppointment: null, transferAppointment: null, paymentReceipt: null, staffSettlement: null, posSaleReceipt: null, cashClosureReceipt: null
  });

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    let authBootstrapTimedOut = false;
    const authBootstrapTimeout = window.setTimeout(() => {
      if (!mounted) return;
      authBootstrapTimedOut = true;
      console.error('La restauración de sesión tardó demasiado y se canceló para mostrar el login.');
      setSession(null);
      setAuthError('La sesión guardada tardó demasiado en responder. Ingresa de nuevo.');
      setAuthLoading(false);
    }, 6000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted || authBootstrapTimedOut) return;
        window.clearTimeout(authBootstrapTimeout);
        if (error) {
          console.error('No se pudo restaurar la sesión:', error);
          setAuthError('No pude restaurar la sesión guardada.');
        }
        const restoredSession = data.session ?? null;
        const restoredUserId = restoredSession?.user?.id || null;
        lastSessionUserIdRef.current = restoredUserId;
        cacheRestoreAttemptedRef.current = false;
        if (restoredUserId) {
          restoreRuntimeCache(restoredUserId);
        }
        setSession(restoredSession);
        setAuthLoading(false);
      })
      .catch((error) => {
        if (!mounted || authBootstrapTimedOut) return;
        window.clearTimeout(authBootstrapTimeout);
        console.error('Falló la verificación de sesión:', error);
        setSession(null);
        setAuthError('No pude verificar la sesión guardada. Ingresa de nuevo.');
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      const previousUserId = lastSessionUserIdRef.current;
      const nextUserId = nextSession?.user?.id || null;
      const userChanged = previousUserId !== nextUserId;

      if (userChanged) {
        bootstrapCompletedRef.current = false;
        hydratedFromCacheRef.current = false;
        cacheRestoreAttemptedRef.current = false;
        activeTabHydratedRef.current = false;
        setAccessLoaded(false);
        clearScopedOperationalState();
        setActiveTab('dashboard');
        if (nextUserId) {
          restoreRuntimeCache(nextUserId);
          setLoading(!hydratedFromCacheRef.current);
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN' && nextUserId && !cacheRestoreAttemptedRef.current) {
        restoreRuntimeCache(nextUserId);
      }
      lastSessionUserIdRef.current = nextUserId;
      if (userChanged || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        setSession(nextSession ?? null);
      }
      setAuthError('');
    });

    return () => {
      mounted = false;
      window.clearTimeout(authBootstrapTimeout);
      subscription.unsubscribe();
    };
  }, [restoreRuntimeCache]);

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionUserId || accessLoading || activeTabHydratedRef.current) {
      return undefined;
    }

    const cachedTab = window.localStorage.getItem(getScopedActiveTabStorageKey(sessionUserId));
    if (cachedTab) {
      setActiveTab(cachedTab);
    }

    activeTabHydratedRef.current = true;
    return undefined;
  }, [accessLoading, getScopedActiveTabStorageKey, sessionUserId]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSuperAdminViewBarbershopId('');
      return;
    }

    const hasSelectedBarbershop = availableBarbershops.some(
      (shop) => String(shop.id) === String(superAdminViewBarbershopId || ''),
    );

    if (!hasSelectedBarbershop && availableBarbershops.length) {
      setSuperAdminViewBarbershopId(String(availableBarbershops[0].id));
    }
  }, [isSuperAdmin, availableBarbershops, superAdminViewBarbershopId]);
  
  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      let deferredUntilScopeIsReady = false;
      try {
        if (hasSupabaseConfig) {
          if (!sessionUserId) {
            if (!ignore) {
              clearScopedOperationalState();
              setLoading(false);
            }
            return;
          }
          if (!accessLoaded) {
            deferredUntilScopeIsReady = true;
            if (!ignore) setLoading(true);
            return;
          }
          if (isSuperAdmin && !resolvedOperationalBarbershopId) {
            if (!ignore) {
              clearScopedOperationalState();
              setLoading(false);
            }
            return;
          }
          if (!ignore && !bootstrapCompletedRef.current) setLoading(true);
          const snapshot = await fetchBarbershopSnapshot(sessionUserId, superAdminScopeOverride);
          if (ignore) return;

          setServices(snapshot.services);
          setClients(snapshot.clients);
          setBarbers(snapshot.barbers.map((barber, index) => ensureBarberTheme(barber, index)));
          setAppointments(snapshot.appointments);
          setPosSales(snapshot.posSales || []);
          setCashSessions(snapshot.cashSessions || []);
          setCashMovements(snapshot.cashMovements || []);
          setInventoryItems(snapshot.inventoryItems || []);
          setCatalogSettings({
            serviceCategories: snapshot.catalogs?.serviceCategories?.length ? snapshot.catalogs.serviceCategories : CATEGORIES,
            inventoryProductCategories: snapshot.catalogs?.inventoryProductCategories?.length ? snapshot.catalogs.inventoryProductCategories : INVENTORY_PRODUCT_CATEGORIES,
          });
          setCashWithdrawals(snapshot.cashWithdrawals || []);
          setPayrollSettlements(snapshot.payrollSettlements || []);
          setOperationalWarnings([
            ...(snapshot.posSalesLoadError ? [snapshot.posSalesLoadError] : []),
            ...(snapshot.cashLoadError ? [snapshot.cashLoadError] : []),
            ...(snapshot.inventoryLoadError ? [snapshot.inventoryLoadError] : []),
            ...(snapshot.payrollLoadWarnings || []),
          ]);
          if (snapshot.posSalesLoadError) {
            notify(`Advertencia de POS\n\n${snapshot.posSalesLoadError}`, 'warning');
          }
          if (snapshot.cashLoadError) {
            notify(`Advertencia de caja\n\n${snapshot.cashLoadError}`, 'warning');
          }
          if (snapshot.payrollLoadWarnings?.length) {
            notify(`Advertencia de nómina\n\n${snapshot.payrollLoadWarnings.join('\n\n')}`, 'warning');
          }
          if (snapshot.inventoryLoadError) {
            notify(`Advertencia de inventario\n\n${snapshot.inventoryLoadError}`, 'warning');
          }
        }
      } catch (error) {
        console.error('No se pudo cargar Supabase:', error);
        if (!ignore) {
          const friendlyErrorMessage = getFriendlySupabaseErrorMessage(error, 'dashboard');
          clearScopedOperationalState();
          setOperationalWarnings([
            friendlyErrorMessage,
          ]);
          notify(
            `${friendlyErrorMessage}\n\nMostr\u00e9 el estado vac\u00edo para evitar que se mezclen datos anteriores con informaci\u00f3n incompleta.`,
            'error',
          );
        }
      } finally {
        if (!ignore) {
          if (!deferredUntilScopeIsReady) {
            bootstrapCompletedRef.current = true;
            if (!hydratedFromCacheRef.current) {
              setLoading(false);
            }
          }
        }
      }
    };

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [sessionUserId, accessLoaded, isSuperAdmin, availableBarbershops.length, resolvedOperationalBarbershopId, superAdminScopeOverride, notify]);

  useEffect(() => {
    if (!hasSupabaseConfig || !sessionUserId || typeof window === 'undefined') return undefined;

    const runtimeCache = {
      userId: sessionUserId,
      superAdminViewBarbershopId,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.removeItem('bp_cash_withdrawals_v1');
      window.localStorage.removeItem('bp_payroll_settlements_v1');
      window.localStorage.setItem(AUTH_RUNTIME_CACHE_KEY, JSON.stringify(runtimeCache));
    } catch (error) {
      console.error('No se pudo guardar el cache local de BarberPro:', error);
    }

    return undefined;
  }, [
    sessionUserId,
    superAdminViewBarbershopId,
  ]);

  useEffect(() => {
    if (!hasSupabaseConfig || !sessionUserId) {
      setAccessControl({ roles: [], users: [], currentUserRoles: [], currentBarbershopId: null, currentBranchId: null, barbershops: [], branches: [] });
      setAccessLoaded(!hasSupabaseConfig);
      return undefined;
    }

    let ignore = false;

    const loadAccessControl = async () => {
      setAccessLoading(true);
      setAccessLoaded(false);
      try {
        const snapshot = await fetchAccessControlSnapshot(sessionUserId);
        if (!ignore) {
          setAccessControl(snapshot);
          setAccessLoaded(true);
          if (hydratedFromCacheRef.current) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('No se pudo cargar control de acceso:', error);
        if (!ignore) {
          const friendlyErrorMessage = getFriendlySupabaseErrorMessage(error, 'dashboard');
          setAccessControl({ roles: [], users: [], currentUserRoles: [], currentBarbershopId: null, currentBranchId: null, barbershops: [], branches: [] });
          setAccessLoaded(true);
          notify(`No pude cargar usuarios/sucursales desde Supabase.\n\n${friendlyErrorMessage}`, 'error');
          if (hydratedFromCacheRef.current) {
            setLoading(false);
          }
        }
      } finally {
        if (!ignore) {
          setAccessLoading(false);
        }
      }
    };

    loadAccessControl();

    return () => {
      ignore = true;
    };
  }, [sessionUserId, notify]);

  useEffect(() => {
    setClientDirectoryLoaded(false);
    setClientDirectoryData({ clients: [], appointments: [], barbers: [] });
    setClientDirectoryWarnings([]);
  }, [sessionUserId, resolvedOperationalBarbershopId, superAdminScopeOverride]);

  useEffect(() => {
    if (!hasSupabaseConfig || !sessionUserId || activeTab !== 'clientes' || clientDirectoryLoaded) return undefined;

    let ignore = false;

    const loadClientDirectoryData = async () => {
      try {
        const snapshot = await fetchClientDirectorySnapshot(sessionUserId, superAdminScopeOverride);
        if (!ignore) {
          setClientDirectoryData({
            clients: snapshot.clients.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') })),
            appointments: snapshot.appointments,
            barbers: snapshot.barbers.map((barber, index) => ensureBarberTheme(barber, index)),
          });
          setClientDirectoryWarnings(snapshot.warnings || []);
          if (snapshot.warnings?.length) {
            notify(`Clientes cargados con advertencias\n\n${snapshot.warnings.join('\n\n')}`, 'warning');
          }
          setClientDirectoryLoaded(true);
        }
      } catch (error) {
        console.error('No se pudo cargar el directorio de clientes:', error);
        if (!ignore) {
          setClientDirectoryData({ clients: [], appointments: [], barbers: [] });
          setClientDirectoryWarnings([
            error?.message || 'No se pudo cargar el directorio de clientes.',
          ]);
          setClientDirectoryLoaded(true);
          notify(
            'No pude cargar el directorio de clientes. Dejé la vista vacía para evitar métricas parciales o datos engañosos.',
            'error',
          );
        }
      }
    };

    loadClientDirectoryData();

    return () => {
      ignore = true;
    };
  }, [sessionUserId, activeTab, clientDirectoryLoaded, resolvedOperationalBarbershopId, superAdminScopeOverride, notify]);

  const handleSignIn = async (email, password) => {
    if (!supabase) return;

    setAuthBusy(true);
    setAuthError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthError(getFriendlySupabaseErrorMessage(error, 'login'));
      }
    } catch (error) {
      setAuthError(getFriendlySupabaseErrorMessage(error, 'login'));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;

    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || 'No pude cerrar sesión.');
    } else {
      bootstrapCompletedRef.current = false;
    }
    setAuthBusy(false);
  };

  const handleChangeOwnPassword = async ({ nextPassword }) => {
    if (!supabase) return false;
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
        data: {
          ...(session?.user?.user_metadata || {}),
          must_change_password: false,
        },
      });
      if (error) throw error;
      const { data: refreshedSession } = await supabase.auth.getSession();
      setSession(refreshedSession.session ?? session);
      notify('Tu contraseña se actualizó correctamente.', 'success');
      setShowSelfPasswordModal(false);
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude actualizar tu contraseña.');
      return false;
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => {
    if (session?.user?.user_metadata?.must_change_password) {
      setShowSelfPasswordModal(true);
    }
  }, [session]);

  const handleUpdateUserProfile = async (user, payload) => {
    if (!isAdmin || !user) {
      notify('Solo un administrador puede editar usuarios.', 'warning');
      return false;
    }

    const currentRole = getPrimaryRole(user);
    const nextRole = payload.roleName || currentRole || 'cashier';

    if (!isSuperAdmin) {
      if (currentRole !== 'cashier' || String(user.barbershopId || '') !== String(currentBarbershopId || '')) {
        notify('Solo puedes editar usuarios Caja de tu propia barbería.', 'warning');
        return false;
      }
    }

    if (!isSuperAdmin && nextRole !== 'cashier') {
      notify('Un administrador de barbería solo puede asignar el rol Caja.', 'warning');
      return false;
    }

    const targetBarbershopId = isSuperAdmin
      ? (payload.barbershopId || user.barbershopId || null)
      : (currentBarbershopId || user.barbershopId || null);
    const targetBranchId = payload.branchId || null;

    setSavingUserId(user.id);
    try {
      await updateManagedUserProfile(user.id, {
        fullName: payload.fullName,
        barbershopId: targetBarbershopId,
        branchId: targetBranchId,
      });

      if (nextRole !== currentRole) {
        await replaceUserRoles(user.id, [nextRole]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude actualizar el usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateSystemUser = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear nuevas cuentas.', 'warning');
      return null;
    }

    if (!isSuperAdmin && payload.roleName !== 'cashier') {
      notify('Un administrador de barbería solo puede crear usuarios de caja.', 'warning');
      return null;
    }

    if (!isSuperAdmin && !currentBarbershopId) {
      notify('Tu usuario administrador no tiene una barbería asignada.', 'error');
      return null;
    }

    const normalizedPayload = !isSuperAdmin
      ? {
          ...payload,
          roleName: 'cashier',
          barbershopId: currentBarbershopId,
          branchId: payload.branchId || accessControl.currentBranchId || null,
        }
      : payload;

    setCreatingUser(true);
    try {
      const createdUser = await createManagedUser(normalizedPayload, session?.user?.id);
      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      const createdBarbershop =
        accessControl.barbershops.find((shop) => String(shop.id) === String(createdUser.barbershopId || normalizedPayload.barbershopId || ''))
        || currentBarbershop
        || availableBarbershops[0]
        || null;
      const createdBranch =
        accessControl.branches.find((branch) => String(branch.id) === String(createdUser.branchId || normalizedPayload.branchId || ''))
        || currentBranch
        || null;
      const optimisticUser = {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName || createdUser.email,
        createdAt: new Date().toISOString(),
        roles: [createdUser.roleName || normalizedPayload.roleName],
        barbershopId: createdUser.barbershopId || normalizedPayload.barbershopId || null,
        barbershopName: createdBarbershop?.name || '',
        branchId: createdUser.branchId || normalizedPayload.branchId || null,
        branchName: createdBranch?.name || '',
      };
      const nextSnapshot = snapshot?.users?.some((user) => String(user.id) === String(createdUser.id))
        ? snapshot
        : {
            ...snapshot,
            users: [...(snapshot?.users || []), optimisticUser],
          };
      setAccessControl(nextSnapshot);
      notify(`Usuario ${createdUser.fullName || createdUser.email} creado correctamente.`, 'success');
      return createdUser;
    } catch (error) {
      handleSyncError(error, 'No pude crear el usuario del sistema.');
      return null;
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetUserPassword = async (user, password) => {
    if (!isAdmin) {
      notify('Solo un administrador puede restablecer contraseñas.', 'warning');
      return false;
    }

    if (!isSuperAdmin && getPrimaryRole(user) !== 'cashier') {
      notify('Un administrador de barbería solo puede restablecer contraseñas de usuarios Caja.', 'warning');
      return false;
    }

    setResettingPasswordUserId(user.id);
    try {
      await resetManagedUserPassword({ userId: user.id, password });
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude restablecer la contraseña de este usuario.');
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleCreateBranch = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear sucursales.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const resolvedBarbershopId = isSuperAdmin
        ? payload.barbershopId
        : (currentBarbershopId || currentBarbershop?.id || '');

      if (!resolvedBarbershopId) {
        notify('Selecciona una barbería para crear la sucursal.', 'warning');
        return null;
      }

      const createdBranch = await upsertBranch({
        id: payload.id || makeId(),
        name: payload.name,
        code: payload.code,
        city: payload.city,
        address: payload.address,
        barbershopId: resolvedBarbershopId,
        isActive: payload.isActive ?? true,
      });

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Sucursal ${payload.id ? 'actualizada' : 'creada'} correctamente.`, 'success');
      return createdBranch;
    } catch (error) {
      handleSyncError(error, 'No pude crear la sucursal.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };

  const handleCreateBarbershop = async (payload) => {
    if (!isSuperAdmin) {
      notify('Solo el super usuario puede crear nuevos negocios.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const createdBarbershop = await upsertBarbershop({
        id: makeId(),
        name: payload.name,
        ownerEmail: payload.ownerEmail,
        phone: payload.phone,
        city: payload.city,
        plan: payload.plan,
        isActive: true,
      });

      if (payload.adminUserId) {
        await assignProfileBarbershop(payload.adminUserId, createdBarbershop.id);
        const targetUser = (accessControl.users || []).find((user) => String(user.id) === String(payload.adminUserId));
        const preservedRoles = new Set((targetUser?.roles || []).filter((role) => role === 'super_admin'));
        preservedRoles.add('admin');
        await replaceUserRoles(payload.adminUserId, [...preservedRoles]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Negocio ${createdBarbershop.name} creado correctamente.`, 'success');
      return createdBarbershop;
    } catch (error) {
      handleSyncError(error, 'No pude completar el onboarding del negocio.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };
  const defaultBarberId = barbers[0]?.id || '';
  const currentBarbershopId = resolvedOperationalBarbershopId;
  const currentBranchId = resolvedOperationalBranchId;
  const currentBarbershop = availableBarbershops.find((shop) => String(shop.id) === String(currentBarbershopId || ''))
    || availableBarbershops[0]
    || null;
  const currentBranch = availableBranches.find((branch) => String(branch.id) === String(currentBranchId || '')) || null;
  const activeCashSession = useMemo(() => (
    (cashSessions || []).find((cashSession) => (
      cashSession.status !== 'closed'
      && !cashSession.closedAt
      && String(cashSession.barbershopId || '') === String(currentBarbershopId || '')
      && String(cashSession.branchId || '') === String(currentBranchId || '')
    )) || null
  ), [cashSessions, currentBarbershopId, currentBranchId]);
  const activeCashMovements = useMemo(() => (
    activeCashSession
      ? (cashMovements || []).filter((movement) => String(movement.cashSessionId || '') === String(activeCashSession.id || ''))
      : []
  ), [cashMovements, activeCashSession]);
  const activeCashPosSales = useMemo(() => (
    activeCashSession
      ? (posSales || []).filter((sale) => (
        String(sale.cashSessionId || '') === String(activeCashSession.id || '')
        && !sale.canceledAt
      ))
      : []
  ), [posSales, activeCashSession]);
  const activePosSales = useMemo(
    () => (posSales || []).filter((sale) => !sale.canceledAt),
    [posSales],
  );
  const isAdmin = isSuperAdmin || currentUserRoles.includes('admin');
  const isCashier = currentUserRoles.includes('cashier');
  const effectiveClientDirectory = useMemo(() => ({
    clients: clientDirectoryLoaded
      ? mergeEntitiesById(clients, clientDirectoryData.clients)
      : clients,
    appointments: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.appointments, appointments)
      : appointments,
    barbers: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.barbers, barbers)
      : barbers,
  }), [clientDirectoryLoaded, clientDirectoryData, clients, appointments, barbers]);
  const roleFilterEnabled = hasSupabaseConfig && !accessLoading && currentUserRoles.length > 0;
  const navItems = [
    { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, allow: true },
    { id: 'agenda', label: 'Calendario', icon: CalendarIcon, allow: isAdmin || isCashier },
    { id: 'clientes', label: 'Clientes', icon: Users, allow: isAdmin || isCashier },
    { id: 'barberos', label: 'Barbero', icon: UserCheck, allow: isAdmin },
    { id: 'services', label: 'Servicios', icon: Scissors, allow: isAdmin },
    { id: 'inventario', label: 'Inventario', icon: Package, allow: isAdmin },
    { id: 'caja', label: 'Caja', icon: ShoppingBag, allow: isAdmin || isCashier },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, allow: isAdmin },
    { id: 'sistema', label: 'Sistema', icon: Layers, allow: isAdmin },
  ].filter((item) => {
    return !roleFilterEnabled || item.allow;
  });
  const accessibleTabIds = useMemo(() => {
    const nextIds = new Set(navItems.map((item) => item.id));
    if (isAdmin) {
      nextIds.add('nomina');
    }
    return nextIds;
  }, [navItems, isAdmin]);
  const handleSyncError = useCallback((error, fallbackMessage) => {
    console.error(error);
    const details = error?.message ? `\n\n${error.message}` : '';
    notify(`${fallbackMessage}${details}`, 'error');
  }, [notify]);
  const refreshClientsAfterAppointmentSync = useCallback(async () => {
    if (!hasSupabaseConfig || !sessionUserId) return;

    const nextClients = await fetchScopedClients(sessionUserId, superAdminScopeOverride);
    setClients(nextClients);

    if (clientDirectoryLoaded) {
      setClientDirectoryData((prev) => ({
        ...prev,
        clients: mergeEntitiesById(nextClients, prev.clients),
      }));
    }
  }, [clientDirectoryLoaded, sessionUserId, superAdminScopeOverride]);


  const getReservationAlertKey = (appointment) => (
    `${String(appointment?.id || '')}:${standardizeDate(appointment?.date || '')}:${String(appointment?.time || '')}`
  );

  const getAppointmentScheduledAt = (appointment) => {
    const localDate = parseLocalDate(appointment?.date);
    if (!localDate) return null;

    const [hours, minutes] = String(appointment?.time || '00:00')
      .split(':')
      .map((value) => Number(value));

    localDate.setHours(
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      0,
      0,
    );

    return localDate;
  };

  const markReservationAsLost = useCallback(async (appointment) => {
    if (!appointment || appointment.status === 'Cita Perdida') return;

    const updatedAppointment = {
      ...appointment,
      status: 'Cita Perdida',
      cancelledAt: appointment.cancelledAt || new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      item.id === appointment.id ? updatedAppointment : item
    )));

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments(
          [updatedAppointment],
          services,
          currentBarbershopId,
          currentBranchId,
          barbers,
          clients,
        );
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar la cita vencida en Supabase.');
      }
    }
  }, [
    barbers,
    clients,
    currentBarbershopId,
    currentBranchId,
    handleSyncError,
    refreshClientsAfterAppointmentSync,
    services,
  ]);

  useEffect(() => {
    const activeReservationKeys = new Set(
      (appointments || [])
        .filter((appointment) => appointment?.type === 'reserva' && appointment?.status === 'Confirmada')
        .map(getReservationAlertKey),
    );

    reservationNearExpiryAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationNearExpiryAlertsRef.current.delete(key);
      }
    });

    reservationExpiredAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationExpiredAlertsRef.current.delete(key);
      }
    });

    reservationProcessingAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationProcessingAlertsRef.current.delete(key);
      }
    });
  }, [appointments]);

  useEffect(() => {
    let cancelled = false;

    const checkReservationAlerts = async () => {
      const now = new Date();
      const pendingReservations = (appointments || []).filter(
        (appointment) => appointment?.type === 'reserva' && appointment?.status === 'Confirmada',
      );

      for (const appointment of pendingReservations) {
        if (cancelled) return;

        const scheduledAt = getAppointmentScheduledAt(appointment);
        if (!scheduledAt) continue;

        const delayMs = now.getTime() - scheduledAt.getTime();
        if (delayMs < 0) continue;

        const alertKey = getReservationAlertKey(appointment);
        const clientName = clients.find((client) => String(client.id) === String(appointment.clientId))?.name || 'Cliente';
        const barberName = barbers.find((barber) => String(barber.id) === String(appointment.barberId))?.name || 'barbero asignado';

        if (
          delayMs >= 10 * 60 * 1000
          && delayMs < 15 * 60 * 1000
          && !reservationNearExpiryAlertsRef.current.has(alertKey)
        ) {
          const remainingMinutes = Math.max(1, Math.ceil((15 * 60 * 1000 - delayMs) / 60000));
          reservationNearExpiryAlertsRef.current.add(alertKey);
          notify(
            `La cita de "${clientName}" está por vencerse\n\nSucursal / barbero: ${barberName}\nHora reservada: ${appointment.time}\nTiempo restante: ${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'}\n\nMarca la llegada del cliente antes de que se venza la reserva.`,
            'reservation-warning',
          );
        }

        if (
          delayMs >= 15 * 60 * 1000
          && !reservationExpiredAlertsRef.current.has(alertKey)
          && !reservationProcessingAlertsRef.current.has(alertKey)
        ) {
          reservationProcessingAlertsRef.current.add(alertKey);
          reservationExpiredAlertsRef.current.add(alertKey);

          notify(
            `La cita de "${clientName}" ya se venció\n\nSucursal / barbero: ${barberName}\nHora reservada: ${appointment.time}\n\nLa reserva se marcó como cita perdida.`,
            'reservation-expired',
          );

          try {
            await markReservationAsLost(appointment);
          } finally {
            reservationProcessingAlertsRef.current.delete(alertKey);
          }
        }
      }
    };

    void checkReservationAlerts();
    const interval = setInterval(() => {
      void checkReservationAlerts();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appointments, barbers, clients, markReservationAsLost, notify]);

  useEffect(() => {
    if (!accessibleTabIds.has(activeTab)) {
      setActiveTab(navItems[0]?.id || 'dashboard');
    }
  }, [activeTab, accessibleTabIds, navItems]);

  const isPublicBookingRoute = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/reservar';

  if (isPublicBookingRoute) {
    return <PublicBookingView />;
  }

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
        <style>{styleTag}</style>
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <span className="text-[10px] font-black uppercase tracking-widest italic">Verificando sesión...</span>
      </div>
    );
  }

  if (shouldBlockWithoutSupabase) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-rose-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck size={26} className="text-rose-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración requerida</h1>
              <p className="mt-2 text-sm text-slate-300">
                Esta instalación está en modo producción y requiere una conexión válida a Supabase.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-cyan-300/15 bg-black/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variables faltantes</p>
            <div className="mt-4 space-y-2 text-sm font-mono text-rose-200">
              {!import.meta.env.VITE_SUPABASE_URL && <p>VITE_SUPABASE_URL</p>}
              {!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && <p>VITE_SUPABASE_PUBLISHABLE_KEY</p>}
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-400 leading-relaxed">
            La aplicación fue bloqueada para evitar que opere con datos locales aislados en cada navegador. Configura las variables de entorno del servidor y vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }

  if (!hasSupabaseConfig && !useBrowserCache) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-amber-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Info size={26} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración pendiente</h1>
              <p className="mt-2 text-sm text-slate-300">
                No hay una conexión válida a Supabase y el modo local está desactivado para evitar datos de prueba confusos.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-cyan-300/15 bg-black/40 p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cómo continuar</p>
            <p className="text-sm text-slate-300">Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para trabajar con datos reales.</p>
            <p className="text-sm text-slate-300">Si necesitas una prueba local intencional, activa `VITE_ENABLE_LOCAL_MODE=true`.</p>
            <p className="text-sm text-slate-500">Para sembrar datos demo en ese modo, agrega también `VITE_SEED_LOCAL_MODE=true`.</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasSupabaseConfig && !session) {
    return (
      <Suspense fallback={accessUiFallback}>
        <LoginScreen onSignIn={handleSignIn} authBusy={authBusy} authError={authError} />
      </Suspense>
    );
  }

  const handleUpdateStatus = async (id, status, extra = null) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;
    const requiresWebClientConfirmation = isWebAppointment(apt)
      && apt.needsClientConfirmation
      && ['En Espera', 'En Corte', 'Finalizada'].includes(status);

    if (requiresWebClientConfirmation) {
      setSelectedData((prev) => ({ ...prev, appointment: apt }));
      setModals((prev) => ({ ...prev, appointmentActions: false, appointment: true }));
      notify('Primero confirma si la reserva web pertenece a un cliente existente o crea su ficha.', 'warning');
      return;
    }
    if (status === 'Finalizada' && !extra) {
      setSelectedData({ ...selectedData, finalize: apt });
      setModals({ ...modals, finalize: true });
      return;
    }
    if (status === 'Finalizada' && apt.status !== 'Finalizada' && extra && !activeCashSession) {
      notify('Debes abrir caja antes de cobrar y finalizar servicios.', 'warning');
      return;
    }

    const resolvedClientId = apt.clientId || null;
    const clientsForAppointmentSync = clients;

    const updatedAppointment = {
      ...apt,
      clientId: resolvedClientId,
      clientName: apt.clientName || (!resolvedClientId && !isWebAppointment(apt) ? GENERIC_CLIENT_NAME : undefined),
      status,
      service: extra ? extra.serviceName : apt.service,
      price: extra ? extra.price : apt.price,
      rating: extra ? extra.rating : apt.rating,
      grossAmount: extra
        ? Number(extra.grossAmount ?? extra.price ?? 0)
        : Number(apt.grossAmount ?? apt.price ?? 0),
      discountAmount: extra
        ? Number(extra.discountAmount || 0)
        : Number(apt.discountAmount || 0),
      promotionName: extra ? (extra.promotionName || '') : (apt.promotionName || ''),
    };

    if (status === 'En Espera' && !apt.checkInAt) {
      updatedAppointment.checkInAt = new Date().toISOString();
    }

    if (status === 'En Corte' && !apt.startedAt) {
      updatedAppointment.startedAt = new Date().toISOString();
      if (!updatedAppointment.checkInAt) updatedAppointment.checkInAt = apt.createdAt;
    }
    if (status === 'Finalizada' && !updatedAppointment.finishedAt) {
      updatedAppointment.finishedAt = new Date().toISOString();
    }

    if ((status === 'Cita Perdida' || status === 'Cancelada') && !updatedAppointment.cancelledAt) {
      updatedAppointment.cancelledAt = new Date().toISOString();
    }

    setAppointments(prev => prev.map(a => (a.id === id ? updatedAppointment : a)));
    if (status === 'Finalizada') {
      setModals({ ...modals, finalize: false });
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentBarbershopId, currentBranchId, barbers, clientsForAppointmentSync);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cambio de estado en Supabase.');
        setAppointments(prev => prev.map(a => (a.id === id ? apt : a)));
        return;
      }
    }
    if (status === 'Finalizada' && apt.status !== 'Finalizada' && extra) {
      const appointmentClient = clientsForAppointmentSync.find((client) => String(client.id) === String(updatedAppointment.clientId || ''));
      const appointmentBarber = barbers.find((barber) => String(barber.id) === String(updatedAppointment.barberId || ''));
      const normalizeChargedItem = (item) => {
        const matchedService = (services || []).find((service) => (
          String(service.id || '') === String(item.id || '')
          || String(service.name || '').toLowerCase() === String(item.name || '').toLowerCase()
        ));
        const resolvedInventoryUsage = Array.isArray(item.inventoryUsage) && item.inventoryUsage.length
          ? item.inventoryUsage
          : (matchedService?.inventoryUsage || []);
        return {
          id: item.id || matchedService?.id || item.serviceId || null,
          serviceId: item.serviceId || matchedService?.id || (item.category !== 'Producto' ? item.id : null) || null,
          inventoryItemId: item.inventoryItemId || matchedService?.inventoryItemId || null,
          inventoryUsage: resolvedInventoryUsage,
          name: item.name,
          category: item.category || matchedService?.category || 'Servicio',
          price: Number(item.price) || 0,
          qty: Number(item.qty) || 1,
          source: 'appointment',
          appointmentId: updatedAppointment.id,
          barberId: updatedAppointment.barberId || null,
          barberName: appointmentBarber?.name || updatedAppointment.barberName || '',
          clientName: getAppointmentDisplayClientName(updatedAppointment, appointmentClient),
        };
      };
      const serviceSaleRecord = await handleRegisterPosSale({
        clientId: updatedAppointment.clientId || null,
        clientName: getAppointmentDisplayClientName(updatedAppointment, appointmentClient),
        items: Array.isArray(extra.items) && extra.items.length
          ? extra.items.map(normalizeChargedItem)
          : [normalizeChargedItem({
            id: updatedAppointment.serviceId || updatedAppointment.id,
            name: updatedAppointment.service || 'Servicio',
            category: 'Servicio',
            price: Number(updatedAppointment.grossAmount || updatedAppointment.price || 0),
            qty: 1,
          })],
        rawSubtotal: Number(extra.grossAmount ?? extra.price ?? 0),
        discountTotal: Number(extra.discountAmount || 0),
        subtotal: Number(extra.price || 0),
        paymentMethod: extra.paymentMethod || 'cash',
        promotion: extra.promotionName ? { id: null, name: extra.promotionName } : null,
        notes: extra.notes || null,
      });
      if (!serviceSaleRecord) {
        setAppointments(prev => prev.map(a => (a.id === id ? apt : a)));
      }
    }
  };

  const handleAgendaAppointmentClick = async (appointment) => {
    if (!appointment) return;

    const normalizedDate = standardizeDate(appointment.date);
    const today = getTodayString();

    if (appointment.status === 'Cita Perdida') {
      notify('Esta cita ya está marcada como perdida.', 'info');
      return;
    }

    if (appointment.status === 'Finalizada') {
      notify('Esta cita ya fue finalizada.', 'info');
      return;
    }

    if (appointment.status === 'Confirmada') {
      if (normalizedDate && normalizedDate < today) {
        const shouldMarkLost = await confirmAction({
          title: 'Cita vencida',
          message: 'Esta cita quedó en un día anterior y nunca se inició. ¿Deseas marcarla como cita perdida?',
          confirmLabel: 'Marcar perdida',
          cancelLabel: 'Cerrar',
          tone: 'danger',
        });

        if (shouldMarkLost) {
          await handleUpdateStatus(appointment.id, 'Cita Perdida');
        }
        return;
      }

      const shouldCheckIn = await confirmAction({
        title: 'Cita pendiente',
        message: 'Esta cita todavía no ha iniciado. ¿Deseas marcar la llegada del cliente para pasarla a espera?',
        confirmLabel: 'Marcar llegada',
        cancelLabel: 'Cerrar',
        tone: 'info',
      });

      if (shouldCheckIn) {
        await handleUpdateStatus(appointment.id, 'En Espera');
      }
      return;
    }

    setSelectedData((prev) => ({ ...prev, finalize: appointment }));
    setModals((prev) => ({ ...prev, finalize: true }));
  };

  const openTransferAppointment = (appointment) => {
    if (!appointment) return;

    if (appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida') {
      notify('Esta cita ya está cerrada y no se puede trasladar.', 'info');
      return;
    }

    setSelectedData((prev) => ({ ...prev, transferAppointment: appointment }));
    setModals((prev) => ({ ...prev, transferAppointment: true }));
  };

  const openAppointmentActions = (appointment) => {
    if (!appointment) return;
    setSelectedData((prev) => ({ ...prev, appointmentActions: appointment }));
    setModals((prev) => ({ ...prev, appointmentActions: true }));
  };

  const openEditAppointment = (appointment) => {
    if (!appointment) return;
    if (appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida' || appointment.status === 'Cancelada') {
      notify('Esta cita ya está cerrada y no se puede editar.', 'info');
      return;
    }
    setSelectedData((prev) => ({ ...prev, appointment, appointmentActions: null }));
    setModals((prev) => ({ ...prev, appointmentActions: false, appointment: true }));
  };

  const openRescheduleAppointment = (appointment) => {
    if (!appointment) return;

    if (appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida' || appointment.status === 'Cancelada') {
      notify('Esta cita ya está cerrada y no se puede mover.', 'info');
      return;
    }

    setSelectedData((prev) => ({ ...prev, rescheduleAppointment: appointment }));
    setModals((prev) => ({ ...prev, rescheduleAppointment: true }));
  };

  const handleRescheduleAppointment = async (appointmentId, targetDate, targetTime) => {
    const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
    if (!appointment || !targetDate || !targetTime) return;

    if (hasAppointmentBarberConflict({
      appointments,
      appointment,
      targetBarberId: appointment.barberId,
      targetDate,
      targetTime,
    })) {
      notify('Ese horario ya está ocupado para este barbero.', 'warning');
      return;
    }

    const updatedAppointment = {
      ...appointment,
      date: targetDate,
      time: targetTime,
      updatedAt: new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      String(item.id) === String(appointmentId) ? updatedAppointment : item
    )));
    setSelectedData((prev) => ({ ...prev, rescheduleAppointment: null }));
    setModals((prev) => ({ ...prev, rescheduleAppointment: false }));
    notify(`Turno movido a las ${targetTime}.`, 'success');

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentBarbershopId, currentBranchId, barbers, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cambio de horario en Supabase.');
      }
    }
  };

  const handleCancelAppointment = async (appointment) => {
    if (!appointment) return;
    const confirmed = await confirmAction({
      title: appointment.type === 'walkin' ? 'Cancelar servicio' : 'Cancelar cita',
      message: 'Esta acción retirará el turno de la operación activa. ¿Deseas continuar?',
      confirmLabel: 'Cancelar turno',
      cancelLabel: 'Volver',
      tone: 'danger',
    });

    if (confirmed) {
      setModals((prev) => ({ ...prev, appointmentActions: false }));
      await handleUpdateStatus(appointment.id, 'Cancelada');
    }
  };

  const handleMarkAppointmentLost = async (appointment) => {
    if (!appointment) return;
    const confirmed = await confirmAction({
      title: 'Marcar cita perdida',
      message: 'Se usará el mismo estado que aplica el sistema cuando una reservación excede el tiempo de espera desde su hora agendada.',
      confirmLabel: 'Marcar perdida',
      cancelLabel: 'Volver',
      tone: 'danger',
    });

    if (confirmed) {
      setModals((prev) => ({ ...prev, appointmentActions: false }));
      await handleUpdateStatus(appointment.id, 'Cita Perdida');
    }
  };

  const handleTransferAppointment = async (appointmentId, targetBarberId) => {
    const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
    const targetBarber = barbers.find((item) => String(item.id) === String(targetBarberId));
    if (!appointment || !targetBarber) return;

    if (String(appointment.barberId) === String(targetBarberId)) {
      notify('La cita ya está asignada a ese barbero.', 'info');
      return;
    }

    if (hasAppointmentBarberConflict({ appointments, appointment, targetBarberId })) {
      notify('Ese barbero ya tiene una cita en ese horario.', 'warning');
      return;
    }

    const updatedAppointment = {
      ...appointment,
      barberId: targetBarber.id,
      barberName: targetBarber.name,
      updatedAt: new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      String(item.id) === String(appointmentId) ? updatedAppointment : item
    )));
    setSelectedData((prev) => ({ ...prev, transferAppointment: null }));
    setModals((prev) => ({ ...prev, transferAppointment: false }));
    notify(`Cita trasladada a ${targetBarber.name}.`, 'success');

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentBarbershopId, currentBranchId, barbers, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el traslado de barbero en Supabase.');
      }
    }
  };

  const normalizePayrollPaymentMethod = (method) => (
    ['cash_box', 'transfer', 'external'].includes(method) ? method : 'cash_box'
  );

  const getPayrollPaymentMethodLabel = (method) => ({
    cash_box: 'Efectivo caja',
    transfer: 'Transferencia',
    external: 'Externo',
  }[normalizePayrollPaymentMethod(method)]);

  const buildPayrollCashMovement = (settlement, barber, paidAt, referenceId = null) => ({
    id: globalThis.crypto?.randomUUID?.() || `cash-payroll-${Date.now()}-${barber?.id || settlement.id}`,
    cashSessionId: activeCashSession?.id || null,
    barbershopId: currentBarbershopId,
    branchId: currentBranchId || barber?.branchId || null,
    type: 'out',
    movementKind: 'payroll_payment',
    paymentMethod: 'cash',
    amount: Number(settlement.total || 0),
    notes: `Pago de nómina - ${barber?.fullName || barber?.name || 'Personal'}`,
    referenceType: 'payroll_payment',
    referenceId: referenceId || settlement.id,
    createdBy: session?.user?.id || null,
    createdAt: paidAt,
  });

  const handleConfirmPayment = async (barberId, method = 'cash_box') => {
    const paymentMethod = normalizePayrollPaymentMethod(method);
    if (paymentMethod === 'cash_box' && !activeCashSession) {
      notify('Debes abrir caja antes de pagar nómina con efectivo de caja.', 'warning');
      return;
    }
    const paidBarber = barbers.find((barber) => String(barber.id) === String(barberId));
    const nomina = paidBarber
      ? getBarberNominaData(paidBarber, appointments)
      : null;
    const pendingWithdrawals = cashWithdrawals.filter((withdrawal) => (
      String(withdrawal.barberId) === String(barberId) && !withdrawal.settledAt
    ));
    const withdrawalsTotal = pendingWithdrawals.reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0);
    const grossTotal = Number(nomina?.total || 0);
    const netTotal = Math.max(grossTotal - withdrawalsTotal, 0);
    const settlementTime = new Date().toISOString();
    const settlementId = makeId();
    const updatedAppointments = appointments
      .filter(a => String(a.barberId) === String(barberId) && a.status === 'Finalizada')
      .map(a => ({
        ...a,
        isPaid: true,
        paidAt: settlementTime,
        paidBy: session?.user?.id || null,
        settlementId,
      }));
    const settlementRecord = paidBarber
      ? {
          id: settlementId,
          barberId: paidBarber.id,
          barberName: paidBarber.name,
          barberFullName: paidBarber.fullName || paidBarber.name,
          grossTotal,
          withdrawalsTotal,
          total: netTotal,
          pendingServices: Number(nomina?.pendingServices || 0),
          paidAt: settlementTime,
          paidBy: session?.user?.id || null,
          type: 'individual',
          notes: `Liquidación individual de nómina - ${getPayrollPaymentMethodLabel(paymentMethod)}`,
          barbershopId: currentBarbershopId || null,
          branchId: currentBranchId || paidBarber.branchId || null,
          advanceIds: pendingWithdrawals.map((withdrawal) => withdrawal.id),
          appointmentIds: updatedAppointments.map((appointment) => appointment.id),
        }
      : null;

    setAppointments(prev => prev.map(a => 
      String(a.barberId) === String(barberId) && a.status === 'Finalizada'
        ? {
            ...a,
            isPaid: true,
            paidAt: settlementTime,
            paidBy: session?.user?.id || null,
            settlementId,
          }
        : a
    ));
    setCashWithdrawals((prev) => prev.map((withdrawal) => (
      String(withdrawal.barberId) === String(barberId) && !withdrawal.settledAt
        ? { ...withdrawal, settledAt: settlementTime, settlementId }
        : withdrawal
    )));
    const cashMovementDraft = settlementRecord && paymentMethod === 'cash_box'
      ? buildPayrollCashMovement(settlementRecord, paidBarber, settlementTime)
      : null;
    if (settlementRecord) {
      setPayrollSettlements((prev) => [settlementRecord, ...prev]);
    }
    if (cashMovementDraft) {
      setCashMovements((prev) => [...prev, cashMovementDraft]);
    }
    setModals({ ...modals, paymentReceipt: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        if (settlementRecord) {
          const savedSettlements = await createPayrollSettlements([settlementRecord], session?.user?.id, superAdminScopeOverride);
          const savedSettlement = savedSettlements?.[0] || settlementRecord;
          if (paymentMethod === 'cash_box') {
            const savedMovement = await createCashAuditMovement(
              {
                cashSessionId: activeCashSession.id,
                type: 'out',
                amount: settlementRecord.total,
                notes: `Pago de nómina - ${paidBarber?.fullName || paidBarber?.name || 'Personal'}`,
                movementKind: 'payroll_payment',
                paymentMethod: 'cash',
                referenceType: 'payroll_payment',
                referenceId: savedSettlement.id,
                barbershopId: currentBarbershopId,
                branchId: currentBranchId || paidBarber?.branchId || null,
              },
              session?.user?.id,
              superAdminScopeOverride,
            );
            if (cashMovementDraft) {
              setCashMovements((prev) => prev.map((movement) => (
                String(movement.id) === String(cashMovementDraft.id) ? savedMovement : movement
              )));
            }
          }
        }
        if (updatedAppointments.length) {
          await upsertAppointments(updatedAppointments, services, currentBarbershopId, currentBranchId, barbers, clients);
        }
      } catch (error) {
        handleSyncError(error, 'No pude liquidar el pago en Supabase.');
      }
    }
  };

  const handleConfirmStaffSettlement = async (barberIds = [], method = 'cash_box') => {
    const paymentMethod = normalizePayrollPaymentMethod(method);
    if (paymentMethod === 'cash_box' && !activeCashSession) {
      notify('Debes abrir caja antes de liquidar nómina con efectivo de caja.', 'warning');
      return;
    }
    const normalizedIds = new Set((barberIds || []).map(id => String(id)));
    const settlementTime = new Date().toISOString();
    const settlementIdsByBarber = new Map(
      (barbers || [])
        .filter((barber) => normalizedIds.has(String(barber.id)))
        .map((barber) => [String(barber.id), makeId()]),
    );
    const updatedAppointments = appointments
      .filter(a => normalizedIds.has(String(a.barberId)) && a.status === 'Finalizada' && !a.isPaid)
      .map(a => ({
        ...a,
        isPaid: true,
        paidAt: settlementTime,
        paidBy: session?.user?.id || null,
        settlementId: settlementIdsByBarber.get(String(a.barberId)) || null,
      }));
    const settlementRecords = (barbers || [])
      .filter((barber) => normalizedIds.has(String(barber.id)))
      .map((barber) => {
        const nomina = getBarberNominaData(barber, appointments);
        const pendingWithdrawals = cashWithdrawals.filter((withdrawal) => (
          String(withdrawal.barberId) === String(barber.id) && !withdrawal.settledAt
        ));
        const barberAppointmentIds = updatedAppointments
          .filter((appointment) => String(appointment.barberId) === String(barber.id))
          .map((appointment) => appointment.id);
        const withdrawalsTotal = pendingWithdrawals.reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0);
        const grossTotal = Number(nomina.total || 0);
        return {
          id: settlementIdsByBarber.get(String(barber.id)) || makeId(),
          barberId: barber.id,
          barberName: barber.name,
          barberFullName: barber.fullName || barber.name,
          grossTotal,
          withdrawalsTotal,
          total: Math.max(grossTotal - withdrawalsTotal, 0),
          pendingServices: Number(nomina.pendingServices || 0),
          paidAt: settlementTime,
          paidBy: session?.user?.id || null,
          type: 'staff',
          notes: `Liquidación general de equipo - ${getPayrollPaymentMethodLabel(paymentMethod)}`,
          barbershopId: currentBarbershopId || null,
          branchId: currentBranchId || barber.branchId || null,
          advanceIds: pendingWithdrawals.map((withdrawal) => withdrawal.id),
          appointmentIds: barberAppointmentIds,
        };
      })
      .filter((record) => record.grossTotal > 0 || record.withdrawalsTotal > 0);

    setAppointments(prev => prev.map(a =>
      normalizedIds.has(String(a.barberId)) && a.status === 'Finalizada' && !a.isPaid
        ? {
            ...a,
            isPaid: true,
            paidAt: settlementTime,
            paidBy: session?.user?.id || null,
            settlementId: settlementIdsByBarber.get(String(a.barberId)) || null,
          }
        : a
    ));
    setCashWithdrawals((prev) => prev.map((withdrawal) => (
      normalizedIds.has(String(withdrawal.barberId)) && !withdrawal.settledAt
        ? { ...withdrawal, settledAt: settlementTime, settlementId: settlementIdsByBarber.get(String(withdrawal.barberId)) || null }
        : withdrawal
    )));
    if (settlementRecords.length) {
      setPayrollSettlements((prev) => [...settlementRecords, ...prev]);
    }
    const barberById = new Map((barbers || []).map((barber) => [String(barber.id), barber]));
    const cashMovementDrafts = paymentMethod === 'cash_box'
      ? settlementRecords.map((settlement) => buildPayrollCashMovement(settlement, barberById.get(String(settlement.barberId)), settlementTime))
      : [];
    if (cashMovementDrafts.length) {
      setCashMovements((prev) => [...prev, ...cashMovementDrafts]);
    }
    setModals(prev => ({ ...prev, staffSettlement: false }));

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        if (settlementRecords.length) {
          const savedSettlements = await createPayrollSettlements(settlementRecords, session?.user?.id, superAdminScopeOverride);
          if (paymentMethod === 'cash_box') {
            const savedMovements = [];
            for (const savedSettlement of savedSettlements || []) {
              const barber = barberById.get(String(savedSettlement.barberId));
              const savedMovement = await createCashAuditMovement(
                {
                  cashSessionId: activeCashSession.id,
                  type: 'out',
                  amount: savedSettlement.total,
                  notes: `Pago de nómina - ${barber?.fullName || barber?.name || 'Personal'}`,
                  movementKind: 'payroll_payment',
                  paymentMethod: 'cash',
                  referenceType: 'payroll_payment',
                  referenceId: savedSettlement.id,
                  barbershopId: currentBarbershopId,
                  branchId: currentBranchId || barber?.branchId || null,
                },
                session?.user?.id,
                superAdminScopeOverride,
              );
              savedMovements.push({ localId: savedSettlement.id, movement: savedMovement });
            }
            if (savedMovements.length) {
              const savedMovementByReference = new Map(savedMovements.map((item) => [String(item.localId), item.movement]));
              setCashMovements((prev) => prev.map((movement) => savedMovementByReference.get(String(movement.referenceId)) || movement));
            }
          }
        }
        if (updatedAppointments.length) {
          await upsertAppointments(updatedAppointments, services, currentBarbershopId, currentBranchId, barbers, clients);
        }
      } catch (error) {
        handleSyncError(error, 'No pude liquidar la planilla en Supabase.');
      }
    }
  };

  const handleSaveAppointment = async (aptData, clientData) => {
    const editingAppointment = aptData?.id ? appointments.find((appointment) => String(appointment.id) === String(aptData.id)) : null;
    const skipClientRegistration = Boolean(clientData?.skipRegistration);
    let finalClientId = skipClientRegistration ? null : clientData.id;
    const now = new Date().toISOString();
    const normalizedPhone = formatPhoneNumber(clientData.phone || '');
    let createdClient = null;

    if (!skipClientRegistration && clientData.isNew) {
      const duplicateClient = findClientByPhone(clients, normalizedPhone);
      if (duplicateClient) {
        notify(`Este número ya pertenece a ${duplicateClient.name}. Selecciona ese cliente existente.`, 'warning');
        return;
      }

      createdClient = {
        id: makeId(),
        name: clientData.name,
        phone: normalizedPhone,
        notes: '',
        points: 0,
        createdAt: now,
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteBarberId: null,
        favoriteBarberName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, createdClient]);
      finalClientId = createdClient.id;
    }

    const confirmsWebClient = Boolean(editingAppointment && isWebAppointment(editingAppointment) && !skipClientRegistration && finalClientId);
    const newApt = {
      ...(editingAppointment || {}),
      ...aptData,
      id: editingAppointment?.id || aptData.id || makeId(),
      clientId: finalClientId,
      clientName: skipClientRegistration ? GENERIC_CLIENT_NAME : undefined,
      source: editingAppointment?.source || aptData.source || 'internal',
      guestName: editingAppointment?.guestName || aptData.guestName || '',
      guestPhone: editingAppointment?.guestPhone || aptData.guestPhone || '',
      claimsExistingClient: editingAppointment?.claimsExistingClient || aptData.claimsExistingClient || false,
      needsClientConfirmation: confirmsWebClient ? false : (editingAppointment?.needsClientConfirmation || aptData.needsClientConfirmation || false),
      clientConfirmedAt: confirmsWebClient ? now : (editingAppointment?.clientConfirmedAt || aptData.clientConfirmedAt || null),
      type: aptData.type || editingAppointment?.type || 'reserva',
      durationMinutes: Number(aptData.durationMinutes) > 0 ? Number(aptData.durationMinutes) : 30,
      status: editingAppointment?.status || 'Confirmada',
      createdAt: editingAppointment?.createdAt || now,
      updatedAt: editingAppointment ? now : undefined,
      checkInAt: editingAppointment?.checkInAt ?? (aptData.type === 'walkin' ? now : null),
      isPaid: editingAppointment?.isPaid || false,
    };

    setAppointments((prev) => (editingAppointment
      ? prev.map((appointment) => (String(appointment.id) === String(newApt.id) ? newApt : appointment))
      : [...prev, newApt]
    ));
    setSelectedData((prev) => ({ ...prev, appointment: null }));
    setModals({ ...modals, appointment: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        if (createdClient) {
          await upsertClients([createdClient], currentBarbershopId);
        }
        await upsertAppointments([newApt], services, currentBarbershopId, currentBranchId, barbers, clients);
        notify(editingAppointment ? 'Cita actualizada correctamente.' : 'Cita guardada correctamente.', 'success');
      } catch (error) {
        handleSyncError(error, editingAppointment ? 'No pude actualizar la cita en Supabase.' : 'No pude guardar la cita en Supabase.');
      }
    } else {
      notify(editingAppointment ? 'Cita actualizada correctamente.' : 'Cita guardada correctamente.', 'success');
    }
  };
  const handleSaveQuickAppointment = async (aptData) => {
    const now = new Date().toISOString();
    const selectedBarber = barbers.find((barber) => String(barber.id) === String(aptData.barberId));
    const newApt = {
      id: makeId(),
      ...aptData,
      clientId: null,
      clientName: GENERIC_CLIENT_NAME,
      barberName: selectedBarber?.name || '',
      barbershopId: currentBarbershopId || null,
      branchId: currentBranchId || selectedBarber?.branchId || null,
      type: 'walkin',
      durationMinutes: Number(aptData.durationMinutes) > 0 ? Number(aptData.durationMinutes) : 30,
      status: 'Confirmada',
      createdAt: now,
      checkInAt: now,
      startedAt: now,
      isPaid: false,
      isQuickDirectSale: true,
    };

    setSelectedData((prev) => ({ ...prev, quickAppointment: null, finalize: newApt }));
    setModals((prev) => ({ ...prev, quickAppointment: false, finalize: true }));
    notify('Cobro rápido listo para procesar.', 'success');
  };

  const handleConfirmQuickDirectSale = async (extra) => {
    const draft = selectedData.finalize;
    if (!draft) return;

    const now = new Date().toISOString();
    const resolvedDate = standardizeDate(draft.date) || getTodayString();
    const resolvedTime = resolveUniqueAppointmentMinute({
      appointments,
      barberId: draft.barberId,
      date: resolvedDate,
      preferredTime: draft.time || getCurrentTimeHHmm(),
      excludeId: draft.id,
    });
    const appointment = {
      ...draft,
      date: resolvedDate,
      time: resolvedTime,
      service: extra?.serviceName || draft.service,
      price: extra?.price ?? draft.price,
      rating: extra?.rating ?? draft.rating,
      grossAmount: Number(extra?.grossAmount ?? extra?.price ?? draft.grossAmount ?? draft.price ?? 0),
      discountAmount: Number(extra?.discountAmount || 0),
      promotionName: extra?.promotionName || '',
      status: 'Finalizada',
      finishedAt: draft.finishedAt || now,
      isPaid: false,
      isQuickDirectSale: false,
    };

    const clientsForAppointmentSync = clients;

    setAppointments((prev) => [...prev, appointment]);
    setModals((prev) => ({ ...prev, finalize: false }));
    setSelectedData((prev) => ({ ...prev, finalize: null }));
    notify('Cobro rápido asignado al barbero.', 'success');

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([appointment], services, currentBarbershopId, appointment.branchId || currentBranchId || null, barbers, clientsForAppointmentSync);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        if (!isSupabaseAppointmentTimeDuplicate(error)) {
          handleSyncError(error, 'No pude guardar el cobro rápido en Supabase.');
          return;
        }

        let savedRetry = null;
        let lastRetryError = error;
        const baseMinute = appointmentTimeToMinutes(appointment.time);

        for (let attempt = 1; attempt <= 30; attempt += 1) {
          const retryAppointment = {
            ...appointment,
            time: toHHmmFromMinutes(baseMinute + attempt),
          };

          try {
            await upsertAppointments([retryAppointment], services, currentBarbershopId, retryAppointment.branchId || currentBranchId || null, barbers, clientsForAppointmentSync);
            savedRetry = retryAppointment;
            break;
          } catch (retryError) {
            lastRetryError = retryError;
            if (!isSupabaseAppointmentTimeDuplicate(retryError)) break;
          }
        }

        if (savedRetry) {
          setAppointments((prev) => prev.map((item) => String(item.id) === String(appointment.id) ? savedRetry : item));
          await refreshClientsAfterAppointmentSync();
        } else {
          handleSyncError(lastRetryError, 'No pude guardar el cobro rápido en Supabase.');
        }
      }
    }
  };

  const openCashWithdrawal = (barberId = '') => {
    setSelectedData((prev) => ({
      ...prev,
      cashWithdrawal: { barberId: barberId || defaultBarberId || '' },
    }));
    setModals((prev) => ({ ...prev, cashWithdrawal: true }));
  };

  const handleSaveCashWithdrawal = async ({ barberId, amount, note }) => {
    const barber = barbers.find((item) => String(item.id) === String(barberId));
    const parsedAmount = Number(amount || 0);

    if (!barber) {
      notify('Selecciona un barbero para registrar el retiro.', 'warning');
      return;
    }

    if (parsedAmount <= 0) {
      notify('Ingresa un monto válido para el retiro.', 'warning');
      return;
    }

    if (!activeCashSession) {
      notify('Debes abrir caja antes de entregar un adelanto.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const withdrawal = {
      id: makeId(),
      barberId: barber.id,
      barberName: barber.name,
      amount: parsedAmount,
      note: String(note || '').trim(),
      date: getTodayString(),
      createdAt: now,
      barbershopId: currentBarbershopId || null,
      branchId: currentBranchId || barber.branchId || null,
      cashSessionId: activeCashSession.id,
      settledAt: null,
    };

    try {
      let savedWithdrawal = withdrawal;
      let savedMovement = null;

      if (hasSupabaseConfig && bootstrapCompletedRef.current && session?.user?.id) {
        const result = await createCashAdvanceWithMovement(withdrawal, session.user.id, superAdminScopeOverride);
        savedWithdrawal = result.advance || withdrawal;
        savedMovement = result.movement || null;
      } else {
        savedMovement = {
          id: makeId(),
          cashSessionId: activeCashSession.id,
          barbershopId: currentBarbershopId,
          branchId: currentBranchId,
          type: 'out',
          movementKind: 'cash_advance',
          paymentMethod: 'cash',
          amount: parsedAmount,
          notes: `Adelanto a barbero - ${barber.name}${withdrawal.note ? ` - ${withdrawal.note}` : ''}`,
          referenceType: 'cash_advance',
          referenceId: withdrawal.id,
          createdBy: session?.user?.id || null,
          createdAt: now,
        };
      }

      setCashWithdrawals((prev) => [...prev, savedWithdrawal]);
      if (savedMovement) {
        setCashMovements((prev) => [...prev, savedMovement]);
      }
      setSelectedData((prev) => ({ ...prev, cashWithdrawal: null }));
      setModals((prev) => ({ ...prev, cashWithdrawal: false }));
      notify(`Adelanto registrado: C$ ${parsedAmount.toLocaleString()} para ${barber.name}.`, 'success');
    } catch (error) {
      handleSyncError(error, 'No pude guardar el adelanto y la salida de caja en Supabase.');
    }
  };

  const handleSaveClient = async (clientData) => {
    const normalizedClient = {
      ...clientData,
      phone: formatPhoneNumber(clientData.phone || ''),
    };
    const duplicateClient = findClientByPhone(clients, normalizedClient.phone, selectedData.client?.id);

    if (duplicateClient) {
      notify(`Este número ya pertenece a ${duplicateClient.name}.`, 'warning');
      return;
    }

    let savedClient;
    if (selectedData.client) {
      savedClient = { ...selectedData.client, ...normalizedClient };
      setClients(prev => prev.map(c => c.id === selectedData.client.id ? savedClient : c));
      setSelectedData(prev => ({ ...prev, client: savedClient }));
    } else {
      savedClient = {
        id: makeId(),
        ...normalizedClient,
        points: 0,
        createdAt: new Date().toISOString(),
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteBarberId: null,
        favoriteBarberName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, savedClient]);
    }
    setModals({ ...modals, client: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedClient) {
      try {
        await upsertClients([savedClient], currentBarbershopId);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cliente en Supabase.');
      }
    }
  };

  const handleSaveService = async (serviceData) => {
    const isPromotion = serviceData.category === 'Promocion';
    const normalizedPromotionDiscount = isPromotion
      ? clampPromotionDiscountValue(serviceData.discountType || 'percentage', serviceData.discountValue)
      : 0;
    const normalizedService = {
      ...serviceData,
      price: isPromotion ? 0 : Number(serviceData.price) || 0,
      items: serviceData.category === 'Combo' ? serviceData.items : [],
      inventoryUsage: ['Combo', 'Promocion', 'Producto'].includes(serviceData.category)
        ? []
        : (serviceData.inventoryUsage || []),
      appliesTo: isPromotion ? 'General' : 'Servicio',
      discountType: isPromotion ? (serviceData.discountType || 'percentage') : 'percentage',
      discountValue: normalizedPromotionDiscount,
      targetServiceIds: [],
      isOptional: isPromotion ? serviceData.isOptional !== false : true,
    };
    const savedService = selectedData.service?.id
      ? { ...selectedData.service, ...normalizedService }
      : { id: makeId(), ...normalizedService };
    const nextServices = selectedData.service?.id
      ? services.map(s => s.id === selectedData.service.id ? savedService : s)
      : [...services, savedService];

    if (selectedData.service?.id) {
      setServices(nextServices);
    } else {
      setServices(nextServices);
    }
    setModals({ ...modals, service: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertServices([savedService], currentBarbershopId);
        await syncServiceComboItems(nextServices);
        await syncServiceInventoryUsage(savedService, session?.user?.id, superAdminScopeOverride);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el servicio en Supabase.');
      }
    }
  };

  const handleSaveInventoryProduct = async (product) => {
    const normalizedProduct = {
      ...product,
      id: product.id || makeId(),
      barbershopId: product.barbershopId || currentBarbershopId || null,
      branchId: product.branchId ?? currentBranchId ?? null,
      productName: String(product.productName || product.name || '').trim(),
      name: String(product.productName || product.name || '').trim(),
      productCategory: product.productCategory || 'Otros',
      usageType: product.usageType || 'retail',
      unitName: product.unitName || 'unidad',
      presentationName: product.presentationName || 'unidad',
      unitsPerPresentation: Math.max(1, Number(product.unitsPerPresentation || 1)),
      currentStock: Number(product.currentStock || 0),
      minStock: Number(product.minStock || 0),
      costPrice: Number(product.costPrice || 0),
      salePrice: Number(product.salePrice || 0),
      isActive: product.isActive ?? true,
    };

    if (!normalizedProduct.productName) {
      notify('Ingresa el nombre del producto.', 'warning');
      return;
    }

    try {
      const savedProducts = hasSupabaseConfig && bootstrapCompletedRef.current && session?.user?.id
        ? await upsertInventoryProducts([normalizedProduct], session.user.id, superAdminScopeOverride)
        : [normalizedProduct];
      const savedProduct = savedProducts[0] || normalizedProduct;

      setInventoryItems((prev) => {
        const exists = prev.some((item) => String(item.id) === String(savedProduct.id));
        return exists
          ? prev.map((item) => String(item.id) === String(savedProduct.id) ? savedProduct : item)
          : [...prev, savedProduct];
      });
      notify('Producto de inventario guardado.', 'success');
    } catch (error) {
      handleSyncError(error, 'No pude guardar el producto de inventario en Supabase.');
    }
  };

  const handleDeleteInventoryProduct = async (productId) => {
    const confirmed = await confirmAction({
      title: 'Desactivar producto',
      message: 'El producto saldrá del inventario activo y de la caja.',
      confirmLabel: 'Desactivar',
    });
    if (!confirmed) return;

    try {
      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        await deleteInventoryProduct(productId);
      }
      setInventoryItems((prev) => prev.filter((item) => String(item.id) !== String(productId)));
      setServices((prev) => prev.filter((service) => String(service.inventoryItemId || '') !== String(productId)));
      notify('Producto desactivado.', 'success');
    } catch (error) {
      handleSyncError(error, 'No pude desactivar el producto de inventario en Supabase.');
    }
  };

  const handleSaveCatalogSettings = async (catalogKey, values) => {
    const stateKey = catalogKey === 'service_categories' ? 'serviceCategories' : 'inventoryProductCategories';
    const protectedValues = catalogKey === 'service_categories' ? PROTECTED_SERVICE_CATEGORIES : [];
    const nextValues = Array.from(new Set([...(values || []), ...protectedValues].map((value) => String(value || '').trim()).filter(Boolean)));

    setCatalogSettings((prev) => ({ ...prev, [stateKey]: nextValues }));

    if (hasSupabaseConfig && bootstrapCompletedRef.current && session?.user?.id) {
      try {
        const savedValues = await upsertBarbershopCatalog(catalogKey, nextValues, session.user.id, superAdminScopeOverride);
        setCatalogSettings((prev) => ({ ...prev, [stateKey]: savedValues }));
      } catch (error) {
        handleSyncError(error, 'No pude guardar el catálogo en Supabase.');
      }
    }
  };

  const handleDeleteClient = async (id) => {
    if (appointments.some(a => String(a.clientId) === String(id))) {
      notify('No puedes eliminar este cliente porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar cliente',
      message: '¿Eliminar cliente permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setClients(prev => prev.filter(c => c.id !== id));
      setModals({ ...modals, clientDetail: false });

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteClientRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el cliente en Supabase.');
        }
      }
    }
  };

  const handleSaveBarber = async (barber) => {
    if (!barber.name || barber.name.trim() === '') {
      notify('Ingrese nombre del barbero.', 'warning');
      return;
    }
    const normalizedPhone = formatPhoneNumber(barber.phone || '');
    const resolvedBarbershopId = barber.barbershopId || currentBarbershopId || null;
    const resolvedBranchId = barber.branchId ?? currentBranchId ?? undefined;
    if (!resolvedBranchId) {
      notify('Cada barbero debe tener una sucursal asignada.', 'warning');
      return;
    }
    let savedBarber = null;

    if (barber.id) {
      const currentIndex = barbers.findIndex(b => String(b.id) === String(barber.id));
      savedBarber = ensureBarberTheme({
        ...barber,
        phone: normalizedPhone,
        id: String(barber.id),
        barbershopId: resolvedBarbershopId,
        branchId: resolvedBranchId ?? null,
      }, Math.max(currentIndex, 0));
      setBarbers(prev => prev.map((b, idx) => String(b.id) === String(barber.id) ? ensureBarberTheme(savedBarber, idx) : b));
    } else {
      const newBarber = {
        ...barber,
        phone: normalizedPhone,
        id: makeId(),
        barbershopId: resolvedBarbershopId,
        branchId: resolvedBranchId ?? null,
      };
      savedBarber = ensureBarberTheme(newBarber, barbers.length);
      setBarbers(prev => [...prev, savedBarber]);
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedBarber) {
      try {
        await upsertBarbers([savedBarber], resolvedBarbershopId, resolvedBranchId, session?.user?.id);
        if (session?.user?.id) {
          const nextBarbers = await fetchScopedBarbers(session.user.id, superAdminScopeOverride);
          setBarbers(nextBarbers.map((nextBarber, index) => ensureBarberTheme(nextBarber, index)));
        }
      } catch (error) {
        handleSyncError(error, 'No pude guardar el barbero en Supabase.');
      }
    }
  };

  const handleDeleteBarber = async (id) => {
    if (appointments.some(a => String(a.barberId) === String(id))) {
      notify('No puedes eliminar este barbero porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar barbero',
      message: '¿Eliminar barbero permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setBarbers(prev => prev.filter(b => b.id !== id));

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteBarberRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el barbero en Supabase.');
        }
      }
    }
  };

  const handleDeleteService = async (id) => {
    const isUsedInCombo = services.some(service => service.category === 'Combo' && (service.items || []).includes(id));
    if (isUsedInCombo) {
      notify('No puedes eliminar este servicio porque forma parte de un combo.', 'warning');
      return;
    }

    const nextServices = services.filter(service => service.id !== id);
    setServices(nextServices);

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await deleteServiceRecord(id);
        await syncServiceComboItems(nextServices);
      } catch (error) {
        handleSyncError(error, 'No pude eliminar el servicio en Supabase.');
      }
    }
  };

  const handleOpenCashSession = async ({ openingAmount = 0, notes = '' } = {}) => {
    if (!currentBarbershopId) {
      notify('No se puede abrir caja porque no hay una barber�a activa.', 'error');
      throw new Error('No se puede abrir caja porque no hay una barber�a activa.');
    }
    if (!currentBranchId) {
      notify('Debes seleccionar una sucursal antes de abrir caja.', 'warning');
      throw new Error('Debes seleccionar una sucursal antes de abrir caja.');
    }
    if (activeCashSession) {
      notify('Ya hay una caja abierta en esta sucursal.', 'warning');
      return activeCashSession;
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      const sessionRecord = {
        id: makeId(),
        barbershopId: currentBarbershopId,
        branchId: currentBranchId,
        openedBy: session?.user?.id || null,
        closedBy: null,
        openedAt: new Date().toISOString(),
        closedAt: null,
        openingAmount: Number(openingAmount || 0),
        closingAmount: 0,
        expectedCashAmount: Number(openingAmount || 0),
        countedCashAmount: 0,
        differenceAmount: 0,
        status: 'open',
        notes,
      };
      const movementRecord = {
        id: makeId(),
        cashSessionId: sessionRecord.id,
        barbershopId: currentBarbershopId,
        branchId: currentBranchId,
        type: 'in',
        movementKind: 'opening',
        paymentMethod: 'cash',
        amount: Number(openingAmount || 0),
        notes: notes || 'Apertura de caja',
        createdBy: session?.user?.id || null,
        createdAt: new Date().toISOString(),
      };
      setCashSessions((prev) => [sessionRecord, ...prev]);
      setCashMovements((prev) => [...prev, movementRecord]);
      notify('Caja abierta correctamente.', 'success');
      return sessionRecord;
    }

    try {
      const result = await openCashSession(
        { openingAmount, notes, barbershopId: currentBarbershopId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashSessions((prev) => [result.session, ...prev]);
      setCashMovements((prev) => [...prev, result.movement]);
      notify('Caja abierta correctamente.', 'success');
      return result.session;
    } catch (error) {
      handleSyncError(error, 'No pude abrir la caja.');
      throw error;
    }
  };

  const handleCashMovement = async ({ type = 'in', amount = 0, notes = '' } = {}) => {
    if (!activeCashSession) {
      notify('Debes abrir caja antes de registrar movimientos.', 'warning');
      return null;
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      const movementRecord = {
        id: makeId(),
        cashSessionId: activeCashSession.id,
        barbershopId: currentBarbershopId,
        branchId: currentBranchId,
        type: type === 'out' ? 'out' : 'in',
        movementKind: 'manual',
        paymentMethod: 'cash',
        amount: Number(amount || 0),
        notes,
        createdBy: session?.user?.id || null,
        createdAt: new Date().toISOString(),
      };
      setCashMovements((prev) => [...prev, movementRecord]);
      notify('Movimiento de caja registrado.', 'success');
      return movementRecord;
    }

    try {
      const movement = await createCashMovement(
        { cashSessionId: activeCashSession.id, type, amount, notes, barbershopId: currentBarbershopId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashMovements((prev) => [...prev, movement]);
      notify('Movimiento de caja registrado.', 'success');
      return movement;
    } catch (error) {
      handleSyncError(error, 'No pude registrar el movimiento de caja.');
      return null;
    }
  };

  const calculateLocalExpectedCash = (movements = activeCashMovements) =>
    (movements || []).reduce((total, movement) => {
      if ((movement.paymentMethod || 'cash') !== 'cash') return total;
      const amount = Number(movement.amount || 0);
      return movement.type === 'out' ? total - amount : total + amount;
    }, 0);

  const handleCloseCashSession = async ({ countedCashAmount = 0, notes = '' } = {}) => {
    if (!activeCashSession) {
      notify('No hay una caja abierta para cerrar.', 'warning');
      return null;
    }
    const receiptMovements = activeCashMovements;
    const receiptSales = activeCashPosSales;

    if (!hasSupabaseConfig || !session?.user?.id) {
      const expectedCashAmount = calculateLocalExpectedCash();
      const counted = Number(countedCashAmount || 0);
      const closedSession = {
        ...activeCashSession,
        closedBy: session?.user?.id || null,
        closedAt: new Date().toISOString(),
        closingAmount: counted,
        countedCashAmount: counted,
        expectedCashAmount,
        differenceAmount: counted - expectedCashAmount,
        status: 'closed',
        notes,
      };
      setCashSessions((prev) => prev.map((cashSession) => String(cashSession.id) === String(activeCashSession.id) ? closedSession : cashSession));
      setSelectedData((prev) => ({
        ...prev,
        cashClosureReceipt: {
          cashSession: closedSession,
          cashMovements: receiptMovements,
          posSales: receiptSales,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
      notify('Caja cerrada correctamente.', 'success');
      return closedSession;
    }

    try {
      const closedSession = await closeCashSession(
        { cashSessionId: activeCashSession.id, countedCashAmount, notes, barbershopId: currentBarbershopId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashSessions((prev) => prev.map((cashSession) => String(cashSession.id) === String(closedSession.id) ? closedSession : cashSession));
      setSelectedData((prev) => ({
        ...prev,
        cashClosureReceipt: {
          cashSession: closedSession,
          cashMovements: receiptMovements,
          posSales: receiptSales,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
      notify('Caja cerrada correctamente.', 'success');
      return closedSession;
    } catch (error) {
      handleSyncError(error, 'No pude cerrar la caja.');
      return null;
    }
  };

  const handleRegisterPosSale = async (saleDraft) => {
    const normalizedItems = Array.isArray(saleDraft?.items) ? saleDraft.items : [];
    if (!currentBarbershopId) {
      notify('No se puede registrar la venta porque no hay una barbería activa.', 'error');
      return null;
    }
    if (!currentBranchId) {
      notify('Debes seleccionar una sucursal antes de registrar una venta POS.', 'warning');
      return null;
    }
    if (!activeCashSession) {
      notify('Debes abrir caja antes de registrar ventas.', 'warning');
      return null;
    }
    const rawSubtotal = Number(saleDraft?.rawSubtotal) || normalizedItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const discountTotal = Number(saleDraft?.discountTotal || 0);
    const subtotal = Number(saleDraft?.subtotal) || Math.max(rawSubtotal - discountTotal, 0);
    const rawProductTotal = normalizedItems
      .filter((item) => item.category === 'Producto')
      .reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const rawServiceTotal = Math.max(rawSubtotal - rawProductTotal, 0);
    const productTotal = Number.isFinite(Number(saleDraft?.productTotal))
      ? Number(saleDraft.productTotal)
      : (rawServiceTotal > 0 ? rawProductTotal : subtotal);
    const serviceTotal = Number.isFinite(Number(saleDraft?.serviceTotal))
      ? Number(saleDraft.serviceTotal)
      : (rawServiceTotal > 0 ? Math.max(subtotal - productTotal, 0) : 0);
    const nextLocalTicketNumber = (posSales || []).reduce(
      (max, sale) => Math.max(max, Number(sale.ticketNumber || 0)),
      0,
    ) + 1;

    const saleRecord = {
      id: makeId(),
      ticketNumber: nextLocalTicketNumber,
      items: normalizedItems.map((item) => ({
        id: item.id,
        serviceId: item.serviceId || (item.category !== 'Producto' ? item.id : null) || null,
        name: item.name,
        category: item.category,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 0,
        productId: item.category === 'Producto' ? (item.serviceId || item.id) : null,
        inventoryItemId: item.inventoryItemId || null,
        inventoryUsage: Array.isArray(item.inventoryUsage) ? item.inventoryUsage : [],
        inventoryAction: item.category === 'Producto' ? 'decrement_pending' : null,
        inventoryQuantity: item.category === 'Producto' ? Number(item.qty) || 0 : 0,
        source: item.source || '',
        appointmentId: item.appointmentId || null,
        barberId: item.barberId || null,
        barberName: item.barberName || '',
        clientName: item.clientName || '',
      })),
      rawSubtotal,
      discountTotal,
      subtotal,
      productTotal,
      serviceTotal,
      promotionId: saleDraft?.promotion?.id || null,
      promotionName: saleDraft?.promotion?.name || '',
      discountLabel: saleDraft?.promotion?.name
        || (saleDraft?.manualDiscount
          ? `Descuento manual ${saleDraft.manualDiscount.type === 'percentage' ? `${saleDraft.manualDiscount.value}%` : `C$ ${Number(saleDraft.manualDiscount.value || 0).toLocaleString('es-NI')}`}`
          : ''),
      notes: saleDraft?.promotion?.name
        ? `Promoción aplicada: ${saleDraft.promotion.name}`
        : (saleDraft?.manualDiscount
          ? `Descuento manual aplicado: ${saleDraft.manualDiscount.type === 'percentage' ? `${saleDraft.manualDiscount.value}%` : `C$ ${Number(saleDraft.manualDiscount.value || 0).toLocaleString('es-NI')}`}`
          : ''),
      cashSessionId: activeCashSession.id,
      paymentMethod: saleDraft?.paymentMethod || 'cash',
      clientId: saleDraft?.clientId || null,
      clientName: saleDraft?.clientName || '',
      barbershopId: currentBarbershopId || null,
      branchId: currentBranchId || null,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.id || null,
    };

    setPosSales((prev) => [...prev, saleRecord]);
    if ((!hasSupabaseConfig || !session?.user?.id) && saleRecord.paymentMethod === 'cash') {
      setCashMovements((prev) => ([
        ...prev,
        {
          id: makeId(),
          cashSessionId: activeCashSession.id,
          barbershopId: currentBarbershopId,
          branchId: currentBranchId,
          type: 'in',
          movementKind: 'sale',
          paymentMethod: 'cash',
          amount: saleRecord.subtotal,
          notes: `Venta POS #${saleRecord.ticketNumber}`,
          referenceType: 'pos_sale',
          referenceId: saleRecord.id,
          createdBy: session?.user?.id || null,
          createdAt: saleRecord.createdAt,
        },
      ]));
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: saleRecord,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return saleRecord;
    }

    try {
      const persistedSale = await createPosSale(saleRecord, session.user.id, superAdminScopeOverride);
      setPosSales((prev) => prev.map((sale) => String(sale.id) === String(saleRecord.id) ? persistedSale : sale));
      if (persistedSale.updatedInventoryItems?.length) {
        setInventoryItems((prev) => prev.map((item) => {
          const updated = persistedSale.updatedInventoryItems.find((nextItem) => String(nextItem.id) === String(item.id));
          return updated || item;
        }));
      }
      if (persistedSale.inventoryConsumptionError) {
        notify(persistedSale.inventoryConsumptionError, 'warning');
      }
      if (persistedSale.paymentMethod === 'cash' && persistedSale.cashMovement) {
        setCashMovements((prev) => ([
          ...prev.filter((movement) => String(movement.referenceId || '') !== String(saleRecord.id)),
          persistedSale.cashMovement,
        ]));
      }
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: persistedSale,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return persistedSale;
    } catch (error) {
      setPosSales((prev) => prev.filter((sale) => String(sale.id) !== String(saleRecord.id)));
      handleSyncError(error, 'No pude registrar la venta de POS en Supabase.');
      return null;
    }
  };

  const handleCancelPosSale = async (saleId, reason = '', options = {}) => {
    if (!saleId) return false;
    const saleToCancel = (posSales || []).find((sale) => String(sale.id) === String(saleId));
    if (!saleToCancel || saleToCancel.canceledAt) return false;
    const canceledAt = new Date().toISOString();
    const cancellationReason = reason || 'Sin motivo especificado';
    const saleItems = Array.isArray(saleToCancel.items) ? saleToCancel.items : [];
    const saleHasInventoryImpact = saleItems.some((item) => (
      (item.category === 'Producto' && item.inventoryItemId)
      || (item.category !== 'Producto' && (
        (Array.isArray(item.inventoryUsage) && item.inventoryUsage.length > 0)
        || item.serviceId
        || item.id
      ))
    ));
    const shouldRestoreInventory = Object.prototype.hasOwnProperty.call(options || {}, 'restoreInventory')
      ? Boolean(options.restoreInventory)
      : (saleHasInventoryImpact
        ? window.confirm('Si esta anulacion fue por error y los productos o insumos NO se usaron, presiona Aceptar para devolverlos al inventario. Si los insumos si se gastaron, presiona Cancelar.')
        : false);
    const reversalMovement = {
      id: makeId(),
      cashSessionId: saleToCancel.cashSessionId || activeCashSession?.id || null,
      barbershopId: saleToCancel.barbershopId || currentBarbershopId,
      branchId: saleToCancel.branchId || currentBranchId,
      type: 'out',
      movementKind: 'sale',
      paymentMethod: saleToCancel.paymentMethod || 'cash',
      amount: Number(saleToCancel.subtotal || 0),
      notes: `Anulación venta POS #${saleToCancel.ticketNumber || ''} - ${cancellationReason}`,
      referenceType: 'pos_sale_void',
      referenceId: saleToCancel.id,
      ticketNumber: saleToCancel.ticketNumber || 0,
      createdBy: session?.user?.id || null,
      createdAt: canceledAt,
    };

    if (!hasSupabaseConfig || !session?.user?.id) {
      setPosSales((prev) => prev.map((sale) => (
        String(sale.id) === String(saleId)
          ? { ...sale, canceledAt, canceledBy: session?.user?.id || null, cancellationReason }
          : sale
      )));
      setCashMovements((prev) => [...prev, reversalMovement]);
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      notify('Venta anulada con reverso de caja.', 'success');
      return true;
    }

    try {
      const result = await cancelPosSaleWithReversal(
        saleToCancel,
        cancellationReason,
        session.user.id,
        superAdminScopeOverride,
        { restoreInventory: shouldRestoreInventory },
      );
      setPosSales((prev) => prev.map((sale) => String(sale.id) === String(saleId) ? result.sale : sale));
      setCashMovements((prev) => [...prev, result.movement]);
      if (Array.isArray(result.updatedInventoryItems) && result.updatedInventoryItems.length) {
        setInventoryItems((prev) => prev.map((item) => (
          result.updatedInventoryItems.find((updated) => String(updated.id) === String(item.id)) || item
        )));
      }
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      if (result.inventoryRestorationError) {
        notify(result.inventoryRestorationError, 'warning');
      } else {
        notify(shouldRestoreInventory ? 'Venta anulada y inventario devuelto.' : 'Venta anulada con reverso de caja.', 'success');
      }
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude cancelar la venta de POS en Supabase.');
      return false;
    }
  };

  const handleCancelCashMovement = async (movementId, reason = '') => {
    if (!movementId) return false;
    const movementToCancel = (cashMovements || []).find((movement) => String(movement.id) === String(movementId));
    if (!movementToCancel) return false;
    const movementNoteMeta = (() => {
      try {
        return movementToCancel.notes ? JSON.parse(movementToCancel.notes) : null;
      } catch {
        return null;
      }
    })();
    const reversalNotes = JSON.stringify({
      label: `Anulación movimiento: ${movementNoteMeta?.label || movementToCancel.notes || 'Sin detalle'} - ${reason || 'Sin motivo especificado'}`,
      currency: movementNoteMeta?.currency === 'USD' ? 'USD' : 'NIO',
      amountOriginal: Number(movementNoteMeta?.amountOriginal ?? movementToCancel.amount ?? 0),
      exchangeRate: movementNoteMeta?.exchangeRate ?? null,
      amountNio: Number(movementToCancel.amount || 0),
      reversalOf: movementToCancel.id,
    });
    const reversalMovement = {
      id: makeId(),
      cashSessionId: movementToCancel.cashSessionId || activeCashSession?.id || null,
      barbershopId: movementToCancel.barbershopId || currentBarbershopId,
      branchId: movementToCancel.branchId || currentBranchId,
      type: movementToCancel.type === 'out' ? 'in' : 'out',
      movementKind: 'manual',
      paymentMethod: movementToCancel.paymentMethod || 'cash',
      amount: Number(movementToCancel.amount || 0),
      notes: reversalNotes,
      referenceType: 'cash_movement_void',
      referenceId: movementToCancel.id,
      createdBy: session?.user?.id || null,
      createdAt: new Date().toISOString(),
    };

    if (!hasSupabaseConfig || !session?.user?.id) {
      setCashMovements((prev) => [...prev, reversalMovement]);
      notify('Movimiento anulado con reverso de caja.', 'success');
      return true;
    }

    try {
      const movement = await createCashAuditMovement(
        {
          cashSessionId: movementToCancel.cashSessionId,
          barbershopId: movementToCancel.barbershopId || currentBarbershopId,
          branchId: movementToCancel.branchId || currentBranchId,
          type: movementToCancel.type === 'out' ? 'in' : 'out',
          movementKind: 'manual',
          paymentMethod: movementToCancel.paymentMethod || 'cash',
          amount: Number(movementToCancel.amount || 0),
          notes: reversalNotes,
          referenceType: 'cash_movement_void',
          referenceId: movementToCancel.id,
        },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashMovements((prev) => [...prev, movement]);
      notify('Movimiento anulado con reverso de caja.', 'success');
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude anular el movimiento de caja.');
      return false;
    }
  };

  const handlePrintCashClosureFromHistory = (cashSessionRecord) => {
    if (!cashSessionRecord?.id) return;
    setSelectedData((prev) => ({
      ...prev,
      cashClosureReceipt: {
        cashSession: cashSessionRecord,
        cashMovements: (cashMovements || []).filter((movement) => String(movement.cashSessionId || '') === String(cashSessionRecord.id || '')),
        posSales: (posSales || []).filter((sale) => (
          String(sale.cashSessionId || '') === String(cashSessionRecord.id || '')
          && !sale.canceledAt
        )),
        barbershopName: currentBarbershop?.name || 'BarberPro',
        branchName: currentBranch?.name || 'General',
      },
    }));
    setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
  };

  const getNextWalkinQueueTime = (barberId, date = getTodayString()) => {
    return resolveWalkinQueueTime({ appointments, barberId, date });
  };

  const triggerWalkIn = (barberId = defaultBarberId) => {
    if (!barberId) {
      notify('Primero debes tener barberos registrados en esta sucursal para crear un turno sin cita.', 'warning');
      return;
    }
    const walkinDate = getTodayString();
    setSelectedData({
        ...selectedData,
        appointment: {
            date: walkinDate,
            time: getNextWalkinQueueTime(barberId, walkinDate),
            barberId,
            type: 'walkin'
        }
    });
    setModals({ ...modals, appointment: true });
  };

  const triggerQuickAppointment = (barberId = defaultBarberId) => {
    if (!barberId) {
      notify('Primero debes tener barberos registrados en esta sucursal para agendar rápido.', 'warning');
      return;
    }
    const quickDate = getTodayString();
    setSelectedData((prev) => ({
      ...prev,
      quickAppointment: {
        date: quickDate,
        time: getNextWalkinQueueTime(barberId, quickDate),
        barberId,
      },
    }));
    setModals((prev) => ({ ...prev, quickAppointment: true }));
  };
  if (loading) return (
    <div className="h-dvh min-h-dvh flex flex-col items-center justify-center bg-black gap-4 text-white">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <span className="text-[10px] font-black uppercase tracking-widest italic">Iniciando BarberPro...</span>
    </div>
  );

  return (
    <UiFeedbackContext.Provider value={feedbackContextValue}>
    <div className="mobile-simplify-shell flex h-dvh min-h-dvh bg-black text-white font-sans overflow-hidden">
      <style>{styleTag}</style>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden no-print"
        />
      )}

      <aside className={`mobile-sidebar fixed inset-y-0 left-0 z-40 flex w-[10.75rem] max-w-[68vw] flex-col border-r border-slate-900 bg-slate-950 no-print overflow-hidden transition-all duration-300 lg:static lg:max-w-none lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-0 lg:min-w-0 lg:opacity-0 lg:pointer-events-none lg:border-r-transparent' : 'lg:w-64 lg:opacity-100'} ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`mobile-sidebar-brand shrink-0 p-3 lg:p-8 flex items-start ${sidebarCollapsed ? 'lg:justify-center lg:px-4' : 'gap-2.5 lg:gap-3'}`}>
          <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-[1rem] p-1">
            <img
              src="/barberpro-logo-ui.png"
              alt="Logo BarberPro"
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-lg lg:text-xl font-bold tracking-tighter italic text-white">BarberPro<span className="text-indigo-500">.</span></h1>
            {session?.user?.email && (
              <p className="mobile-sidebar-email hidden lg:block text-[10px] font-black tracking-[0.14em] uppercase text-slate-500 mt-2 truncate">
                {session.user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-xl border border-cyan-300/15 bg-slate-900 p-2 text-slate-400 transition-colors hover:text-white lg:hidden"
            aria-label="Cerrar menú lateral"
          >
            <X size={16} />
          </button>
        </div>
        <nav className={`mobile-sidebar-nav min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 lg:px-4 pb-3 space-y-1 ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2.5 lg:py-4 rounded-2xl transition-all font-black uppercase text-[8px] lg:text-[10px] tracking-[0.16em] lg:tracking-widest ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'gap-2 lg:gap-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
              <item.icon size={16} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
            </button>
          ))}
          {(currentBarbershop?.name || currentBranch?.name || (isSuperAdmin && availableBarbershops.length > 0)) && !sidebarCollapsed && (
            <div className="mobile-sidebar-tenant-panel mt-2 rounded-xl border border-white/5 bg-black/25 px-2.5 py-2 space-y-1.5">
              {isSuperAdmin && availableBarbershops.length > 0 ? (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Vista</p>
                    <Crown size={12} className="text-indigo-300" />
                  </div>
                  <select
                    value={superAdminViewBarbershopId || availableBarbershops[0]?.id || ''}
                    onChange={(event) => setSuperAdminViewBarbershopId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-cyan-300/15 bg-black px-2.5 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white outline-none transition-all focus:border-indigo-500"
                  >
                    {availableBarbershops.map((shop) => (
                      <option key={shop.id} value={shop.id} className="bg-slate-950 text-white">
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : currentBarbershop?.name ? (
                <div className="min-w-0">
                  <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Barbería</p>
                  <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-[0.1em] text-slate-200">{currentBarbershop.name}</p>
                </div>
              ) : null}
              <div className="flex min-w-0 items-center justify-between gap-2 border-t border-white/5 pt-1.5">
                <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Sucursal</p>
                <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-emerald-300">{currentBranch?.name || 'General'}</p>
              </div>
            </div>
          )}
          {isSuperAdmin && availableBarbershops.length > 0 && sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mt-2 flex w-full items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-900/70 px-4 py-3 text-slate-200 transition-all hover:border-indigo-500/40 hover:text-white"
              title={currentBarbershop?.name ? `Cambiar barbería actual: ${currentBarbershop.name}` : 'Cambiar barbería'}
            >
              <Crown size={16} />
            </button>
          )}
        </nav>
        <div className={`mobile-sidebar-footer shrink-0 mobile-safe-bottom px-2 lg:px-4 py-3 lg:py-4 border-t border-slate-900 ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          <div className="mobile-sidebar-actions">
            {hasSupabaseConfig && session?.user && (
              <button
                onClick={() => setShowSelfPasswordModal(true)}
                disabled={passwordBusy}
                className={`w-full mb-2.5 lg:mb-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center justify-center border border-slate-800 transition-all ${sidebarCollapsed ? 'lg:px-0' : 'gap-2'}`}
                title={sidebarCollapsed ? 'Cambiar contraseña' : undefined}
              >
                {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Cambiar contraseña</span>
              </button>
            )}
            {hasSupabaseConfig && (
              <button
                onClick={handleSignOut}
                disabled={authBusy}
                className={`w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center justify-center border border-slate-800 transition-all ${sidebarCollapsed ? 'lg:px-0' : 'gap-2'}`}
                title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
              >
                {authBusy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950 min-w-0">
        <header className="bg-black border-b border-slate-900 px-3 md:px-8 py-2.5 md:py-4 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between z-20 no-print">
          <div className="flex w-full md:w-auto items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-900 text-slate-200 transition-colors hover:text-white lg:hidden shrink-0"
              aria-label="Abrir menú lateral"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden lg:flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-900 text-slate-200 transition-colors hover:text-white"
              aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            >
              <Menu size={18} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter leading-none truncate">{activeTab}</h2>
            </div>
          </div>
          {(activeTab === 'clientes' || activeTab === 'agenda') && (
            <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center justify-stretch md:justify-end gap-3">
              {activeTab === 'clientes' && <button onClick={() => { setSelectedData({ ...selectedData, client: null }); setModals({ ...modals, client: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all"><UserPlus size={16}/> Nuevo Cliente</button>}
              {activeTab === 'agenda' && <button onClick={() => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: '09:00', barberId: defaultBarberId } }); setModals({ ...modals, appointment: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all"><Plus size={16}/> Nueva Cita</button>}
            </div>
          )}
        </header>

        <div className="mobile-main-scroll flex-1 overflow-auto overflow-x-hidden custom-scrollbar">
          {['dashboard', 'caja', 'reportes'].includes(activeTab) && operationalWarnings.length > 0 && renderPersistentWarningBanner('Datos operativos con advertencias', operationalWarnings)}
          {activeTab === 'clientes' && clientDirectoryWarnings.length > 0 && renderPersistentWarningBanner('Clientes cargados parcialmente', clientDirectoryWarnings)}
          {activeTab === 'dashboard' && <DashboardView appointments={appointments} clients={clients} onUpdate={handleUpdateStatus} onOpenAppointment={openAppointmentActions} barbers={barbers} onNewWalkin={triggerWalkIn} onQuickAppointment={triggerQuickAppointment} onCashWithdrawal={openCashWithdrawal} posSales={activePosSales} />}
          {activeTab === 'agenda' && <AgendaView viewDate={viewDate} setViewDate={setViewDate} appointments={appointments} clients={clients} barbers={barbers} onSlotClick={(h, b) => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: h, barberId: b } }); setModals({ ...modals, appointment: true }); }} onAptClick={openAppointmentActions} onTransferApt={openTransferAppointment} />}
          {activeTab === 'clientes' && <ClientsTableView clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} barbers={effectiveClientDirectory.barbers} onRowClick={(c) => { setSelectedData({...selectedData, client: c}); setModals({...modals, clientDetail: true}); }} onNewApt={(c) => { setSelectedData({ ...selectedData, appointment: { date: getTodayString(), time: '09:00', barberId: defaultBarberId, client: c } }); setModals({ ...modals, appointment: true }); }} />}
          {activeTab === 'barberos' && (
            <BarbersView
              barbers={barbers}
              appointments={appointments}
              branches={availableBranches}
              currentBarbershopId={currentBarbershopId}
              currentBranchId={currentBranchId}
              canChooseBranch={isAdmin}
              onSave={handleSaveBarber}
              onDelete={handleDeleteBarber}
              onGoToNomina={() => setActiveTab('nomina')}
              onCashWithdrawal={openCashWithdrawal}
            />
          )}
          {activeTab === 'nomina' && (
            <NominaView
              barbers={barbers}
              appointments={appointments}
              cashWithdrawals={cashWithdrawals}
              payrollSettlements={payrollSettlements}
              onClose={() => setActiveTab('barberos')}
              onPagar={(barber, nomina) => {
                setSelectedData({ ...selectedData, paymentReceipt: { barber, nomina } });
                setModals({ ...modals, paymentReceipt: true });
              }}
              onOpenHistory={(barber, settlements) => {
                setSelectedData((prev) => ({ ...prev, payrollHistory: { barber, settlements } }));
                setModals((prev) => ({ ...prev, payrollHistory: true }));
              }}
              onLiquidarTodo={(rows, summary) => {
                setSelectedData({ ...selectedData, staffSettlement: { rows, summary } });
                setModals({ ...modals, staffSettlement: true });
              }}
            />
          )}
          {activeTab === 'services' && <ServicesView services={serviceMenuItems} serviceCategories={catalogSettings.serviceCategories} onSaveCatalog={(values) => handleSaveCatalogSettings('service_categories', values)} onAdd={(cat) => { if (cat === 'Producto') { setActiveTab('inventario'); return; } setSelectedData({...selectedData, service: { category: cat }}); setModals({...modals, service: true}); }} onEdit={(s) => { if (s?.category === 'Producto') { setActiveTab('inventario'); return; } setSelectedData({...selectedData, service: s}); setModals({...modals, service: true}); }} onDelete={handleDeleteService} onDeleteProduct={handleDeleteInventoryProduct} onManageInventory={() => setActiveTab('inventario')} />}
          {activeTab === 'inventario' && (
            <InventoryView
              inventoryItems={inventoryItems}
              productCategories={catalogSettings.inventoryProductCategories}
              onSaveCatalog={(values) => handleSaveCatalogSettings('inventory_product_categories', values)}
              onGoToProducts={() => setActiveTab('services')}
              onSaveProduct={handleSaveInventoryProduct}
              onDeleteProduct={handleDeleteInventoryProduct}
            />
          )}
          {activeTab === 'caja' && (
            <AppSectionErrorBoundary
              label="caja"
              resetKey={activeTab}
              onReset={() => setActiveTab('dashboard')}
            >
              <POSView
                services={services}
                clients={effectiveClientDirectory.clients}
                onSale={handleRegisterPosSale}
                cashSession={activeCashSession}
                cashMovements={activeCashMovements}
                posSales={activeCashPosSales}
                cashSessions={cashSessions}
                allCashMovements={cashMovements}
                allPosSales={posSales}
                onOpenCashSession={handleOpenCashSession}
                onCloseCashSession={handleCloseCashSession}
                onPrintCashClosure={handlePrintCashClosureFromHistory}
                onCashMovement={handleCashMovement}
                onCancelSale={handleCancelPosSale}
                onCancelCashMovement={handleCancelCashMovement}
                confirmAction={confirmAction}
                users={accessControl.users}
              />
            </AppSectionErrorBoundary>
          )}
          {activeTab === 'reportes' && (
            <ReportsView
              appointments={appointments}
              clients={clients}
              barbers={barbers}
              services={services}
              branches={availableBranches}
              currentBranchId={currentBranchId}
              posSales={posSales}
              cashMovements={cashMovements}
            />
          )}
          {activeTab === 'sistema' && (
              <SystemView
                currentUser={session?.user}
                accessControl={accessControl}
                savingUserId={savingUserId}
                creatingUser={creatingUser}
                resettingPasswordUserId={resettingPasswordUserId}
                onboardingBusy={onboardingBusy}
              onCreateSystemUser={handleCreateSystemUser}
              onResetUserPassword={handleResetUserPassword}
              onUpdateUserProfile={handleUpdateUserProfile}
              onCreateBarbershop={handleCreateBarbershop}
              onCreateBranch={handleCreateBranch}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
            />
            )}
        </div>
      </main>

      {modals.appointment && <AppointmentModal onClose={() => setModals({...modals, appointment: false})} onSave={handleSaveAppointment} services={services} clients={clients} barbers={barbers} initial={selectedData.appointment || { date: viewDate, time: '09:00', barberId: defaultBarberId }} appointments={appointments} />}
      {modals.quickAppointment && <QuickAppointmentModal onClose={() => setModals({...modals, quickAppointment: false})} onSave={handleSaveQuickAppointment} barbers={barbers} initial={selectedData.quickAppointment || { date: getTodayString(), time: getNextWalkinQueueTime(defaultBarberId), barberId: defaultBarberId }} appointments={appointments} />}
      {modals.cashWithdrawal && <CashWithdrawalModal onClose={() => setModals({...modals, cashWithdrawal: false})} onSave={handleSaveCashWithdrawal} barbers={barbers} initial={selectedData.cashWithdrawal || { barberId: defaultBarberId }} />}
      {modals.payrollHistory && <PayrollHistoryModal data={selectedData.payrollHistory} onClose={() => setModals({...modals, payrollHistory: false})} />}
      {modals.appointmentActions && <AppointmentActionsModal appointment={selectedData.appointmentActions} clients={clients} barbers={barbers} onClose={() => setModals({...modals, appointmentActions: false})} onUpdate={(id, status) => { setModals((prev) => ({ ...prev, appointmentActions: false })); handleUpdateStatus(id, status); }} onMove={(appointment) => { setModals((prev) => ({ ...prev, appointmentActions: false })); openRescheduleAppointment(appointment); }} onTransfer={(appointment) => { setModals((prev) => ({ ...prev, appointmentActions: false })); openTransferAppointment(appointment); }} onEdit={openEditAppointment} onCancel={handleCancelAppointment} onMarkLost={handleMarkAppointmentLost} />}
      {modals.rescheduleAppointment && <RescheduleAppointmentModal appointment={selectedData.rescheduleAppointment} appointments={appointments} clients={clients} barbers={barbers} onClose={() => setModals({...modals, rescheduleAppointment: false})} onSave={handleRescheduleAppointment} />}
      {modals.transferAppointment && <TransferAppointmentModal appointment={selectedData.transferAppointment} appointments={appointments} clients={clients} barbers={barbers} onClose={() => setModals({...modals, transferAppointment: false})} onSave={handleTransferAppointment} />}
      {modals.client && <ClientModal onClose={() => setModals({...modals, client: false})} onSave={handleSaveClient} clients={clients} initial={selectedData.client} />}
      {modals.clientDetail && <ClientDetailModal client={selectedData.client} clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} barbers={effectiveClientDirectory.barbers} onClose={() => setModals({...modals, clientDetail: false})} onEdit={() => { setModals({...modals, clientDetail: false, client: true}); }} onDelete={() => handleDeleteClient(selectedData.client.id)} onNewApt={() => { setModals({...modals, clientDetail: false, appointment: true}); setSelectedData({...selectedData, appointment: { date: getTodayString(), time: '09:00', barberId: defaultBarberId, client: selectedData.client } }); }} />}
      {modals.finalize && <FinalizeModal onClose={() => setModals({...modals, finalize: false})} onConfirm={(ex) => selectedData.finalize?.isQuickDirectSale ? handleConfirmQuickDirectSale(ex) : handleUpdateStatus(selectedData.finalize.id, 'Finalizada', ex)} services={services} clients={clients} initial={selectedData.finalize} />}
      {modals.service && <ServiceEditorModal services={services} inventoryItems={inventoryItems} serviceCategoryOptions={catalogSettings.serviceCategories} inventoryProductCategories={catalogSettings.inventoryProductCategories} onClose={() => setModals({...modals, service: false})} onSave={handleSaveService} initial={selectedData.service} />}
      {modals.paymentReceipt && <PaymentReceiptModal data={selectedData.paymentReceipt} onClose={() => setModals({...modals, paymentReceipt: false})} onConfirmPayment={handleConfirmPayment} confirmAction={confirmAction} />}
      {modals.posSaleReceipt && <PosSaleReceiptModal data={selectedData.posSaleReceipt} onClose={() => setModals({...modals, posSaleReceipt: false})} onCancelSale={handleCancelPosSale} confirmAction={confirmAction} />}
      {modals.staffSettlement && <StaffSettlementModal data={selectedData.staffSettlement} onClose={() => setModals({...modals, staffSettlement: false})} onConfirmSettlement={handleConfirmStaffSettlement} confirmAction={confirmAction} />}
      {modals.cashClosureReceipt && <CashClosureReceiptModal data={selectedData.cashClosureReceipt} onClose={() => setModals({...modals, cashClosureReceipt: false})} />}
      {showSelfPasswordModal && (
        <Suspense fallback={accessUiFallback}>
        <PasswordActionModal
          title={session?.user?.user_metadata?.must_change_password ? 'Actualiza tu contraseña' : 'Cambiar contraseña'}
          subtitle={session?.user?.user_metadata?.must_change_password ? 'Cambio obligatorio al primer acceso' : 'Mi cuenta'}
          submitLabel="Actualizar contraseña"
          busy={passwordBusy}
          onClose={() => {
            if (session?.user?.user_metadata?.must_change_password) return;
            setShowSelfPasswordModal(false);
          }}
          onSubmit={handleChangeOwnPassword}
          nextLabel="Nueva contraseña"
          nextPlaceholder="Minimo 6 caracteres"
          lockOpen={Boolean(session?.user?.user_metadata?.must_change_password)}
        />
        </Suspense>
      )}
      {feedbackToast && (
        (feedbackToast.tone === 'reservation-warning' || feedbackToast.tone === 'reservation-expired') ? (
          <div className="fixed left-1/2 top-5 z-[130] w-[min(92vw,720px)] -translate-x-1/2">
            <div className={`rounded-[2rem] border-2 px-6 py-5 shadow-[0_0_45px_rgba(255,115,0,0.55)] ${
              feedbackToast.tone === 'reservation-warning'
                ? 'border-orange-300 bg-[#ff6a00] text-white'
                : 'border-orange-200 bg-[#ff4d00] text-white'
            }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/30 bg-black/20">
                  <Info size={18} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] leading-none text-white/90">
                    {feedbackToast.tone === 'reservation-warning' ? 'Cita por vencerse' : 'Cita vencida'}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[15px] font-black leading-relaxed text-white">
                    {feedbackToast.message}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={dismissFeedbackToast}
                      className="rounded-xl border border-white/35 bg-black px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-950"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed top-6 right-6 z-[130] max-w-md">
            <div className={`rounded-[1.8rem] border px-5 py-4 shadow-2xl backdrop-blur-md ${
              feedbackToast.tone === 'success'
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
                : feedbackToast.tone === 'error'
                  ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
                  : 'bg-amber-500/15 border-amber-400/30 text-amber-100'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-bold leading-relaxed whitespace-pre-line">{feedbackToast.message}</p>
                <button
                  type="button"
                  onClick={dismissFeedbackToast}
                  className="text-white/50 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )
      )}
      {confirmState && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-cyan-300/15 bg-slate-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
              {confirmState.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              {confirmState.message}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="flex-1 rounded-2xl border border-cyan-300/15 bg-slate-900 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-slate-800"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className={`flex-1 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UiFeedbackContext.Provider>
  );
}

function AgendaView({ viewDate, setViewDate, appointments, clients, barbers, onSlotClick, onAptClick, onTransferApt }) {
  const today = getTodayString();
  const [agendaViewMode, setAgendaViewMode] = useState('day');
  const [nowPos, setNowPos] = useState(0);
  const [monthDaySummary, setMonthDaySummary] = useState(null);
  const agendaBarbers = useMemo(() => ((barbers && barbers.length > 0) ? barbers : []), [barbers]);
  const defaultBarberId = agendaBarbers[0]?.id || '';
  const dayStartMinutes = appointmentTimeToMinutes(HOURS[0] || '08:00');
  const dayEndMinutes = appointmentTimeToMinutes(HOURS[HOURS.length - 1] || '18:00') + 30;
  const totalDayMinutes = Math.max(dayEndMinutes - dayStartMinutes, 30);
  const clientById = useMemo(() => new Map((clients || []).map((client) => [String(client.id), client])), [clients]);
  const barberById = useMemo(() => new Map(agendaBarbers.map((barber) => [String(barber.id), barber])), [agendaBarbers]);
  const getAgendaServiceLabel = (serviceName) => normalizeFavoriteServiceName(serviceName) || 'Servicio';
  const selectedDate = useMemo(() => new Date(`${viewDate}T00:00:00`), [viewDate]);
  const isToday = viewDate === today;

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const startOfWeek = (date) => {
    const next = new Date(date);
    const day = next.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + offset);
    return next;
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index)), [selectedDate]);
  const monthDays = useMemo(() => {
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const weekStart = startOfWeek(firstDay);
    return Array.from({ length: 42 }, (_, index) => addDays(weekStart, index));
  }, [selectedDate]);
  const viewTitle = useMemo(() => {
    if (agendaViewMode === 'month') {
      return selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (agendaViewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      return `${first.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${last.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [agendaViewMode, selectedDate, weekDays]);

  const activeAppointments = useMemo(
    () => (appointments || [])
      .filter((appointment) => appointment.status !== 'Cancelada')
      .sort((left, right) => String(left.time || '').localeCompare(String(right.time || ''))),
    [appointments],
  );

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map();
    activeAppointments.forEach((appointment) => {
      const key = standardizeDate(appointment.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(appointment);
    });
    return grouped;
  }, [activeAppointments]);

  const dayAppointments = useMemo(() => appointmentsByDate.get(viewDate) || [], [appointmentsByDate, viewDate]);
  const visibleAppointments = useMemo(() => {
    if (agendaViewMode === 'month') {
      const keys = new Set(monthDays.map((date) => formatLocalDateYmd(date)));
      return activeAppointments.filter((appointment) => keys.has(standardizeDate(appointment.date)));
    }
    if (agendaViewMode === 'week') {
      const keys = new Set(weekDays.map((date) => formatLocalDateYmd(date)));
      return activeAppointments.filter((appointment) => keys.has(standardizeDate(appointment.date)));
    }
    return dayAppointments;
  }, [activeAppointments, agendaViewMode, dayAppointments, monthDays, weekDays]);


  const agendaStats = useMemo(() => {
    const active = visibleAppointments.filter((appointment) => !['Finalizada', 'Cita Perdida'].includes(appointment.status));
    const finished = visibleAppointments.filter((appointment) => appointment.status === 'Finalizada');
    const missed = visibleAppointments.filter((appointment) => appointment.status === 'Cita Perdida');
    return { total: visibleAppointments.length, active: active.length, finished: finished.length, missed: missed.length };
  }, [visibleAppointments]);

  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) {
        setNowPos(-1);
        return;
      }
      setNowPos(((currentMinutes - dayStartMinutes) / totalDayMinutes) * 100);
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [dayStartMinutes, dayEndMinutes, totalDayMinutes]);

  const formatAgendaTime = (time) => {
    if (!time) return '--:--';
    const [hourRaw, minuteRaw] = String(time).split(':').map(Number);
    if (!Number.isFinite(hourRaw)) return time;
    const suffix = hourRaw >= 12 ? 'p. m.' : 'a. m.';
    const hour = hourRaw % 12 || 12;
    const minute = Number.isFinite(minuteRaw) ? String(minuteRaw).padStart(2, '0') : '00';
    return `${hour}:${minute} ${suffix}`;
  };

  const getClientLabel = (appointment) => getAppointmentDisplayClientName(appointment, clientById.get(String(appointment.clientId)));
  const getClientMetaLabel = (appointment) => getAppointmentClientMetaLabel(appointment);
  const getBarber = (appointment) => barberById.get(String(appointment.barberId));
  const getMonthAppointmentLabel = (appointment) => {
    const clientLabel = getClientLabel(appointment);
    const barber = getBarber(appointment);
    return barber?.name ? `${clientLabel} - ${barber.name}` : clientLabel;
  };
  const openMonthDaySummary = (dateKey) => {
    const items = appointmentsByDate.get(dateKey) || [];
    setMonthDaySummary({ dateKey, items });
  };

  const changePeriod = (direction) => {
    const next = new Date(selectedDate);
    if (agendaViewMode === 'month') next.setMonth(next.getMonth() + direction);
    else if (agendaViewMode === 'week') next.setDate(next.getDate() + (direction * 7));
    else next.setDate(next.getDate() + direction);
    setViewDate(formatLocalDateYmd(next));
  };

  const addAppointmentAt = (time = '09:00', date = viewDate) => {
    setViewDate(date);
    onSlotClick(time, defaultBarberId);
  };

  const renderStats = () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 md:rounded-2xl md:px-4"><p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-500 md:text-[8px]">Citas</p><p className="mt-1 text-lg font-black italic text-white md:text-xl">{agendaStats.total}</p></div>
      <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2.5 md:rounded-2xl md:px-4"><p className="text-[7px] font-black uppercase tracking-[0.16em] text-indigo-300 md:text-[8px]">Activas</p><p className="mt-1 text-lg font-black italic text-indigo-200 md:text-xl">{agendaStats.active}</p></div>
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 md:rounded-2xl md:px-4"><p className="text-[7px] font-black uppercase tracking-[0.16em] text-emerald-300 md:text-[8px]">Finalizadas</p><p className="mt-1 text-lg font-black italic text-emerald-200 md:text-xl">{agendaStats.finished}</p></div>
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 md:rounded-2xl md:px-4"><p className="text-[7px] font-black uppercase tracking-[0.16em] text-rose-300 md:text-[8px]">Perdidas</p><p className="mt-1 text-lg font-black italic text-rose-200 md:text-xl">{agendaStats.missed}</p></div>
    </div>
  );

  const renderAppointmentCard = (appointment, compact = false) => {
    const barber = getBarber(appointment);
    return (
      <button key={appointment.id} type="button" onClick={() => onAptClick(appointment)} className={`w-full rounded-2xl border border-slate-800 bg-slate-900/55 text-left transition-all hover:border-indigo-400/40 hover:bg-indigo-500/10 ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase italic text-white md:text-[11px]">{getClientLabel(appointment)}</p>
            <p className="mt-1 truncate text-[8px] font-black uppercase tracking-[0.14em] text-slate-500 md:text-[9px]">{getClientMetaLabel(appointment) || getAgendaServiceLabel(appointment.service)}</p>
          </div>
          <p className="shrink-0 text-[9px] font-black text-cyan-200 md:text-[10px]">{formatAgendaTime(appointment.time)}</p>
        </div>
        {!compact && (
          <div className="mt-3 flex items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${barber?.bg || 'bg-slate-700'} text-[8px] font-black italic text-white`}>{barber?.avatar || '?'}</div>
            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">{barber?.name || 'Sin barbero'} - {appointment.status || 'Confirmada'}</p>
          </div>
        )}
      </button>
    );
  };

  const renderDayView = () => {
    const agendaTimeColumnWidth = 112;
    const agendaBarberColumnWidth = 168;
    const agendaMinWidth = Math.max(760, agendaTimeColumnWidth + (agendaBarbers.length * agendaBarberColumnWidth));
    const agendaGridColumns = `${agendaTimeColumnWidth}px repeat(${Math.max(agendaBarbers.length, 1)}, minmax(${agendaBarberColumnWidth}px, 1fr))`;

    if (!agendaBarbers.length) {
      return (
        <section className="agenda-table-shell min-h-[32rem] overflow-hidden rounded-[2rem] border border-slate-800 bg-black/45 p-6 shadow-[0_0_80px_rgba(0,0,0,0.48)] md:rounded-[2.5rem]">
          <div className="mb-5">{renderStats()}</div>
          <div className="flex min-h-[22rem] items-center justify-center rounded-[2rem] border border-dashed border-cyan-400/30 bg-cyan-400/5 p-8 text-center">
            <div>
              <p className="text-2xl font-black uppercase italic text-white">No hay barberos activos</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Agrega barberos para usar la vista diaria por columnas.</p>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        {renderStats()}

        <div className="lg:hidden space-y-4">
          {agendaBarbers.map((barber) => {
            const barberAppointments = dayAppointments.filter((appointment) => String(appointment.barberId) === String(barber.id));
            return (
              <div key={barber.id} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${barber.bg || 'bg-slate-700'} flex items-center justify-center font-black italic text-white`}>{barber.avatar || '?'}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black uppercase italic tracking-tighter text-white">{barber.name}</p>
                    <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${barberAppointments.length ? 'text-indigo-300' : 'text-emerald-300'}`}>
                      {barberAppointments.length ? `${barberAppointments.length} cita${barberAppointments.length === 1 ? '' : 's'} en agenda` : 'Disponible'}
                    </p>
                  </div>
                  <button type="button" onClick={() => onSlotClick(getCurrentTimeHHmm(), barber.id)} className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-3 text-indigo-300 transition-all hover:bg-indigo-600/20">
                    <Plus size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {barberAppointments.length ? barberAppointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-800 bg-black/25 p-3">
                      {renderAppointmentCard(appointment)}
                      {appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida' && (
                        <button type="button" onClick={() => onTransferApt?.(appointment)} className="mt-3 w-full rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200 transition-all hover:bg-cyan-400/15">
                          Trasladar
                        </button>
                      )}
                    </div>
                  )) : (
                    <button type="button" onClick={() => onSlotClick('09:00', barber.id)} className="w-full rounded-2xl border border-dashed border-slate-700 bg-black/20 px-4 py-6 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition-all hover:border-indigo-400/40 hover:text-indigo-200">
                      Agendar cita
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="agenda-table-shell hidden min-h-[34rem] flex-col md:min-h-[calc(100vh-14rem)] overflow-hidden rounded-[2.5rem] border border-slate-800 bg-black/45 shadow-[0_0_80px_rgba(0,0,0,0.48)] lg:flex">
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            <div className="relative flex min-h-full flex-col" style={{ minWidth: agendaMinWidth }}>
              <div className="sticky top-0 z-50 grid border-b border-slate-800 bg-slate-950 shadow-[0_12px_30px_rgba(0,0,0,0.35)]" style={{ gridTemplateColumns: agendaGridColumns }}>
                <div className="flex items-center justify-center border-r border-slate-800 bg-black p-4"><Clock className="text-slate-600" size={22} /></div>
                {agendaBarbers.map((barber) => (
                  <div key={barber.id} className="last:border-0 flex min-w-0 items-center justify-center gap-3 border-r border-slate-800 p-4 text-white xl:gap-4 xl:p-6">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 ${barber.color || 'border-slate-600'} bg-slate-950 text-xs font-black italic text-white shadow-lg`}>{barber.avatar || '?'}</div>
                    <div className="flex min-w-0 flex-col items-start leading-none text-white">
                      <span className="w-full truncate text-[11px] font-black uppercase italic tracking-widest text-white">{barber.name}</span>
                      <span className={`mt-1 text-[8px] font-bold uppercase tracking-widest ${String(barber.color || 'border-slate-600').replace('border', 'text')}`}>Disponible</span>
                    </div>
                  </div>
                ))}
              </div>

              {isToday && nowPos >= 0 && (
                <div className="pointer-events-none absolute left-0 z-20 flex h-1 w-full items-center justify-start bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)]" style={{ top: `calc(76px + ((${nowPos} / 100) * (${HOURS.length} * 100px)))` }}>
                  <div className="-translate-y-1/2 rounded-full bg-rose-600 px-3 py-1 text-[8px] font-black uppercase text-white shadow-lg" style={{ marginLeft: agendaTimeColumnWidth }}>Ahora</div>
                </div>
              )}

              {HOURS.map((hour) => (
                <div key={hour} className="group/row grid min-h-[100px] border-b border-slate-900 transition-colors hover:bg-indigo-600/[0.03]" style={{ gridTemplateColumns: agendaGridColumns }}>
                  <div className="flex items-center justify-center border-r border-slate-900 bg-slate-900/10 p-4 text-sm font-black italic text-slate-500 transition-colors group-hover/row:text-indigo-400">{formatAgendaTime(hour)}</div>
                  {agendaBarbers.map((barber) => {
                    const appointment = dayAppointments.find((item) => {
                      const [aptHour, aptMinute] = String(item.time || '00:00').split(':').map(Number);
                      const [slotHour, slotMinute] = hour.split(':').map(Number);
                      const isWithinSlot = aptHour === slotHour && aptMinute >= slotMinute && aptMinute < slotMinute + 30;
                      return isWithinSlot && String(item.barberId) === String(barber.id) && item.status !== 'Cancelada';
                    });

                    let statusStyles = 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 shadow-[0_10px_20px_rgba(79,70,229,0.3)]';
                    if (appointment?.status === 'En Corte') statusStyles = 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 shadow-[0_10px_20px_rgba(16,185,129,0.3)]';
                    if (appointment?.status === 'Finalizada' || appointment?.status === 'Cita Perdida') statusStyles = 'bg-slate-800 border-slate-700 opacity-60';

                    return (
                      <div key={`${hour}-${barber.id}`} onClick={() => (appointment ? onAptClick(appointment) : onSlotClick(hour, barber.id))} className={`group/cell relative flex items-stretch border-r border-slate-900 p-2 transition-all last:border-r-0 ${!appointment ? 'cursor-pointer hover:bg-indigo-500/[0.05]' : ''}`}>
                        {appointment ? (
                          <div className={`relative flex w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-3 text-white transition-all hover:scale-[1.02] ${statusStyles}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-black uppercase italic tracking-tight text-white">{getClientLabel(appointment)}</p>
                                <p className="mt-2 truncate text-[8px] font-black uppercase tracking-widest text-white/80"><Scissors size={10} className="mr-1 inline" />{getAgendaServiceLabel(appointment.service)}</p>
                              </div>
                              <Clock size={14} className="shrink-0 text-white/70" />
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-2">
                              {appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida' && (
                                <button type="button" onClick={(event) => { event.stopPropagation(); onTransferApt?.(appointment); }} className="rounded-lg bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-slate-900 shadow-lg transition-all hover:bg-cyan-50">
                                  Trasladar
                                </button>
                              )}
                              <span className="ml-auto text-[9px] font-black italic text-white/80">{formatAgendaTime(appointment.time)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-transparent opacity-0 transition-all group-hover/cell:border-indigo-500/30 group-hover/cell:bg-indigo-500/5 group-hover/cell:opacity-100">
                            <Plus className="text-indigo-400" size={22} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };
  const renderWeekView = () => (
    <section className="agenda-table-shell flex h-full min-h-[34rem] flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-black/45 shadow-[0_0_80px_rgba(0,0,0,0.48)] md:min-h-0 md:rounded-[2.5rem]">
      <div className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-3 py-2.5 backdrop-blur md:px-4">{renderStats()}</div>
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <div className="grid min-w-[52rem] grid-cols-[4.4rem_repeat(7,minmax(0,1fr))] xl:min-w-0">
          <div className="sticky left-0 z-20 border-b border-r border-slate-800 bg-black p-2"><Clock className="mx-auto text-slate-600" size={16} /></div>
          {weekDays.map((date) => {
            const key = formatLocalDateYmd(date);
            const selected = key === viewDate;
            return <button key={key} type="button" onClick={() => setViewDate(key)} className={`border-b border-r border-slate-800 p-2 text-center transition-all ${selected ? 'bg-indigo-500/20 text-white' : 'bg-slate-950 text-slate-400 hover:bg-indigo-500/10'}`}><p className="text-[9px] font-black uppercase tracking-[0.16em]">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</p><p className="mt-1 text-xl font-black italic">{date.getDate()}</p></button>;
          })}
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div className="sticky left-0 z-10 border-b border-r border-slate-800 bg-slate-950 px-1.5 py-3 text-center text-[9px] font-black italic text-slate-500">{formatAgendaTime(hour)}</div>
              {weekDays.map((date) => {
                const dateKey = formatLocalDateYmd(date);
                const [slotH, slotM] = hour.split(':').map(Number);
                const slotAppointments = (appointmentsByDate.get(dateKey) || []).filter((appointment) => {
                  const [aptH, aptM] = String(appointment.time || '00:00').split(':').map(Number);
                  return aptH === slotH && aptM >= slotM && aptM < slotM + 30;
                });
                return (
                  <div key={`${dateKey}-${hour}`} onDoubleClick={() => addAppointmentAt(hour, dateKey)} className="min-h-[5.8rem] border-b border-r border-slate-800 bg-slate-950/35 p-1.5 transition-colors hover:bg-indigo-500/[0.04]">
                    <div className="space-y-2">{slotAppointments.map((appointment) => renderAppointmentCard(appointment, true))}</div>
                    {slotAppointments.length === 0 && <button type="button" onClick={() => addAppointmentAt(hour, dateKey)} className="flex h-full min-h-[3.6rem] w-full items-center justify-center rounded-xl border border-dashed border-transparent text-[7px] font-black uppercase tracking-[0.12em] text-slate-700 transition-all hover:border-cyan-400/25 hover:text-cyan-300">+ cita</button>}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );

  const renderMonthView = () => (
    <section className="agenda-table-shell flex h-[calc(100vh-6.5rem)] min-h-[52rem] flex-col overflow-hidden rounded-[1.8rem] border border-slate-800 bg-slate-950 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
      <div className="grid shrink-0 grid-cols-7 border-b border-slate-800 bg-black/50 text-center text-[11px] font-black uppercase tracking-[0.12em] text-cyan-200">
        {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((label) => <div key={label} className="border-r border-slate-800 px-2 py-3 last:border-r-0">{label}</div>)}
      </div>
      <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-7 auto-rows-[12.5rem] overflow-y-auto md:auto-rows-[13.5rem] xl:auto-rows-[14.5rem]">
        {monthDays.map((date) => {
          const dateKey = formatLocalDateYmd(date);
          const items = appointmentsByDate.get(dateKey) || [];
          const visibleItems = items.slice(0, 3);
          const hiddenCount = Math.max(items.length - visibleItems.length, 0);
          const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
          const selected = dateKey === viewDate;
          return (
            <div key={dateKey} role="button" tabIndex={0} onClick={() => openMonthDaySummary(dateKey)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openMonthDaySummary(dateKey); }} className={`group/month-day flex min-h-0 cursor-pointer flex-col overflow-hidden border-b border-r border-slate-800 bg-slate-950 p-4 text-left last:border-r-0 md:p-5 ${!isCurrentMonth ? 'bg-black/35 text-slate-600' : ''} ${selected ? 'bg-slate-900 ring-1 ring-inset ring-cyan-300/70' : ''}`}>
              <div className="mb-4 flex shrink-0 items-start justify-between gap-2">
                <button type="button" onClick={(event) => { event.stopPropagation(); setViewDate(dateKey); setAgendaViewMode('day'); }} className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[16px] font-black transition-all ${dateKey === today ? 'bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)]' : isCurrentMonth ? 'text-slate-100 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-900'}`}>
                  {date.getDate()}
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); addAppointmentAt('09:00', dateKey); }} className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-slate-600 opacity-0 transition-all hover:bg-slate-800 hover:text-cyan-200 group-hover/month-day:opacity-100">+</button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
                {visibleItems.map((appointment) => {
                  const barber = getBarber(appointment);
                  return (
                    <button key={appointment.id} type="button" onClick={(event) => { event.stopPropagation(); onAptClick(appointment); }} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/95 px-2.5 py-2 text-left text-slate-100 transition-all hover:border-cyan-300/40 hover:bg-slate-800">
                      <span className={`h-3 w-3 shrink-0 rounded-full ${barber?.bg || 'bg-cyan-400'}`} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-black leading-tight md:text-[13px]">{getMonthAppointmentLabel(appointment)}</span>
                    </button>
                  );
                })}
              </div>
              {hiddenCount > 0 && (
                <button type="button" onClick={(event) => { event.stopPropagation(); openMonthDaySummary(dateKey); }} className="mt-2 shrink-0 rounded-lg border border-cyan-300/35 bg-cyan-300/12 px-2.5 py-2 text-left text-[11px] font-black uppercase tracking-[0.08em] text-cyan-100 transition-all hover:bg-cyan-300/25">
                  +{hiddenCount} citas mas
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
  const renderSidePanel = () => (
    <aside className="space-y-4">
      <section className="rounded-[2rem] border border-slate-800 bg-black p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Equipo</p><h4 className="mt-1 text-xl font-black uppercase italic tracking-tighter text-white">Barberos</h4></div><button onClick={() => addAppointmentAt(getCurrentTimeHHmm())} className="rounded-2xl bg-cyan-400 px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-950 hover:bg-cyan-300">+ Cita</button></div>
        <div className="mt-4 space-y-2">{agendaBarbers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">No hay barberos activos.</div> : agendaBarbers.map((barber) => { const count = visibleAppointments.filter((appointment) => String(appointment.barberId) === String(barber.id)).length; return <div key={barber.id} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${barber.bg} text-[10px] font-black italic text-white`}>{barber.avatar}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black uppercase italic text-white">{barber.name}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">{count} cita{count === 1 ? '' : 's'}</p></div><span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[8px] font-black text-cyan-200">{count}</span></div>; })}</div>
      </section>
      <section className="rounded-[2rem] border border-slate-800 bg-black p-5 text-white shadow-2xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Lista visible</p><div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">{visibleAppointments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Sin citas registradas.</div> : visibleAppointments.slice(0, 18).map((appointment) => renderAppointmentCard(appointment))}</div></section>
    </aside>
  );

  return (
    <div className="agenda-view flex h-full flex-col gap-3 bg-slate-950 p-3 no-print md:gap-4 md:p-5 2xl:p-8">
      <div className="agenda-toolbar-scroll">
        <div className="agenda-toolbar min-w-full flex flex-col gap-3 rounded-[1.6rem] border border-slate-800 bg-black p-3 text-white shadow-2xl md:rounded-[2rem] md:p-4 xl:flex-row xl:items-center xl:justify-between 2xl:p-6">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <button onClick={() => changePeriod(-1)} className="rounded-2xl bg-slate-900 p-3 text-white shadow-lg transition-all hover:bg-indigo-600 md:p-4"><ChevronLeft size={20}/></button>
            <button onClick={() => setViewDate(today)} className="rounded-xl border border-indigo-600/30 bg-indigo-600/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-300 transition-all hover:bg-indigo-600 hover:text-white md:px-6 md:py-4">Hoy</button>
            <button onClick={() => changePeriod(1)} className="rounded-2xl bg-slate-900 p-3 text-white shadow-lg transition-all hover:bg-indigo-600 md:p-4"><ChevronRight size={20}/></button>
            <div className="flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
              {[{ id: 'day', label: 'Dia' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mes' }].map((mode) => <button key={mode.id} type="button" onClick={() => setAgendaViewMode(mode.id)} className={`rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.16em] transition-all ${agendaViewMode === mode.id ? 'bg-cyan-300 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.24)]' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>{mode.label}</button>)}
            </div>
          </div>
          <div className="text-center xl:text-right"><p className="mobile-simplify-subtitle mb-2 text-[10px] font-black uppercase italic leading-none tracking-[0.3em] text-cyan-300">Agenda de barberia</p><h3 className="text-2xl font-black uppercase italic leading-tight tracking-tighter text-white sm:text-3xl md:text-3xl">{viewTitle}</h3></div>
        </div>
      </div>
      <div className={`grid min-h-0 flex-1 gap-4 ${agendaViewMode === 'day' ? 'min-[1800px]:grid-cols-[minmax(0,1fr)_21rem]' : 'grid-cols-1'}`}>
        {agendaViewMode === 'month' ? renderMonthView() : agendaViewMode === 'week' ? renderWeekView() : renderDayView()}
        {agendaViewMode === 'day' && <div className="hidden min-[1800px]:block">{renderSidePanel()}</div>}
      </div>
      {monthDaySummary && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md no-print" onClick={() => setMonthDaySummary(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 text-white shadow-[0_24px_90px_rgba(0,0,0,0.6)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-black px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Resumen del dia</p>
                <h3 className="mt-1 text-2xl font-black uppercase italic leading-none text-white">{new Date(`${monthDaySummary.dateKey}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{monthDaySummary.items.length} cita{monthDaySummary.items.length === 1 ? '' : 's'} agendada{monthDaySummary.items.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => setMonthDaySummary(null)} className="rounded-2xl border border-cyan-300/30 bg-slate-900 p-3 text-cyan-200 transition-all hover:bg-cyan-300 hover:text-slate-950"><X size={22} /></button>
            </div>
            <div className="custom-scrollbar max-h-[60vh] space-y-3 overflow-y-auto p-5">
              {monthDaySummary.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-5 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">No hay citas para este dia.</div>
              ) : monthDaySummary.items.map((appointment) => {
                const barber = getBarber(appointment);
                return (
                  <button key={appointment.id} type="button" onClick={() => { setMonthDaySummary(null); onAptClick(appointment); }} className="flex w-full items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left transition-all hover:border-cyan-300/40 hover:bg-slate-900">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${barber?.bg || 'bg-cyan-500'} text-[11px] font-black italic text-white`}>{barber?.avatar || 'C'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black uppercase italic text-white">{getClientLabel(appointment)}</span>
                      <span className="mt-1 block truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{formatAgendaTime(appointment.time)} - {barber?.name || 'Sin barbero'} - {getAgendaServiceLabel(appointment.service)}</span>
                    </span>
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">Ver</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-800 bg-black/60 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { addAppointmentAt('09:00', monthDaySummary.dateKey); setMonthDaySummary(null); }} className="rounded-2xl bg-cyan-300 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950 transition-all hover:bg-cyan-200">Nueva cita</button>
              <button type="button" onClick={() => { setViewDate(monthDaySummary.dateKey); setAgendaViewMode('day'); setMonthDaySummary(null); }} className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all hover:border-cyan-300/40">Ver dia completo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogSettingsModal({ title, subtitle, values = [], protectedValues = [], onSave, onClose }) {
  const [items, setItems] = useState(values);
  const [newValue, setNewValue] = useState('');
  const protectedSet = useMemo(() => new Set(protectedValues), [protectedValues]);

  const addItem = () => {
    const value = newValue.trim();
    if (!value) return;
    setItems((prev) => Array.from(new Set([...prev, value])));
    setNewValue('');
  };

  const removeItem = (value) => {
    if (protectedSet.has(value)) return;
    setItems((prev) => prev.filter((item) => item !== value));
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md no-print">
      <div className="flex h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-cyan-400/30 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Configuración de catálogo</p>
            <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tighter text-white">{title}</h3>
            <p className="mt-2 text-[11px] font-bold text-slate-400">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-300 hover:text-cyan-200">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addItem();
                }
              }}
              className="w-full rounded-2xl border border-slate-700 bg-black px-5 py-4 text-sm font-black uppercase text-white outline-none focus:border-cyan-300"
              placeholder="Nueva categoría"
            />
            <button type="button" onClick={addItem} className="rounded-2xl bg-cyan-400 px-7 py-4 text-[10px] font-black uppercase italic tracking-[0.16em] text-slate-950 shadow-[0_14px_30px_rgba(34,211,238,0.22)] hover:bg-cyan-300">
              Agregar
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isProtected = protectedSet.has(item);
              return (
                <div key={item} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase italic text-white">{item}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{isProtected ? 'Sistema' : 'Editable'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    disabled={isProtected}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isProtected ? 'border-slate-800 text-slate-600' : 'border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/10'}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-900 px-7 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 hover:border-slate-500">
            Cancelar
          </button>
          <button type="button" onClick={() => onSave?.(items)} className="rounded-2xl bg-emerald-400 px-8 py-4 text-[10px] font-black uppercase italic tracking-[0.16em] text-slate-950 shadow-[0_14px_30px_rgba(16,185,129,0.22)] hover:bg-emerald-300">
            Guardar catálogo
          </button>
        </div>
      </div>
    </div>
  );
}


function ServicesView({ services, serviceCategories = CATEGORIES, onSaveCatalog, onAdd, onEdit, onDelete, onDeleteProduct, onManageInventory }) {
  const [activeCategory, setActiveCategory] = useState('Cortes');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const visibleCategories = useMemo(() => Array.from(new Set([...(serviceCategories || CATEGORIES), ...PROTECTED_SERVICE_CATEGORIES])), [serviceCategories]);
  const effectiveActiveCategory = visibleCategories.includes(activeCategory) ? activeCategory : visibleCategories[0] || 'Cortes';
  const getIcon = (cat, size = 32) => {
    switch(cat) {
      case 'Cortes': return <Scissors size={size} />;
      case 'Barba': return <BeardIcon size={size} />;
      case 'Combo': return <Zap size={size} />;
      case 'Producto': return <Package size={size} />;
      case 'Promocion': return <Gift size={size} />;
      default: return <Tags size={size} />;
    }
  };
  const categoryThemes = {
    Cortes: {
      active: 'border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.48)]',
      idle: 'border-cyan-400/25 text-cyan-300/70 hover:border-cyan-300/70 hover:bg-cyan-400/10 hover:text-cyan-100 hover:shadow-[0_0_22px_rgba(34,211,238,0.24)]',
      dot: 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.75)]',
      card: 'hover:border-cyan-300/70 hover:shadow-[0_0_38px_rgba(34,211,238,0.18)]',
      haze: 'bg-cyan-400/12 group-hover:bg-cyan-300/30',
      icon: 'text-cyan-300 border-cyan-400/35 group-hover:bg-cyan-400 group-hover:text-slate-950 group-hover:border-cyan-200',
      pill: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/35',
      price: 'text-cyan-300 group-hover:text-cyan-100',
    },
    Barba: {
      active: 'border-rose-300 bg-rose-500 text-white shadow-[0_0_26px_rgba(244,63,94,0.45)]',
      idle: 'border-rose-400/25 text-rose-300/70 hover:border-rose-300/70 hover:bg-rose-500/10 hover:text-rose-100 hover:shadow-[0_0_22px_rgba(244,63,94,0.22)]',
      dot: 'bg-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.75)]',
      card: 'hover:border-rose-300/70 hover:shadow-[0_0_38px_rgba(244,63,94,0.18)]',
      haze: 'bg-rose-500/12 group-hover:bg-rose-400/30',
      icon: 'text-rose-300 border-rose-400/35 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-200',
      pill: 'bg-rose-500/10 text-rose-300 border-rose-400/35',
      price: 'text-rose-300 group-hover:text-rose-100',
    },
    Producto: {
      active: 'border-emerald-300 bg-emerald-400 text-slate-950 shadow-[0_0_26px_rgba(16,185,129,0.45)]',
      idle: 'border-emerald-400/25 text-emerald-300/70 hover:border-emerald-300/70 hover:bg-emerald-400/10 hover:text-emerald-100 hover:shadow-[0_0_22px_rgba(16,185,129,0.22)]',
      dot: 'bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.75)]',
      card: 'hover:border-emerald-300/70 hover:shadow-[0_0_38px_rgba(16,185,129,0.18)]',
      haze: 'bg-emerald-400/12 group-hover:bg-emerald-300/30',
      icon: 'text-emerald-300 border-emerald-400/35 group-hover:bg-emerald-400 group-hover:text-slate-950 group-hover:border-emerald-200',
      pill: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/35',
      price: 'text-emerald-300 group-hover:text-emerald-100',
    },
    Combo: {
      active: 'border-amber-300 bg-amber-400 text-slate-950 shadow-[0_0_26px_rgba(245,158,11,0.45)]',
      idle: 'border-amber-400/25 text-amber-300/70 hover:border-amber-300/70 hover:bg-amber-400/10 hover:text-amber-100 hover:shadow-[0_0_22px_rgba(245,158,11,0.22)]',
      dot: 'bg-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.75)]',
      card: 'hover:border-amber-300/70 hover:shadow-[0_0_38px_rgba(245,158,11,0.18)]',
      haze: 'bg-amber-400/12 group-hover:bg-amber-300/30',
      icon: 'text-amber-300 border-amber-400/35 group-hover:bg-amber-400 group-hover:text-slate-950 group-hover:border-amber-200',
      pill: 'bg-amber-400/10 text-amber-300 border-amber-400/35',
      price: 'text-amber-300 group-hover:text-amber-100',
    },
    Promocion: {
      active: 'border-fuchsia-300 bg-fuchsia-500 text-white shadow-[0_0_26px_rgba(217,70,239,0.45)]',
      idle: 'border-fuchsia-400/25 text-fuchsia-300/70 hover:border-fuchsia-300/70 hover:bg-fuchsia-500/10 hover:text-fuchsia-100 hover:shadow-[0_0_22px_rgba(217,70,239,0.22)]',
      dot: 'bg-fuchsia-300 shadow-[0_0_14px_rgba(217,70,239,0.75)]',
      card: 'hover:border-fuchsia-300/70 hover:shadow-[0_0_38px_rgba(217,70,239,0.18)]',
      haze: 'bg-fuchsia-500/12 group-hover:bg-fuchsia-400/30',
      icon: 'text-fuchsia-300 border-fuchsia-400/35 group-hover:bg-fuchsia-500 group-hover:text-white group-hover:border-fuchsia-200',
      pill: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/35',
      price: 'text-fuchsia-300 group-hover:text-fuchsia-100',
    },
  };
  const filteredServices = useMemo(() => (services || []).filter(s => s.category === effectiveActiveCategory), [services, effectiveActiveCategory]);

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-12 h-full animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 text-white">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Menú de servicios</h3>
          <p className="mobile-simplify-subtitle text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Gestión Maestra de Catálogo</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setIsCatalogOpen(true)} className="w-full sm:w-auto border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 px-6 py-4 rounded-[2rem] font-black text-[10px] uppercase italic flex items-center justify-center gap-2 transition-all hover:bg-cyan-400/20"><Settings size={16} /> Catálogos</button>
          {onManageInventory && <button onClick={onManageInventory} className="w-full sm:w-auto border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-6 py-4 rounded-[2rem] font-black text-[10px] uppercase italic flex items-center justify-center gap-2 transition-all hover:bg-emerald-400/20"><Package size={16} /> Inventario</button>}
          <button onClick={() => onAdd(effectiveActiveCategory)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 md:px-10 py-4 md:py-5 rounded-[2rem] font-black text-[10px] md:text-xs uppercase italic shadow-2xl shadow-indigo-600/40 flex items-center justify-center gap-3 transition-all active:scale-95 group text-white"><Plus size={20} className="group-hover:rotate-90 transition-transform" /> {effectiveActiveCategory === 'Promocion' ? 'Nueva Promoción' : effectiveActiveCategory === 'Producto' ? 'Nuevo en inventario' : 'Nuevo Servicio'}</button>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2.5 p-3 bg-black/80 border border-slate-800 rounded-[2.5rem] text-white shadow-[inset_0_0_24px_rgba(15,23,42,0.85)] sm:flex sm:flex-wrap sm:items-center sm:w-fit">
        {visibleCategories.map((cat) => {
          const theme = categoryThemes[cat] || categoryThemes.Cortes;
          const isActive = effectiveActiveCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`group relative overflow-hidden px-4 md:px-7 py-3.5 rounded-[2rem] border font-black uppercase italic text-[10px] tracking-widest transition-all active:scale-95 ${isActive ? `${theme.active} -translate-y-0.5` : theme.idle}`}
            >
              <span className={`absolute inset-x-4 top-0 h-px opacity-70 ${theme.dot}`} />
              <span className="relative flex items-center justify-center gap-2">
                <span className={`h-2 w-2 rounded-full transition-all ${theme.dot} ${isActive ? 'scale-125' : 'opacity-60 group-hover:opacity-100'}`} />
                <span className="hidden sm:inline-flex">{getIcon(cat, 13)}</span>
                {CATEGORY_LABELS[cat] || cat}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
        {filteredServices.map((s) => {
          const theme = categoryThemes[s.category] || categoryThemes.Cortes;
          return (
          <div key={s.id} onClick={() => onEdit(s)} className={`group bg-slate-900/90 border border-slate-800 rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 transition-all duration-300 cursor-pointer relative shadow-2xl overflow-hidden flex flex-col justify-between min-h-[260px] md:min-h-[320px] text-white hover:-translate-y-1 ${theme.card}`}>
            <div className={`absolute -right-8 -top-8 w-36 h-36 rounded-full blur-3xl transition-all duration-500 ${theme.haze}`}></div>
            <div className={`absolute left-8 right-8 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${theme.dot}`}></div>
            <button onClick={(e) => { e.stopPropagation(); if (s.category === 'Producto' && s.inventoryItemId) { onDeleteProduct?.(s.inventoryItemId); } else { onDelete(s.id); } }} className="absolute top-5 md:top-8 right-5 md:right-8 text-slate-600 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10 text-white"><Trash2 size={18}/></button>
            <div className="relative text-white">
              <div className={`w-14 h-14 md:w-16 md:h-16 bg-black rounded-2xl flex items-center justify-center mb-6 md:mb-8 border shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${theme.icon}`}>{getIcon(s.category)}</div>
              <h4 className="text-xl md:text-2xl font-black uppercase italic leading-tight tracking-tighter transition-colors text-white">{s.name}</h4>
              <span className={`inline-block mt-4 text-[9px] font-black px-5 py-2 rounded-full uppercase border tracking-widest italic leading-none ${theme.pill}`}>{CATEGORY_LABELS[s.category] || s.category}</span>
              {s.category === 'Promocion' && (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      {'Promoción general'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300">
                      {formatPromotionValue(s)}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Aplicación manual al momento de cobrar
                  </p>
                </div>
              )}
            </div>
            <div className="pt-6 md:pt-8 border-t border-slate-800 group-hover:border-cyan-300/20 mt-6 md:mt-8 flex justify-between items-center text-white">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase italic mb-1 leading-none">{s.category === 'Promocion' ? 'Descuento' : 'Precio Final'}</p>
                <p className={`text-3xl md:text-4xl font-black italic tracking-tighter transition-all leading-none ${theme.price}`}>{s.category === 'Promocion' ? formatPromotionValue(s) : `C$ ${s.price}`}</p>
              </div>
              <div className={`p-3 bg-black border rounded-2xl text-slate-500 transition-all group-hover:translate-x-1 ${theme.icon}`}><ChevronRight size={20} /></div>
            </div>
          </div>
          );
        })}
        <div onClick={() => onAdd(effectiveActiveCategory)} className={`relative overflow-hidden border-4 border-dashed rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer group min-h-[260px] md:min-h-[320px] text-white hover:-translate-y-1 ${categoryThemes[effectiveActiveCategory]?.idle || categoryThemes.Cortes.idle}`}><div className={`absolute inset-8 rounded-[2rem] opacity-15 blur-2xl transition-all group-hover:opacity-30 ${categoryThemes[effectiveActiveCategory]?.dot || categoryThemes.Cortes.dot}`} /><div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-current flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-90 transition-all"><Plus size={28} /></div><p className="relative font-black uppercase italic text-[10px] md:text-xs tracking-widest leading-none text-center">{effectiveActiveCategory === 'Promocion' ? 'Añadir promoción' : effectiveActiveCategory === 'Producto' ? 'Añadir en inventario' : `Añadir a ${CATEGORY_LABELS[effectiveActiveCategory] || effectiveActiveCategory}`}</p></div>
      </div>
      {isCatalogOpen && (
        <CatalogSettingsModal
          title="Catálogos de servicios"
          subtitle="Configura las categorías operativas de la barbería."
          values={visibleCategories}
          protectedValues={PROTECTED_SERVICE_CATEGORIES}
          onSave={async (values) => {
            await onSaveCatalog?.(values);
            setIsCatalogOpen(false);
          }}
          onClose={() => setIsCatalogOpen(false)}
        />
      )}
    </div>
  );
}

function InventoryView({ inventoryItems = [], productCategories = INVENTORY_PRODUCT_CATEGORIES, onSaveCatalog, onGoToProducts, onSaveProduct, onDeleteProduct }) {
  const emptyForm = {
    productName: '',
    productCategory: 'Reventa',
    usageType: 'retail',
    currentStock: '',
    minStock: '',
    maxStock: '',
    costPrice: '',
    presentationCost: '',
    salePrice: '',
    unitName: 'unidad',
    presentationName: 'unidad',
    unitsPerPresentation: '1',
    stockPresentations: '',
    sku: '',
    notes: '',
  };
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleProductCategories = useMemo(() => Array.from(new Set(productCategories?.length ? productCategories : INVENTORY_PRODUCT_CATEGORIES)), [productCategories]);
  const usageOptions = [
    { value: 'retail', label: 'Reventa', helper: 'Se vende en caja' },
    { value: 'internal', label: 'Insumo', helper: 'Se usa en servicios' },
    { value: 'both', label: 'Ambos', helper: 'Se vende y se usa' },
  ];
  const inventoryUnitOptions = [
    'unidad',
    'ml',
    'litro',
    'gr',
    'kg',
    'pieza',
    'par',
    'servicio',
  ];
  const inventoryPresentationOptions = [
    'unidad',
    'caja',
    'paquete',
    'bolsa',
    'frasco',
    'botella',
    'galon',
    'rollo',
    'display',
  ];
  const formatCatalogOption = (value) => String(value || '').replace(/_/g, ' ').toUpperCase();
  const activeItems = useMemo(
    () => (inventoryItems || []).filter((item) => item.isActive !== false),
    [inventoryItems],
  );
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeItems;
    return activeItems.filter((item) => [
      item.productName,
      item.name,
      item.productCategory,
      item.sku,
      item.usageType,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [activeItems, search]);
  const stockProducts = activeItems.filter((item) => item.trackStock !== false);
  const sellableProducts = activeItems.filter((item) => ['retail', 'both'].includes(item.usageType || 'retail'));
  const internalProducts = activeItems.filter((item) => ['internal', 'both'].includes(item.usageType || 'retail'));
  const totalStockUnits = activeItems.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
  const inventoryCostValue = activeItems.reduce(
    (sum, item) => sum + (Number(item.currentStock || 0) * Number(item.costPrice || 0)),
    0,
  );
  const inventoryCards = [
    {
      id: 'products',
      label: 'Productos',
      value: activeItems.length,
      helper: `${sellableProducts.length} para venta directa`,
      icon: Package,
      tone: 'text-cyan-300',
      bg: 'bg-slate-950',
      border: 'border-cyan-400/30',
    },
    {
      id: 'stock',
      label: 'Stock controlado',
      value: stockProducts.length,
      helper: `${totalStockUnits.toLocaleString('es-NI')} unidades registradas`,
      icon: Layers,
      tone: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/30',
    },
    {
      id: 'cost',
      label: 'Costo inventario',
      value: `C$ ${inventoryCostValue.toLocaleString('es-NI')}`,
      helper: `${internalProducts.length} insumos para servicios`,
      icon: Repeat,
      tone: 'text-slate-400',
      bg: 'bg-slate-950',
      border: 'border-slate-800',
    },
  ];

  const openNewProduct = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setIsProductModalOpen(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setForm({
      ...emptyForm,
      ...product,
      productName: product.productName || product.name || '',
      currentStock: product.currentStock ?? '',
      minStock: product.minStock ?? '',
      maxStock: product.maxStock ?? '',
      costPrice: product.costPrice ?? '',
      presentationCost: Number(product.costPrice || 0) * Number(product.unitsPerPresentation || 1),
      salePrice: product.salePrice ?? product.price ?? '',
      productCategory: product.productCategory || 'Reventa',
      usageType: product.usageType || 'retail',
      unitName: product.unitName || 'unidad',
      presentationName: product.presentationName || 'unidad',
      unitsPerPresentation: product.unitsPerPresentation ?? 1,
      stockPresentations: Number(product.unitsPerPresentation || 1) > 0 ? Number(product.currentStock || 0) / Number(product.unitsPerPresentation || 1) : product.currentStock ?? '',
      sku: product.sku || '',
      notes: product.notes || '',
    });
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const updateForm = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value };
    if (field === 'stockPresentations' || field === 'unitsPerPresentation') {
      const presentations = Number(field === 'stockPresentations' ? value : next.stockPresentations || 0);
      const unitsPerPresentation = Math.max(1, Number(field === 'unitsPerPresentation' ? value : next.unitsPerPresentation || 1));
      next.currentStock = presentations > 0 ? String(presentations * unitsPerPresentation) : next.currentStock;
      if (Number(next.presentationCost || 0) > 0) next.costPrice = String(Number(next.presentationCost || 0) / unitsPerPresentation);
    }
    if (field === 'presentationCost') {
      const unitsPerPresentation = Math.max(1, Number(next.unitsPerPresentation || 1));
      next.costPrice = Number(value || 0) > 0 ? String(Number(value || 0) / unitsPerPresentation) : next.costPrice;
    }
    return next;
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onSaveProduct?.({
      ...editingProduct,
      ...form,
      productName: form.productName,
      name: form.productName,
    });
    closeProductModal();
  };

  const getUsageLabel = (usageType) => usageOptions.find((option) => option.value === usageType)?.label || 'Reventa';
  const getMargin = (item) => Number(item.salePrice || 0) - Number(item.costPrice || 0);

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 h-full animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Inventario</h3>
          <p className="text-[10px] text-cyan-300 font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Productos, stock, costo y rentabilidad</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setIsCatalogModalOpen(true)}
            className="w-full sm:w-auto border border-slate-700 bg-slate-900 text-slate-300 px-7 py-4 rounded-[1.4rem] font-black text-[10px] uppercase italic tracking-[0.16em] flex items-center justify-center gap-3 transition-all hover:bg-slate-800"
          >
            <Settings size={18} />
            Catálogos
          </button>
          <button
            type="button"
            onClick={openNewProduct}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-7 py-4 rounded-[1.4rem] font-black text-[10px] uppercase italic tracking-[0.16em] shadow-[0_14px_30px_rgba(99,102,241,0.28)] flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nuevo producto
          </button>
          <button
            type="button"
            onClick={onGoToProducts}
            className="w-full sm:w-auto border border-slate-700 bg-slate-900 text-slate-300 px-7 py-4 rounded-[1.4rem] font-black text-[10px] uppercase italic tracking-[0.16em] flex items-center justify-center gap-3 transition-all hover:bg-slate-800"
          >
            <Package size={18} />
            Ver venta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {inventoryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`rounded-[1.7rem] border ${card.border} ${card.bg} p-6 shadow-[0_18px_44px_rgba(34,211,238,0.12)]`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                  <p className={`mt-4 text-3xl font-black italic tracking-tighter leading-none ${card.tone}`}>{card.value}</p>
                  <p className="mt-3 text-[11px] font-bold text-slate-400">{card.helper}</p>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${card.border} bg-slate-900 ${card.tone}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <section className="rounded-[2rem] border border-cyan-400/25 bg-slate-950 overflow-hidden shadow-[0_18px_44px_rgba(34,211,238,0.12)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 md:px-7 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Catálogo maestro</p>
              <h4 className="mt-1 text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white">Productos de inventario</h4>
            </div>
            <div className="relative w-full md:w-[320px]">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 pr-11 text-xs font-black text-white outline-none" placeholder="Buscar producto..." />
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[minmax(220px,1fr)_120px_130px_130px_110px_120px_120px_120px] gap-4 px-6 py-4 border-b border-slate-800 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Producto</span>
                  <span>Uso</span>
                  <span>Categoria</span>
                  <span>Presentacion</span>
                  <span>Stock</span>
                  <span>Costo</span>
                  <span>Venta</span>
                  <span>Acción</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {filteredItems.map((item) => {
                    const margin = getMargin(item);
                    const isLowStock = Number(item.minStock || 0) > 0 && Number(item.currentStock || 0) <= Number(item.minStock || 0);
                    return (
                      <div key={item.id} className="grid grid-cols-[minmax(220px,1fr)_120px_130px_130px_110px_120px_120px_120px] gap-4 px-6 py-4 items-center">
                        <div>
                          <p className="truncate whitespace-nowrap text-sm font-black uppercase italic text-white">{item.productName || item.name}</p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{item.sku || 'Sin SKU'} �- Margen C$ {margin.toLocaleString('es-NI')}</p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-black uppercase ${
                          item.usageType === 'internal'
                            ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                            : item.usageType === 'both'
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}>{getUsageLabel(item.usageType)}</span>
                        <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-300">{item.productCategory || 'Otros'}</span>
                        <span className="text-[10px] font-black uppercase text-slate-300">{item.presentationName || 'unidad'} x {Number(item.unitsPerPresentation || 1).toLocaleString('es-NI')}</span>
                        <span className={`text-base font-black italic ${isLowStock ? 'text-cyan-300' : 'text-emerald-300'}`}>{Number(item.currentStock || 0).toLocaleString('es-NI')}</span>
                        <p className="text-sm font-black italic text-slate-400">C$ {Number(item.costPrice || 0).toLocaleString('es-NI')}</p>
                        <p className="text-sm font-black italic text-emerald-300">C$ {Number(item.salePrice || 0).toLocaleString('es-NI')}</p>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEditProduct(item)} className="rounded-xl border border-cyan-400/30 px-3 py-2 text-[9px] font-black uppercase text-cyan-300 hover:bg-slate-800">
                            Editar
                          </button>
                          <button type="button" onClick={() => onDeleteProduct?.(item.id)} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-400 hover:bg-slate-800" aria-label="Desactivar producto">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <Package size={36} className="mx-auto mb-4 text-cyan-300" />
              <p className="text-sm font-black uppercase italic text-white">No hay productos de inventario</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Crea productos con stock, costo y precio para activar la venta e iniciar rentabilidad</p>
            </div>
          )}
        </section>
      </section>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[1.8rem] border border-cyan-400/30 bg-slate-950 shadow-[0_28px_80px_rgba(0,0,0,0.55)] custom-scrollbar">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-5 md:px-7 py-5 backdrop-blur">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Producto</p>
                <h4 className="mt-1 text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white">{editingProduct ? 'Editar inventario' : 'Nuevo producto'}</h4>
              </div>
              <button type="button" onClick={closeProductModal} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:bg-slate-800" aria-label="Cerrar producto">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-5 p-5 md:p-7">
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Nombre</span>
                  <input value={form.productName} onChange={(event) => updateForm('productName', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300" placeholder="Ej. Shampoo hidratante" />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Categoria</span>
                    <select value={form.productCategory} onChange={(event) => updateForm('productCategory', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-black uppercase text-white outline-none">
                      {visibleProductCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Como se mide</span>
                    <select value={form.unitName} onChange={(event) => updateForm('unitName', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-black uppercase text-white outline-none">
                      {inventoryUnitOptions.map((option) => <option key={option} value={option}>{formatCatalogOption(option)}</option>)}
                    </select>
                  </label>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Presentacion</span>
                    <select value={form.presentationName} onChange={(event) => updateForm('presentationName', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-black uppercase text-white outline-none">
                      {inventoryPresentationOptions.map((option) => <option key={option} value={option}>{formatCatalogOption(option)}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Contiene</span>
                    <input type="number" min="1" step="0.01" value={form.unitsPerPresentation} onChange={(event) => updateForm('unitsPerPresentation', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-black text-white outline-none" placeholder="100" />
                    <span className="block text-[8px] font-bold uppercase text-slate-500">{form.unitName || 'unidad'} por {form.presentationName || 'presentacion'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {usageOptions.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updateForm('usageType', option.value)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${form.usageType === option.value ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                    >
                      <span className="block text-[10px] font-black uppercase">{option.label}</span>
                      <span className="mt-1 block text-[8px] font-bold uppercase leading-tight opacity-80">{option.helper}</span>
                    </button>
                  ))}
                </div>

                <label className="block space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Notas de costo o uso</span>
                  <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="min-h-[96px] w-full resize-none rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-bold text-white outline-none" placeholder="Ej. Se usa para keratina, rinde 10 servicios..." />
                </label>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                <div className="grid grid-cols-1 gap-3">
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Stock en presentaciones</span>
                    <input type="number" min="0" step="0.01" value={form.stockPresentations} onChange={(event) => updateForm('stockPresentations', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none" placeholder="Ej. 1 caja" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Stock medido</span>
                      <input type="number" min="0" step="0.01" value={form.currentStock} onChange={(event) => updateForm('currentStock', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none" placeholder="0" />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Minimo</span>
                      <input type="number" min="0" value={form.minStock} onChange={(event) => updateForm('minStock', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none" placeholder="0" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Costo presentacion</span>
                    <input type="number" min="0" step="0.01" value={form.presentationCost} onChange={(event) => updateForm('presentationCost', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none" placeholder="C$ 0" />
                    <span className="block text-[8px] font-bold uppercase text-slate-500">Costo unitario: C$ {Number(form.costPrice || 0).toLocaleString('es-NI')}</span>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Precio venta</span>
                    <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => updateForm('salePrice', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-sm font-black text-white outline-none" placeholder="C$ 0" />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">SKU / codigo interno</span>
                  <input value={form.sku} onChange={(event) => updateForm('sku', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-black px-4 py-3 text-xs font-black text-white outline-none" placeholder="Opcional" />
                </label>

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Presentacion</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-slate-300">{form.presentationName || 'unidad'} x {Number(form.unitsPerPresentation || 1).toLocaleString('es-NI')} {form.unitName || 'unidad'}</p>
                  <p className="mt-4 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Margen estimado</p>
                  <p className="mt-2 text-2xl font-black italic text-emerald-300">
                    C$ {(Number(form.salePrice || 0) - Number(form.costPrice || 0)).toLocaleString('es-NI')}
                  </p>
                </div>

                <button type="submit" className="w-full rounded-2xl bg-emerald-400 px-5 py-4 text-[11px] font-black uppercase italic tracking-[0.16em] text-slate-950 shadow-[0_14px_30px_rgba(16,185,129,0.24)] hover:bg-emerald-300">
                  {editingProduct ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {isCatalogModalOpen && (
        <CatalogSettingsModal
          title="Clasificaciones de productos"
          subtitle="Define las categorías del inventario. Estas opciones alimentan productos, insumos y filtros."
          values={visibleProductCategories}
          onClose={() => setIsCatalogModalOpen(false)}
          onSave={(values) => {
            onSaveCatalog?.(values);
            setIsCatalogModalOpen(false);
          }}
        />
      )}
    </div>
  );
}


function BarbersView({ barbers, appointments, branches, currentBarbershopId, currentBranchId, canChooseBranch, onSave, onDelete, onGoToNomina, onCashWithdrawal }) {
  const { notify } = useUiFeedback();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: BARBER_THEME_PALETTE[0].color, bg: BARBER_THEME_PALETTE[0].bg, branchId: currentBranchId || '' });
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [compensationIndicator, setCompensationIndicator] = useState('salary');
  const branchNameById = useMemo(
    () => new Map((branches || []).map((branch) => [String(branch.id), branch.name])),
    [branches],
  );
  const branchesForCurrentBarbershop = useMemo(
    () => {
      const allBranches = branches || [];
      if (!currentBarbershopId) return allBranches;
      const scopedBranches = allBranches.filter((branch) => String(branch.barbershopId || '') === String(currentBarbershopId || ''));
      return scopedBranches.length ? scopedBranches : allBranches;
    },
    [branches, currentBarbershopId],
  );
  const defaultBranchId = useMemo(() => {
    if (!branchesForCurrentBarbershop.length) return '';
    const currentBranchStillExists = branchesForCurrentBarbershop.some(
      (branch) => String(branch.id) === String(currentBranchId || ''),
    );
    if (currentBranchStillExists) return String(currentBranchId || '');
    return String(branchesForCurrentBarbershop[0].id || '');
  }, [branchesForCurrentBarbershop, currentBranchId]);
  const pendingEarningsByBarber = useMemo(() => {
    const totalsByBarber = new Map();

    (appointments || []).forEach((appointment) => {
      if (appointment.status !== 'Finalizada' || appointment.isPaid) return;
      const barberId = String(appointment.barberId || '');
      if (!barberId) return;
      totalsByBarber.set(barberId, (totalsByBarber.get(barberId) || 0) + (Number(appointment.price) || 0));
    });

    return totalsByBarber;
  }, [appointments]);

  const getBarberEarnings = (barber) => {
    if (!barberHasCommissionPay(barber.paymentMode)) return 0;
    const totalSales = pendingEarningsByBarber.get(String(barber.id)) || 0;
    return totalSales * (Number(barber.commission) / 100);
  };

  const formatSalary = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    if (!onlyDigits) return '';
    return Number(onlyDigits).toLocaleString('es-ES');
  };

  const formatCommission = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return onlyDigits;
  };

  const parseSalary = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return Number(onlyDigits) || 0;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: BARBER_THEME_PALETTE[0].color, bg: BARBER_THEME_PALETTE[0].bg, branchId: defaultBranchId });
    setIsModalOpen(true);
  };

  const openEdit = (barber) => {
    setEditing(barber.id);
    setForm({
      name: barber.name || '',
      fullName: barber.fullName || barber.name || '',
      cedula: formatCedulaNumber(barber.cedula || ''),
      salary: formatSalary(barberHasBasePay(barber.paymentMode) ? barber.salary : ''),
      phone: barber.phone || '',
      paymentMode: barber.paymentMode || 'salario',
      paymentFrequency: barber.paymentFrequency || 'Quincenal',
      commission: barberHasCommissionPay(barber.paymentMode) ? String(barber.commission || '') : '',
      level: barber.level || 'Junior',
      color: barber.color || BARBER_THEME_PALETTE[0].color,
      bg: barber.bg || BARBER_THEME_PALETTE[0].bg,
      branchId: barber.branchId || defaultBranchId,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      notify('Nombre comercial requerido', 'warning');
      return;
    }
    if (!form.fullName.trim()) {
      notify('Nombre completo requerido', 'warning');
      return;
    }
    if (!branchesForCurrentBarbershop.length) {
      notify('Primero debes crear al menos una sucursal para registrar barberos.', 'warning');
      return;
    }
    if (!String(form.branchId || '').trim()) {
      notify('Debes seleccionar una sucursal para el barbero.', 'warning');
      return;
    }
    if (getPhoneDigits(form.phone).length > 0 && !isValidPhoneNumber(form.phone)) {
      notify('El teléfono móvil debe tener exactamente 8 dígitos.', 'warning');
      return;
    }
    if (barberHasBasePay(form.paymentMode) && parseSalary(form.salary) <= 0) {
      notify('Debes ingresar un salario base válido para esta modalidad.', 'warning');
      return;
    }
    if (barberHasCommissionPay(form.paymentMode)) {
      const commissionRate = parseSalary(form.commission);
      if (commissionRate <= 0) {
        notify('Debes ingresar un porcentaje de comisión válido para esta modalidad.', 'warning');
        return;
      }
      if (commissionRate > 100) {
        notify('La comisión no puede ser mayor al 100%.', 'warning');
        return;
      }
    }
    const savedBarber = {
      id: editing,
      ...form,
      fullName: form.fullName.trim(),
      cedula: formatCedulaNumber(form.cedula),
      phone: formatPhoneNumber(form.phone),
      paymentMode: form.paymentMode,
      paymentFrequency: form.paymentFrequency,
      salary: barberHasBasePay(form.paymentMode) ? parseSalary(form.salary) : 0,
      commission: barberHasCommissionPay(form.paymentMode) ? parseSalary(form.commission) : 0,
      level: form.level || 'Junior',
      branchId: form.branchId,
      barbershopId: currentBarbershopId || null,
    };
    await onSave(savedBarber);
    closeModal();
  };

  const filteredBarbers = barbers.filter((b) => {
    const query = search.toLowerCase();
    return b.name.toLowerCase().includes(query) || (b.fullName || '').toLowerCase().includes(query) || (b.cedula || '').toLowerCase().includes(query) || (b.phone || '').includes(query);
  });

  const staffMetrics = useMemo(() => {
    const roster = barbers || [];
    const salariedBarbers = roster.filter(
      (barber) => barberHasBasePay(barber.paymentMode) && Number(barber.salary || 0) > 0
    );
    const avgSalary = salariedBarbers.length
      ? salariedBarbers.reduce((sum, barber) => sum + (Number(barber.salary) || 0), 0) / salariedBarbers.length
      : 0;
    const commissionBarbers = roster.filter((barber) => barberHasCommissionPay(barber.paymentMode));
    const avgCommission = commissionBarbers.length
      ? commissionBarbers.reduce((sum, barber) => {
          const totalSales = pendingEarningsByBarber.get(String(barber.id)) || 0;
          return sum + (totalSales * (Number(barber.commission) / 100));
        }, 0) / commissionBarbers.length
      : 0;

    const today = parseLocalDate(getTodayString()) || new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthlyFinishedAppointments = (appointments || []).filter((appointment) => {
      if (appointment.status !== 'Finalizada') return false;
      const appointmentDate = parseLocalDate(appointment.date);
      if (!appointmentDate) return false;
      return appointmentDate.getFullYear() === currentYear && appointmentDate.getMonth() === currentMonth;
    });

    const servicesByBarber = monthlyFinishedAppointments.reduce((map, appointment) => {
      const barberId = String(appointment.barberId || '');
      if (!barberId) return map;
      map.set(barberId, (map.get(barberId) || 0) + 1);
      return map;
    }, new Map());

    const activeBarbers = roster.filter(
      (barber) => (servicesByBarber.get(String(barber.id)) || 0) > 0
    ).length;
    const coverage = roster.length ? activeBarbers / roster.length : 0;

    let performanceLabel = 'Sin datos';
    let performanceTone = 'text-slate-300';

    if (monthlyFinishedAppointments.length > 0) {
      if (coverage >= 0.8) {
        performanceLabel = 'Alta';
        performanceTone = 'text-emerald-300';
      } else if (coverage >= 0.5) {
        performanceLabel = 'Media';
        performanceTone = 'text-amber-300';
      } else {
        performanceLabel = 'Baja';
        performanceTone = 'text-rose-300';
      }
    }

    return {
      total: roster.length,
      avgSalary,
      avgCommission,
      salariedCount: salariedBarbers.length,
      commissionCount: commissionBarbers.length,
      performanceLabel,
      performanceTone,
      avgSalaryCaption: salariedBarbers.length
        ? `Solo ${salariedBarbers.length} con salario fijo`
        : 'No hay staff con salario fijo',
      avgCommissionCaption: commissionBarbers.length
        ? `Promedio pendiente para ${commissionBarbers.length} por comisión`
        : 'No hay staff por comisión',
      performanceCaption: monthlyFinishedAppointments.length
        ? `${activeBarbers} de ${roster.length || 0} barberos con servicios finalizados este mes`
        : 'Sin servicios finalizados este mes',
    };
  }, [barbers, appointments, pendingEarningsByBarber]);

  const compensationMetric = compensationIndicator === 'commission'
    ? {
        label: 'Promedio Comisiones',
        value: staffMetrics.commissionCount ? `C$ ${Math.round(staffMetrics.avgCommission).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgCommissionCaption,
        tone: 'text-cyan-300',
      }
    : {
        label: 'Promedio Salario Fijo',
        value: staffMetrics.salariedCount ? `C$ ${Math.round(staffMetrics.avgSalary).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgSalaryCaption,
        tone: 'text-emerald-300',
      };

  return (
    <div className="p-10 space-y-8 animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white">
        <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-white">Equipo de Barberos</h3>
          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1 italic leading-none">Administre el staff, salarios y liquidación de comisiones</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => onCashWithdrawal?.()}
            className="bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-200 border border-indigo-400/25 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
          >
            <Wallet size={16} /> Adelanto
          </button>
          <button 
            onClick={onGoToNomina}
            className="bg-[#6366f1] hover:bg-[#5356e3] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 transition-all flex items-center gap-2"
          >
            <Wallet size={16} /> Pagar Nómina
          </button>
          <button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all">Nuevo Barbero</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-indigo-500/40 transition-all text-white">
          <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">Total de Barberos</p>
          <p className="text-4xl font-black text-indigo-200">{staffMetrics.total}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-emerald-500/40 transition-all text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">{compensationMetric.label}</p>
            <div className="inline-flex rounded-2xl border border-cyan-300/15 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setCompensationIndicator('salary')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'salary' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                Salario
              </button>
              <button
                type="button"
                onClick={() => setCompensationIndicator('commission')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'commission' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                Comisión
              </button>
            </div>
          </div>
          <p className={`text-4xl font-black ${compensationMetric.tone}`}>
            {compensationMetric.value}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {compensationMetric.caption}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-amber-500/40 transition-all text-white">
          <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">Rendimiento Staff</p>
          <p className={`text-4xl font-black ${staffMetrics.performanceTone}`}>{staffMetrics.performanceLabel}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {staffMetrics.performanceCaption}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-white">
        <div className="flex justify-between items-center mb-5 text-white">
          <h4 className="text-lg font-black uppercase text-white">Registro de Barberos</h4>
          <div className="relative text-white w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula o teléfono" className="pl-10 pr-4 py-3 w-full rounded-xl bg-black border border-slate-800 text-sm text-white outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 text-white">
          {filteredBarbers.length === 0 && <p className="text-slate-400 col-span-full">No se encontraron barberos.</p>}
          {filteredBarbers.map((b) => {
             const earnings = getBarberEarnings(b);
             return (
              <div key={b.id} onClick={() => openEdit(b)} className={`bg-gradient-to-br from-slate-900 to-slate-800 border ${b.color || 'border-slate-700'} rounded-[2.5rem] p-6 shadow-lg hover:shadow-indigo-500/30 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between h-full text-white`}>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-700/10 via-transparent to-emerald-700/5 opacity-60 pointer-events-none z-0"></div>
                
                <div className="relative z-10 text-white">
                  <div className="flex items-center justify-between gap-2 mb-4 text-white">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black italic shadow-xl ${b.bg || 'bg-indigo-500'}`}>{b.avatar || b.name?.slice(0, 2).toUpperCase()}</div>
                  </div>
                  
                  <h5 className="text-xl font-black text-white uppercase tracking-tighter truncate mb-1">{b.name}</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em] truncate mb-3">{b.fullName || b.name}</p>
                  <div className="flex items-center gap-2 mb-4 text-white">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${b.color} text-white`}>{b.level || 'Junior'}</span>
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-black/40 text-slate-400 border border-white/5">{getBarberPaymentModeLabel(b.paymentMode, b.commission || 0)}</span>
                  </div>

                  <div className="space-y-3 py-4 border-y border-white/5 mb-4 text-white">
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sucursal</span>
                        <span className="text-[10px] font-black text-slate-300 italic">{branchNameById.get(String(b.branchId || '')) || 'Sucursal no asignada'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cédula</span>
                        <span className="text-[10px] font-black text-slate-300 italic">{b.cedula?.trim() || 'Sin registrar'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pago Base</span>
                          <span className="text-xs font-black text-white italic">{barberHasBasePay(b.paymentMode) ? `C$ ${Number(b.salary || 0).toLocaleString()}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Pendiente Pago</span>
                        <span className="text-xs font-black text-emerald-400 italic">C$ {earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 relative z-10 pt-2 text-white">
                  <button onClick={() => openEdit(b)} className="flex-1 bg-white/5 hover:bg-indigo-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 hover:border-indigo-400 transition-all text-white">Ver Perfil</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="px-4 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white py-3 rounded-xl border border-rose-500/20 transition-all"><Trash2 size={14}/></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300 text-white">
          <div className="w-full max-w-[70rem] max-h-[92vh] bg-slate-950 border border-cyan-300/15 rounded-[2.4rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 flex flex-col md:flex-row relative text-white">
            
            <button onClick={closeModal} className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20 text-white">
              <X size={20} />
            </button>

            <div className={`w-full md:w-[30%] p-7 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-white/5 to-transparent relative overflow-y-auto custom-scrollbar text-white`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${form.bg || 'bg-indigo-500'}`}></div>
              <div className="relative group mb-6 text-white mt-3">
                <div className={`absolute inset-0 ${form.bg || 'bg-indigo-500'} blur-2xl opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                <div className={`w-24 h-24 rounded-[2rem] ${form.bg || 'bg-indigo-500'} flex items-center justify-center text-white font-black text-3xl shadow-2xl relative z-10 border-4 border-cyan-300/15 animate-glow text-white`}>
                  {(form.name || 'NB').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
              </div>
              
              <h4 className="text-xl font-black text-white uppercase tracking-tighter text-center mb-1 leading-none">{form.name || 'Sin Nombre'}</h4>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-[0.16em] text-center mb-2">{form.fullName || 'Nombre legal pendiente'}</p>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.16em] mb-4 italic">Cédula: {form.cedula || 'Sin registrar'}</p>
              <div className="mb-4 px-4 py-3 w-full rounded-2xl border border-white/5 bg-white/5 text-white">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic leading-none">Sucursal actual</p>
                <p className="mt-2 text-sm font-black text-white italic">{branchNameById.get(String(form.branchId || '')) || 'Sucursal obligatoria'}</p>
              </div>
              
              <div className="w-full space-y-3 text-white">
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3 text-white/40"><Briefcase size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Modo</span></div>
                  <span className="text-[11px] font-black uppercase text-indigo-400 italic leading-none">{getBarberPaymentModeLabel(form.paymentMode, form.commission || 0)}</span>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-2"><Repeat size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Frecuencia de Pago</span></div>
                  <div className="grid grid-cols-2 gap-2 text-white">
                    {['Diario', 'Semanal', 'Quincenal', 'Mensual'].map(freq => (
                      <button key={freq} onClick={() => setForm({...form, paymentFrequency: freq})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.paymentFrequency === freq ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-2"><Award size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Nivel de Rango</span></div>
                  <div className="grid grid-cols-3 gap-2 text-white">
                    {['Junior', 'Medium', 'Senior'].map(lvl => (
                      <button key={lvl} onClick={() => setForm({...form, level: lvl})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.level === lvl ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-7 overflow-y-auto custom-scrollbar flex flex-col text-white">
              <div className="flex items-center gap-4 mb-6 text-white">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><IdCard size={20}/></div>
                <div>
                  <h3 className="text-xl font-black uppercase italic text-white tracking-tighter leading-none">{editing ? 'Editar Perfil' : 'Alta de Personal'}</h3>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1 leading-none">Información de nómina y contacto</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-white">
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Comercial <span className="text-rose-400">*</span></label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Juan Pérez" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Completo <span className="text-rose-400">*</span></label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ej. Juan Carlos Pérez López" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Teléfono móvil</label>
                  <div className="relative group text-white">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })} placeholder="Ej. 8899-4455" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Cédula</label>
                  <div className="relative group text-white">
                    <IdCard className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: formatCedulaNumber(e.target.value) })} placeholder="Ej. 001-000000-0000A" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Modalidad de Pago <span className="text-rose-400">*</span></label>
                  <div className="relative group text-white">
                    <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" size={16}/>
                    <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value, salary: barberHasBasePay(e.target.value) ? form.salary : '', commission: barberHasCommissionPay(e.target.value) ? form.commission : '' })} className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all appearance-none cursor-pointer text-white">
                        {BARBER_PAYMENT_MODE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id} className="bg-slate-950 text-white">{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {barberHasBasePay(form.paymentMode) && (
                  <div className="space-y-2 text-white">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Sueldo base (C$) <span className="text-rose-400">*</span></label>
                    <div className="relative group text-white">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-sm leading-none">C$</div>
                      <input value={form.salary} onChange={(e) => setForm({ ...form, salary: formatSalary(e.target.value) })} placeholder="0,000" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all" />
                    </div>
                  </div>
                  )}
                  {barberHasCommissionPay(form.paymentMode) && (
                  <div className="space-y-2 text-white">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Comisión (%) <span className="text-rose-400">*</span></label>
                    <div className="relative group text-white">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-sm leading-none">%</div>
                      <input value={form.commission} onChange={(e) => setForm({ ...form, commission: formatCommission(e.target.value) })} placeholder="15" className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all" />
                    </div>
                  </div>
                  )}
                {canChooseBranch && (
                  <div className="space-y-2 text-white md:col-span-2">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Sucursal de trabajo <span className="text-rose-400">*</span></label>
                    <div className="relative group text-white">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16} />
                      <select
                        value={form.branchId || ''}
                        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                        disabled={!branchesForCurrentBarbershop.length}
                        className="w-full bg-black border border-cyan-300/15 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all disabled:opacity-60 appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-slate-950 text-white">
                          {branchesForCurrentBarbershop.length ? 'Selecciona una sucursal' : 'Sin sucursales disponibles'}
                        </option>
                        {branchesForCurrentBarbershop.map((branch) => (
                          <option key={branch.id} value={branch.id} className="bg-slate-950 text-white">
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6 text-white">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] ml-2 block mb-4 italic leading-none">Color de Identificación Visual</label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3 text-white">
                  {BARBER_THEME_PALETTE.map((theme) => {
                    const isUsed = barbers.some(b => b.color === theme.color && String(b.id) !== String(editing));
                    return (
                      <button key={theme.id} disabled={isUsed} onClick={() => setForm({ ...form, color: theme.color, bg: theme.bg })} className={`h-10 rounded-xl transition-all relative overflow-hidden flex items-center justify-center border-2 ${theme.bg} ${isUsed ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:scale-110 active:scale-95'} ${form.color === theme.color ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-black/50'}`}>
                        {form.color === theme.color && <Check size={14} className="text-white drop-shadow-md" />}
                        {isUsed && <X size={10} className="text-black/50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-5 border-t border-white/5 text-white">
                <button onClick={() => void submit()} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest italic shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={16}/> {editing ? 'Actualizar Perfil' : 'Dar de Alta'}
                </button>
                <button onClick={closeModal} className="px-8 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest italic transition-all flex items-center justify-center gap-3 border border-white/5">
                  <X size={16}/> Cancelar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function NominaView({ barbers, appointments, cashWithdrawals = [], payrollSettlements = [], onClose, onPagar, onOpenHistory, onLiquidarTodo }) {
  const payrollRows = useMemo(() => {
    return barbers.map((barber) => {
      const baseNomina = getBarberNominaData(barber, appointments);
      const pendingWithdrawals = (cashWithdrawals || []).filter((withdrawal) => (
        String(withdrawal.barberId) === String(barber.id) && !withdrawal.settledAt
      ));
      const withdrawalsTotal = pendingWithdrawals.reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0);

      return {
        barber,
        nomina: {
          ...baseNomina,
          grossTotal: baseNomina.total,
          withdrawals: pendingWithdrawals,
          withdrawalsTotal,
          total: Math.max(baseNomina.total - withdrawalsTotal, 0),
        },
      };
    });
  }, [barbers, appointments, cashWithdrawals]);

  const summary = useMemo(() => {
    return payrollRows.reduce((acc, row) => ({
      staffCount: acc.staffCount + 1,
      pendingServices: acc.pendingServices + row.nomina.pendingServices,
      base: acc.base + row.nomina.base,
      comission: acc.comission + row.nomina.comission,
      withdrawalsTotal: acc.withdrawalsTotal + row.nomina.withdrawalsTotal,
      total: acc.total + row.nomina.total,
    }), { staffCount: 0, pendingServices: 0, base: 0, comission: 0, withdrawalsTotal: 0, total: 0 });
  }, [payrollRows]);
  const settlementsByBarberId = useMemo(() => {
    const map = new Map();
    (payrollSettlements || []).forEach((settlement) => {
      const key = String(settlement.barberId || '');
      if (!key) return;
      map.set(key, [...(map.get(key) || []), settlement]);
    });
    map.forEach((items, key) => {
      map.set(key, items.sort((left, right) => new Date(right.paidAt || 0) - new Date(left.paidAt || 0)));
    });
    return map;
  }, [payrollSettlements]);
  const barberPaymentFiles = useMemo(() => (
    (barbers || []).map((barber) => {
      const settlements = settlementsByBarberId.get(String(barber.id)) || [];
      const totalPaid = settlements.reduce((sum, settlement) => sum + (Number(settlement.total) || 0), 0);
      const lastPayment = settlements[0] || null;
      return {
        barber,
        settlements,
        totalPaid,
        lastPayment,
      };
    })
  ), [barbers, settlementsByBarberId]);

  const indicatorCards = [
    {
      id: 'total',
      label: 'Total a Pagar',
      value: `C$ ${summary.total.toLocaleString()}`,
      helper: `Base C$ ${summary.base.toLocaleString()} + comisión C$ ${summary.comission.toLocaleString()} - adelantos C$ ${summary.withdrawalsTotal.toLocaleString()}`,
      icon: Wallet,
      shellClass: 'bg-gradient-to-br from-indigo-500/20 via-slate-900 to-slate-950 border-indigo-500/30 shadow-[0_0_35px_rgba(99,102,241,0.18)]',
      iconWrapClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/20',
      valueClass: 'text-white',
      badgeClass: 'text-indigo-300',
    },
    {
      id: 'staff',
      label: 'Staff Pendiente',
      value: `${summary.staffCount}`,
      helper: `${summary.staffCount === 1 ? '1 barbero con pago pendiente' : `${summary.staffCount} barberos listos para liquidar`}`,
      icon: Users,
      shellClass: 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700 shadow-[0_12px_35px_rgba(0,0,0,0.25)]',
      iconWrapClass: 'bg-white/5 text-slate-200 border-cyan-300/15',
      valueClass: 'text-white',
      badgeClass: 'text-slate-300',
    },
    {
      id: 'withdrawals',
      label: 'Adelantos Pendientes',
      value: `C$ ${summary.withdrawalsTotal.toLocaleString()}`,
      helper: summary.withdrawalsTotal > 0 ? 'Dinero tomado por barberos pendiente de descuento' : 'Sin adelantos por descontar',
      icon: Wallet,
      shellClass: 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border-amber-500/20 shadow-[0_0_35px_rgba(245,158,11,0.14)]',
      iconWrapClass: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
      valueClass: summary.withdrawalsTotal > 0 ? 'text-amber-300' : 'text-white',
      badgeClass: summary.withdrawalsTotal > 0 ? 'text-amber-300' : 'text-slate-300',
    },
    {
      id: 'services',
      label: 'Servicios Pendientes',
      value: `${summary.pendingServices}`,
      helper: summary.pendingServices > 0 ? 'Citas finalizadas aún no liquidadas' : 'Todo el corte pendiente ya está bajo control',
      icon: Scissors,
      shellClass: 'bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 border-emerald-500/20 shadow-[0_0_35px_rgba(16,185,129,0.14)]',
      iconWrapClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
      valueClass: summary.pendingServices > 0 ? 'text-emerald-300' : 'text-white',
      badgeClass: summary.pendingServices > 0 ? 'text-emerald-300' : 'text-slate-300',
    },
  ];

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in text-white no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-3 md:p-4 bg-slate-900 rounded-2xl text-white hover:bg-indigo-600 transition-all border border-slate-800"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-white">Liquidación de Nómina</h3>
            <p className="text-[#4ade80] text-[10px] font-black uppercase tracking-widest mt-1 italic leading-none">Procesar pagos pendientes del staff</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-2xl flex items-center gap-4 self-start md:self-auto">
          <CalendarIcon size={20} className="text-[#6366f1]" />
          <div className="text-right">
            <p className="text-[9px] text-slate-500 font-black uppercase leading-none mb-1">Periodo Actual</p>
            <p className="text-xs font-black text-white italic">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {indicatorCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`relative overflow-hidden rounded-[2.6rem] border p-7 md:p-8 ${card.shellClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%)] pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] font-black uppercase italic tracking-[0.24em] leading-none ${card.badgeClass}`}>{card.label}</p>
                  <h4 className={`mt-5 text-4xl md:text-5xl font-black italic tracking-tighter leading-none ${card.valueClass}`}>{card.value}</h4>
                  <p className="mt-4 max-w-[26ch] text-[11px] font-bold text-slate-500 leading-relaxed">{card.helper}</p>
                </div>
                <div className={`shrink-0 w-14 h-14 rounded-[1.4rem] border flex items-center justify-center shadow-xl ${card.iconWrapClass}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-[1120px] w-full text-left">
          <thead className="bg-black/80 border-b border-slate-800 font-black uppercase text-[10px] text-slate-500 tracking-[0.2em] italic">
            <tr>
              <th className="px-10 py-7">Staff / Barbero</th>
              <th className="px-10 py-7 text-center">Modalidad</th>
              <th className="px-10 py-7 text-right min-w-[130px]">Base</th>
              <th className="px-10 py-7 text-right min-w-[150px]">Comisiones</th>
              <th className="px-10 py-7 text-right min-w-[150px]">Adelantos</th>
              <th className="px-10 py-7 text-right">Total a Pagar</th>
              <th className="px-10 py-7 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
              {payrollRows.map(({ barber: b, nomina: data }) => {
              return (
                <tr key={b.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${b.bg} rounded-xl flex items-center justify-center font-black italic text-white shadow-lg`}>{b.avatar}</div>
                      <div>
                        <p className="text-base font-black uppercase italic text-white tracking-tighter leading-none">{b.fullName || b.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-bold italic leading-none">{b.cedula?.trim() || `ID STAFF ${b.id}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">{getBarberPaymentModeLabel(b.paymentMode, data.commissionRate)}</span>
                  </td>
                  <td className="px-10 py-6 text-right min-w-[130px]">
                    <span className="whitespace-nowrap text-sm font-black text-white italic">C$ {data.base.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right min-w-[150px]">
                    <span className="whitespace-nowrap text-sm font-black text-emerald-400 italic">C$ {data.comission.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right min-w-[150px]">
                    <div className="flex flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-sm font-black text-amber-300 italic">- C$ {data.withdrawalsTotal.toLocaleString()}</span>
                      {data.withdrawals.length > 0 && (
                        <span className="whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-slate-500">
                          {data.withdrawals.length} adelanto{data.withdrawals.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-lg font-black text-white italic tracking-tighter">C$ {data.total.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenHistory?.(b, settlementsByBarberId.get(String(b.id)) || [])}
                        className="bg-indigo-500/10 hover:bg-indigo-500 text-indigo-300 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all border border-indigo-500/20 shadow-lg"
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => onPagar(b, data)}
                        className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all border border-emerald-500/20 shadow-lg"
                      >
                        Pagar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 md:p-6 shadow-2xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-xl font-black uppercase italic tracking-tight text-white">Historial de pagos</h4>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Expediente por barbero</p>
          </div>
        </div>

        {barberPaymentFiles.length === 0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-900/80 p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
            Aún no hay barberos para consultar.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {barberPaymentFiles.map(({ barber, settlements, totalPaid, lastPayment }) => {
              const paidDate = lastPayment?.paidAt ? new Date(lastPayment.paidAt) : null;
              const hasPayments = settlements.length > 0;
              const dateLabel = paidDate && !Number.isNaN(paidDate.getTime())
                ? paidDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Sin pagos';
              return (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => onOpenHistory?.(barber, settlements)}
                  className={`group relative min-h-[138px] overflow-hidden rounded-[1.8rem] border p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.99] ${hasPayments ? 'border-emerald-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/20 hover:border-emerald-300/50' : 'border-slate-800 bg-black/35 hover:border-indigo-400/40 hover:bg-indigo-500/10'}`}
                >
                  <div className={`absolute inset-x-4 top-0 h-px opacity-70 ${barber.bg || 'bg-indigo-600'}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${barber.bg || 'bg-indigo-600'} text-[11px] font-black italic text-white shadow-lg`}>
                        {barber.avatar || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black uppercase italic leading-tight text-white">{barber.fullName || barber.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${hasPayments ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
                            {settlements.length} pago{settlements.length === 1 ? '' : 's'}
                          </span>
                          <span className="rounded-full border border-cyan-300/15 bg-white/[0.03] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                            {dateLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Histórico</p>
                      <p className={`mt-1 whitespace-nowrap text-xl font-black italic ${hasPayments ? 'text-emerald-300' : 'text-slate-500'}`}>C$ {totalPaid.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {hasPayments ? 'Ver detalle de pagos' : 'Abrir expediente'}
                    </span>
                    <ArrowRight size={14} className={`transition-transform group-hover:translate-x-1 ${hasPayments ? 'text-emerald-300' : 'text-indigo-300'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 md:pt-8">
        <button
          onClick={() => onLiquidarTodo(payrollRows, summary)}
          className="w-full md:w-auto bg-[#4ade80] hover:bg-[#34d399] text-[#064e3b] px-7 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center gap-3 text-[10px] md:text-xs font-black uppercase italic tracking-[0.16em] md:tracking-widest transition-all shadow-[0_0_30px_rgba(74,222,128,0.3)] active:scale-95"
        >
          Liquidar Todo el Staff <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

const getPresetDateRange = (preset, baseDate = new Date()) => {
  const anchor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  if (preset === 'week') {
    const dayIndex = anchor.getDay();
    const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  if (preset === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear(), 11, 31);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
};

const formatRangeLabel = (start, end) => {
  const parsedStart = parseLocalDate(start);
  const parsedEnd = parseLocalDate(end);
  if (!parsedStart || !parsedEnd) return 'Rango sin definir';

  const startLabel = parsedStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const endLabel = parsedEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} a ${endLabel}`;
};

function ReportsView({ appointments, clients, barbers, services = [], branches = [], currentBranchId = null, posSales = [], cashMovements = [] }) {
  const [reportTab, setReportTab] = useState('ventas'); 
  const [salesPeriod, setSalesPeriod] = useState('week'); 
  const [productRangePreset, setProductRangePreset] = useState('month');
  const [showProductRangeControls, setShowProductRangeControls] = useState(false);
  const [staffRangePreset, setStaffRangePreset] = useState('month');
  const [showStaffRangeControls, setShowStaffRangeControls] = useState(false);
  const [selectedReportBranchId, setSelectedReportBranchId] = useState(currentBranchId || 'all');
  const [reportToday, setReportToday] = useState(() => getTodayString());
  const [productRangeStart, setProductRangeStart] = useState(() => getPresetDateRange('month').start);
  const [productRangeEnd, setProductRangeEnd] = useState(() => getPresetDateRange('month').end);
  const [staffRangeStart, setStaffRangeStart] = useState(() => getPresetDateRange('month').start);
  const [staffRangeEnd, setStaffRangeEnd] = useState(() => getPresetDateRange('month').end);
  const barbersById = useMemo(() => Object.fromEntries((barbers || []).map(b => [String(b.id), b])), [barbers]);
  const reportTodayDate = useMemo(() => parseLocalDate(reportToday) || new Date(), [reportToday]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeoutMs = Math.max(60_000, nextMidnight.getTime() - now.getTime());

    const timerId = globalThis.setTimeout(() => {
      setReportToday(getTodayString());
    }, timeoutMs);

    return () => globalThis.clearTimeout(timerId);
  }, [reportToday]);

  const effectiveReportBranchId = selectedReportBranchId === 'all' ? 'all' : (
    (branches || []).some((branch) => String(branch.id) === String(selectedReportBranchId))
      ? selectedReportBranchId
      : 'all'
  );
  const scopedAppointments = useMemo(
    () => (appointments || []).filter((appointment) => {
      if (effectiveReportBranchId === 'all') return true;
      const resolvedBranchId = appointment.branchId || barbersById[String(appointment.barberId)]?.branchId || null;
      return String(resolvedBranchId || '') === String(effectiveReportBranchId);
    }),
    [appointments, effectiveReportBranchId, barbersById],
  );
  const voidedSaleIds = useMemo(() => new Set(
    (cashMovements || [])
      .filter((movement) => movement.referenceType === 'pos_sale_void' && movement.referenceId)
      .map((movement) => String(movement.referenceId)),
  ), [cashMovements]);
  const isSaleVoided = useCallback(
    (sale) => Boolean(sale?.canceledAt || voidedSaleIds.has(String(sale?.id || ''))),
    [voidedSaleIds],
  );
  const scopedPosSales = useMemo(
    () => (posSales || []).filter((sale) => (
      effectiveReportBranchId === 'all'
        ? true
        : String(sale.branchId || '') === String(effectiveReportBranchId)
    )),
    [posSales, effectiveReportBranchId],
  );
  const activeScopedPosSales = useMemo(
    () => scopedPosSales.filter((sale) => !isSaleVoided(sale)),
    [isSaleVoided, scopedPosSales],
  );
  const voidedScopedAppointmentIds = useMemo(() => new Set(
    scopedPosSales
      .filter((sale) => isSaleVoided(sale))
      .flatMap((sale) => (Array.isArray(sale.items) ? sale.items : []))
      .map((item) => item.appointmentId)
      .filter(Boolean)
      .map((appointmentId) => String(appointmentId)),
  ), [isSaleVoided, scopedPosSales]);
  const unresolvedLegacyPosSalesCount = useMemo(
    () => (posSales || []).filter((sale) => !sale.barbershopId || !sale.branchId).length,
    [posSales],
  );
  const globalVoidedAppointmentIds = useMemo(() => new Set(
    (posSales || [])
      .filter((sale) => isSaleVoided(sale))
      .flatMap((sale) => (Array.isArray(sale.items) ? sale.items : []))
      .map((item) => item.appointmentId)
      .filter(Boolean)
      .map((appointmentId) => String(appointmentId)),
  ), [isSaleVoided, posSales]);
  const globalFinished = useMemo(
    () => (appointments || []).filter((appointment) => (
      appointment.status === 'Finalizada'
      && !globalVoidedAppointmentIds.has(String(appointment.id))
    )),
    [appointments, globalVoidedAppointmentIds],
  );
  const finished = useMemo(() => scopedAppointments.filter((appointment) => (
    appointment.status === 'Finalizada'
    && !voidedScopedAppointmentIds.has(String(appointment.id))
  )), [scopedAppointments, voidedScopedAppointmentIds]);
  const finishedRevenueTotal = useMemo(
    () => finished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [finished],
  );
  const effectiveSalesRange = useMemo(
    () => getPresetDateRange(salesPeriod, reportTodayDate),
    [reportTodayDate, salesPeriod],
  );
  const salesRangeLabel = useMemo(
    () => formatRangeLabel(effectiveSalesRange.start, effectiveSalesRange.end),
    [effectiveSalesRange.end, effectiveSalesRange.start],
  );
  const presetProductRange = useMemo(
    () => getPresetDateRange(productRangePreset === 'custom' ? 'month' : productRangePreset, reportTodayDate),
    [productRangePreset, reportTodayDate],
  );
  const productRangeInputStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
  const productRangeInputEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;
  const effectiveProductRange = useMemo(() => {
    const candidateStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
    const candidateEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetProductRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetProductRange, productRangeEnd, productRangePreset, productRangeStart]);
  const productRangeLabel = useMemo(
    () => formatRangeLabel(effectiveProductRange.start, effectiveProductRange.end),
    [effectiveProductRange.end, effectiveProductRange.start],
  );
  const periodFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveSalesRange.start && normalizedDate <= effectiveSalesRange.end;
    }),
    [effectiveSalesRange.end, effectiveSalesRange.start, finished],
  );
  const periodPosSales = useMemo(
    () => activeScopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveSalesRange.start && saleDate <= effectiveSalesRange.end;
    }),
    [activeScopedPosSales, effectiveSalesRange.end, effectiveSalesRange.start],
  );
  const total = useMemo(
    () => periodFinished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [periodFinished],
  );
  const totalProductRevenue = useMemo(
    () => periodPosSales.reduce((acc, sale) => acc + (Number(sale.productTotal || 0)), 0),
    [periodPosSales],
  );
  const totalCombinedRevenue = total + totalProductRevenue;
  const productReportPosSales = useMemo(
    () => activeScopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveProductRange.start && saleDate <= effectiveProductRange.end;
    }),
    [activeScopedPosSales, effectiveProductRange.end, effectiveProductRange.start],
  );
  const productCatalogByName = useMemo(() => {
    const map = new Map();
    (services || [])
      .filter((service) => service.category === 'Producto')
      .forEach((service) => {
        map.set(normalizeFavoriteServiceName(service.name || '').toLowerCase(), service);
      });
    return map;
  }, [services]);
  const productReportAppointments = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveProductRange.start && normalizedDate <= effectiveProductRange.end;
    }),
    [effectiveProductRange.end, effectiveProductRange.start, finished],
  );
  const appointmentProductItems = useMemo(() => {
    const rows = [];

    productReportAppointments.forEach((appointment) => {
      const itemNames = String(appointment.service || '')
        .split(' + ')
        .map((name) => normalizeFavoriteServiceName(name).trim())
        .filter(Boolean);

      itemNames.forEach((name) => {
        const product = productCatalogByName.get(name.toLowerCase());
        if (!product) return;

        rows.push({
          appointmentId: appointment.id,
          id: product.id || name,
          name: product.name || name,
          price: Number(product.price || 0),
          qty: 1,
        });
      });
    });

    return rows;
  }, [productCatalogByName, productReportAppointments]);
  const totalProductUnits = useMemo(
    () => (
      productReportPosSales.reduce((acc, sale) => (
        acc + (sale.items || []).reduce((saleUnits, item) => (
          item.category === 'Producto' ? saleUnits + (Number(item.qty) || 0) : saleUnits
        ), 0)
      ), 0)
      + appointmentProductItems.reduce((acc, item) => acc + (Number(item.qty) || 0), 0)
    ),
    [appointmentProductItems, productReportPosSales],
  );
  const productSalesSummary = useMemo(() => {
    const summaryMap = new Map();

    productReportPosSales.forEach((sale) => {
      const saleTicketNumber = Number(sale.ticketNumber || 0);
      const productItems = (sale.items || []).filter((item) => item.category === 'Producto');
      const saleGrossRevenue = productItems.reduce(
        (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)),
        0,
      );
      const saleNetRevenue = Number(sale.productTotal || sale.subtotal || 0);

      productItems.forEach((item) => {
        if (item.category !== 'Producto') return;

        const key = String(item.id || item.name || '');
        const lineGrossRevenue = (Number(item.price) || 0) * (Number(item.qty) || 0);
        const lineNetRevenue = saleGrossRevenue > 0
          ? (saleNetRevenue * lineGrossRevenue) / saleGrossRevenue
          : lineGrossRevenue;
        const current = summaryMap.get(key) || {
          id: item.id || key,
          name: item.name || 'Producto',
          units: 0,
          revenue: 0,
          tickets: new Set(),
        };

        current.units += Number(item.qty) || 0;
        current.revenue += lineNetRevenue;
        if (saleTicketNumber > 0) current.tickets.add(saleTicketNumber);
        summaryMap.set(key, current);
      });
    });

    appointmentProductItems.forEach((item) => {
      const key = String(item.id || item.name || '');
      const current = summaryMap.get(key) || {
        id: item.id || key,
        name: item.name || 'Producto',
        units: 0,
        revenue: 0,
        tickets: new Set(),
      };

      current.units += Number(item.qty) || 0;
      current.revenue += (Number(item.price) || 0) * (Number(item.qty) || 0);
      if (item.appointmentId) current.tickets.add(`apt-${item.appointmentId}`);
      summaryMap.set(key, current);
    });

    return Array.from(summaryMap.values())
      .map((entry) => ({
        ...entry,
        revenue: Number(entry.revenue.toFixed(2)),
        ticketsCount: entry.tickets.size,
      }))
      .sort((left, right) => (
        right.revenue - left.revenue
        || right.units - left.units
        || left.name.localeCompare(right.name)
      ));
  }, [appointmentProductItems, productReportPosSales]);
  const productReportRevenue = useMemo(
    () => Number(
      productSalesSummary.reduce((acc, product) => acc + (Number(product.revenue) || 0), 0).toFixed(2),
    ),
    [productSalesSummary],
  );
  const productChartSegments = useMemo(() => {
    const colors = ['#00f5a0', '#7c5cff', '#ffb800', '#ff4db8', '#22d3ee', '#b026ff', '#7dff3c'];
    const totalRevenue = productSalesSummary.reduce((sum, product) => sum + product.revenue, 0);
    const { segments } = productSalesSummary.reduce((accumulator, product, index) => {
      const percentage = totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0;
      const segment = {
        ...product,
        color: colors[index % colors.length],
        start: accumulator.nextStart,
        end: accumulator.nextStart + percentage,
        percentage,
      };

      return {
        nextStart: accumulator.nextStart + percentage,
        segments: [...accumulator.segments, segment],
      };
    }, { nextStart: 0, segments: [] });

    return segments;
  }, [productSalesSummary]);
  const productPieBackground = useMemo(() => {
    if (!productChartSegments.length) return 'conic-gradient(#0f172a 0 100%)';
    return `conic-gradient(${productChartSegments.map((segment) => (
      `${segment.color} ${segment.start}% ${segment.end}%`
    )).join(', ')})`;
  }, [productChartSegments]);
  const productPieLabels = useMemo(
    () => productChartSegments
      .filter((segment) => segment.percentage > 0)
      .map((segment) => {
        const midPoint = (segment.start + segment.end) / 2;
        const angle = ((midPoint / 100) * 360) - 90;
        const angleInRadians = (angle * Math.PI) / 180;
        const radius = 42;

        return {
          id: segment.id,
          color: segment.color,
          percentageLabel: `${segment.percentage.toFixed(1)}%`,
          left: `${50 + (Math.cos(angleInRadians) * radius)}%`,
          top: `${50 + (Math.sin(angleInRadians) * radius)}%`,
        };
      }),
    [productChartSegments],
  );
  const clientsById = useMemo(() => Object.fromEntries((clients || []).map(c => [String(c.id), c])), [clients]);
  const barberIdsWithScopedAppointments = useMemo(
    () => new Set((scopedAppointments || []).map((appointment) => String(appointment.barberId || '')).filter(Boolean)),
    [scopedAppointments],
  );
  const scopedBarbers = useMemo(
    () => (barbers || []).filter((barber) => (
      effectiveReportBranchId === 'all'
        ? true
        : (
          String(barber.branchId || '') === String(effectiveReportBranchId)
          || barberIdsWithScopedAppointments.has(String(barber.id))
        )
    )),
    [barbers, effectiveReportBranchId, barberIdsWithScopedAppointments],
  );
  const presetStaffRange = useMemo(
    () => getPresetDateRange(staffRangePreset === 'custom' ? 'month' : staffRangePreset, reportTodayDate),
    [reportTodayDate, staffRangePreset],
  );
  const rangeInputStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
  const rangeInputEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;
  const effectiveStaffRange = useMemo(() => {
    const candidateStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
    const candidateEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetStaffRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetStaffRange, staffRangeEnd, staffRangePreset, staffRangeStart]);
  const staffRangeLabel = useMemo(
    () => formatRangeLabel(effectiveStaffRange.start, effectiveStaffRange.end),
    [effectiveStaffRange.end, effectiveStaffRange.start],
  );
  const monthlyFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveStaffRange.start && normalizedDate <= effectiveStaffRange.end;
    }),
    [effectiveStaffRange.end, effectiveStaffRange.start, finished],
  );
  const currentMonthRange = useMemo(
    () => getPresetDateRange('month', reportTodayDate),
    [reportTodayDate],
  );
  const monthlyGlobalFinished = useMemo(
    () => globalFinished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= currentMonthRange.start && normalizedDate <= currentMonthRange.end;
    }),
    [currentMonthRange.end, currentMonthRange.start, globalFinished],
  );
  
  const barGradients = [
    'from-indigo-500 to-blue-700', 'from-emerald-400 to-teal-700', 'from-amber-400 to-orange-700', 
    'from-rose-500 to-pink-700', 'from-violet-500 to-purple-800', 'from-cyan-400 to-sky-700', 'from-fuchsia-500 to-pink-600'
  ];

  const stats = useMemo(() => {
    const hasData = finished.length > 0;

    const globalStaffMetrics = (barbers || []).map((barber) => {
      const barberFinished = monthlyGlobalFinished.filter((appointment) => String(appointment.barberId) === String(barber.id));
      const barberCount = barberFinished.length;
      const barberSales = barberFinished.reduce((sum, appointment) => sum + (parseInt(appointment.price) || 0), 0);

      return {
        ...barber,
        count: barberCount,
        sales: barberSales,
      };
    });

    const bestBarberObj = globalStaffMetrics.length > 0
      ? globalStaffMetrics.reduce((prev, current) => (prev.sales >= current.sales ? prev : current), globalStaffMetrics[0])
      : null;
    
    // Métrica por personal
    const staffMetrics = scopedBarbers.map((b) => {
      const bFinished = finished.filter(a => String(a.barberId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (parseInt(a.price) || 0), 0);
      const bAvgTicket = bCount > 0 ? bSales / bCount : 0;
      
      const ratings = bFinished.filter(a => typeof a.rating === 'number').map(a => a.rating);
      const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "0.0";

      return { 
        ...b, 
        count: bCount, 
        sales: bSales, 
        avgTicket: bAvgTicket, 
        retention: bCount > 0 ? Math.min(70 + Math.min(bCount * 3, 30), 100) : 0,
        rating: avgRating
      };
    });
    
    // Servicios más vendidos
    const serviceCounts = {};
    finished.forEach((appointment) => {
      const normalizedServiceName = normalizeFavoriteServiceName(appointment.service) || 'Servicio sin nombre';
      serviceCounts[normalizedServiceName] = (serviceCounts[normalizedServiceName] || 0) + 1;
    });
    const topServiceNameVal = Object.keys(serviceCounts).length > 0 ? Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b, null) : 'Sin datos';
    const topServiceCountVal = serviceCounts[topServiceNameVal] || 0;

    // Clientes nuevos
    const startOfMonth = new Date(reportTodayDate.getFullYear(), reportTodayDate.getMonth(), 1);
    const clientsWithVisitsInScope = new Set(finished.map((appointment) => String(appointment.clientId || '')));
    const newClientsThisMonthVal = (clients || []).filter((client) => (
      clientsWithVisitsInScope.has(String(client.id)) && new Date(client.createdAt) >= startOfMonth
    )).length;

    const getHistoricalRealData = () => {
      const today = reportTodayDate;
      
      if (salesPeriod === 'week') {
        const daysLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const currentDayIdx = today.getDay();
        const diffToMonday = currentDayIdx === 0 ? -6 : 1 - currentDayIdx;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        
        const result = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const dateStr = formatLocalDateYmd(d);
          const totalDay = finished
            .filter(a => standardizeDate(a.date) === dateStr)
            .reduce((sum, a) => sum + (Number(a.price) || 0), 0);
          result.push({ label: daysLabels[i], value: totalDay });
        }
        return result;
      }

      if (salesPeriod === 'month') {
        const result = [{ label: 'Sem 1', value: 0 }, { label: 'Sem 2', value: 0 }, { label: 'Sem 3', value: 0 }, { label: 'Sem 4', value: 0 }];
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getMonth() === today.getMonth() && aptDate.getFullYear() === today.getFullYear()) {
            const day = aptDate.getDate();
            const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);
            result[weekIdx].value += (Number(a.price) || 0);
          }
        });
        return result;
      }

      if (salesPeriod === 'year') {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result = months.map(m => ({ label: m, value: 0 }));
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getFullYear() === today.getFullYear()) {
            result[aptDate.getMonth()].value += (Number(a.price) || 0);
          }
        });
        return result;
      }
      return [];
    };

    return { 
      bestBarber: bestBarberObj, 
      bestBarberCount: bestBarberObj?.count ?? 0, 
      bestBarberSales: bestBarberObj?.sales ?? 0, 
      topServiceName: topServiceNameVal || 'Sin datos', 
      topServiceCount: topServiceCountVal, 
      newClientsThisMonth: newClientsThisMonthVal, 
      globalAvgTicket: finished.length > 0 ? finishedRevenueTotal / finished.length : 0, 
      staffMetrics, 
      historicalSales: getHistoricalRealData(), 
      hasData 
    };
  }, [barbers, clients, finished, finishedRevenueTotal, monthlyGlobalFinished, reportTodayDate, salesPeriod, scopedBarbers]);

  const monthlyStaffMetrics = useMemo(() => {
    return scopedBarbers.map((b) => {
      const bFinished = monthlyFinished.filter(a => String(a.barberId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      return {
        ...b,
        count: bCount,
        sales: bSales,
      };
    });
  }, [scopedBarbers, monthlyFinished]);

  const maxMonthlyApts = Math.max(...monthlyStaffMetrics.map(m => m.count), 1);
  const maxMonthlySales = Math.max(...monthlyStaffMetrics.map(m => m.sales), 1);

  const downloadMonthlyServicesReport = () => {
    if (!monthlyFinished.length) return;

    const separator = ';';
    const escapeCsv = (value) => `"${formatExcelText(value).replace(/"/g, '""')}"`;
    const rows = monthlyFinished
      .slice()
      .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
      .map((apt) => {
        const barber = barbersById[String(apt.barberId)];
        const client = clientsById[String(apt.clientId)];
        const serviceDate = parseLocalDate(apt.date);
        return [
          barber?.fullName || barber?.name || `Barbero ${apt.barberId}`,
          client?.name || 'Cliente sin registro',
          Number(apt.price || 0),
          serviceDate ? serviceDate.toLocaleDateString('es-ES') : standardizeDate(apt.date),
        ].map(escapeCsv).join(separator);
      });

    const csv = `\uFEFFsep=${separator}\r\n${['Barbero', 'Cliente', 'Costo del servicio', 'Fecha de servicio'].map(escapeCsv).join(separator)}\r\n${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-servicios-${effectiveStaffRange.start}-${effectiveStaffRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadProductSalesReport = () => {
    if (!productSalesSummary.length) return;

    const separator = ';';
    const escapeCsv = (value) => `"${formatExcelText(value).replace(/"/g, '""')}"`;
    const rows = productSalesSummary.map((product) => [
      product.name,
      product.units,
      product.ticketsCount,
      product.revenue,
    ].map(escapeCsv).join(separator));

    const totalsRow = [
      'TOTAL',
      totalProductUnits,
      productReportPosSales.length + appointmentProductItems.length,
      productReportRevenue,
    ].map(escapeCsv).join(separator);

    const csv = `\uFEFFsep=${separator}\r\n${[
      ['Reporte', 'Ventas de productos'],
      ['Rango', productRangeLabel],
      ['Cobros registrados', productReportPosSales.length + appointmentProductItems.length],
      ['Unidades vendidas', totalProductUnits],
      ['Ingreso total', productReportRevenue],
      [],
      ['Producto', 'Unidades', 'Tickets', 'Ingreso'],
    ].map((row) => row.map(escapeCsv).join(separator)).join('\r\n')}\r\n${rows.join('\r\n')}\r\n${totalsRow}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-productos-${effectiveProductRange.start}-${effectiveProductRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const historicalMax = useMemo(() => {
    const vals = stats.historicalSales.map(d => d.value);
    const max = Math.max(...vals);
    return max === 0 ? 1000 : max;
  }, [stats.historicalSales]);

  return (
    <div className="reports-view px-3 py-4 md:p-12 space-y-6 md:space-y-12 h-full animate-in fade-in pb-24 md:pb-32 text-white no-print">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 md:gap-5 text-white">
        <div><h3 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Análisis del Negocio</h3><p className="text-[9px] md:text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.16em] md:tracking-[0.2em] leading-none">Métricas avanzadas y rendimiento comercial real</p></div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {(branches || []).length > 0 && (
            <div className="w-full sm:min-w-[220px] sm:w-auto">
              <select
                value={effectiveReportBranchId}
                onChange={(e) => setSelectedReportBranchId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
              >
                <option value="all">Toda la barbería</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-white"><CalendarIcon size={18} className="text-slate-500" /><span className="text-[10px] md:text-xs font-black uppercase italic text-white">{reportTodayDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span></div>
        </div>
      </div>
      {unresolvedLegacyPosSalesCount > 0 && (
        <div className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 leading-none">Advertencia POS</p>
          <p className="mt-2 text-sm font-bold leading-relaxed">
            Hay {unresolvedLegacyPosSalesCount} venta{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} POS antigua{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} sin sucursal asignada.
            No se pueden atribuir con seguridad a la sucursal seleccionada hasta normalizar su `branch_id`.
          </p>
        </div>
      )}
      
      <div className="flex w-full md:w-fit items-center gap-2 p-1.5 bg-black border border-slate-900 rounded-[1.4rem] md:rounded-[2rem] md:w-fit mx-auto shadow-2xl text-white">
        <button onClick={() => setReportTab('ventas')} className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 md:px-8 py-3 md:py-4 rounded-[1.2rem] md:rounded-[1.8rem] text-[9px] md:text-[11px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${reportTab === 'ventas' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}><TrendingUp size={14} className="md:size-4" /> Ventas</button>
        <button onClick={() => setReportTab('personal')} className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 md:px-8 py-3 md:py-4 rounded-[1.2rem] md:rounded-[1.8rem] text-[9px] md:text-[11px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${reportTab === 'personal' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}><Users size={14} className="md:size-4" /> Personal</button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
        {reportTab === 'ventas' ? (
          <section className="space-y-10 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-8 text-white">
              <div className="bg-slate-900 neon-border-indigo p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ingresos Totales (Corte)</p>
                    <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400"><ArrowUpRight size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-indigo-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">C$ {(Number(total) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-indigo-600 w-full" /></div>
                    <span className="text-[10px] font-black text-indigo-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ventas de Productos</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Package size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {(Number(totalProductRevenue) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-emerald-500 w-full" /></div>
                    <span className="text-[10px] font-black text-emerald-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <Target className="absolute -right-6 -bottom-6 w-40 h-40 text-slate-800/10 -rotate-12" />
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Servicio más Vendido</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Sparkles size={16} /></div>
                  </div>
                  <h4 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-tight truncate drop-shadow-lg">{stats.topServiceName}</h4>
                  <p className="text-emerald-400 font-black text-xl mt-4 italic flex items-center gap-2 leading-none">{stats.topServiceCount} Servicios Reales <TrendingUp size={16}/></p>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Ingreso Total del Negocio</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><UserPlus size={16} /></div>
                  </div>
                  <h4 className="text-6xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {totalCombinedRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-500 font-black mt-4 uppercase italic leading-none">Cortes + productos • {salesRangeLabel}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative text-white flex flex-col min-h-[420px] md:min-h-[550px]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-6 md:mb-12 text-white">
                <div>
                  <h5 className="text-lg md:text-2xl font-black italic uppercase text-white flex items-center gap-3"><BarChart3 className="text-indigo-500" /> Rendimiento de Ingresos</h5>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase italic mt-1 tracking-[0.14em] md:tracking-widest leading-none">Histórico real de la semana en curso (Lunes - Domingo)</p>
                </div>
                <div className="flex w-full md:w-auto items-center gap-2 p-1.5 bg-black border border-slate-800 rounded-2xl text-white">
                  {periodOptions.map(period => (
                    <button key={period.id} onClick={() => setSalesPeriod(period.id)} className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${salesPeriod === period.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{period.label}</button>
                  ))}
                </div>
              </div>

              <div className="relative h-[270px] sm:h-[300px] md:h-[320px] w-full overflow-hidden pb-1 md:pb-2">
                <div
                  className="relative h-full min-w-0 w-full flex items-end justify-between gap-1 sm:gap-2 md:gap-6 px-1.5 sm:px-2 md:px-4 text-white"
                >
                  <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex flex-col justify-between opacity-5 z-0">
                    {[...Array(6)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                  </div>
                  {stats.historicalSales.map((data, idx) => {
                    const hVal = (data.value / historicalMax) * 100;
                    const gradient = barGradients[idx % barGradients.length];
                    return (
                      <div key={idx} className="min-w-0 basis-0 flex-1 flex flex-col items-center relative z-10 h-full group text-white">
                        <div className="flex-1 w-full flex flex-col justify-end items-center text-white">
                          <div className="flex flex-col items-center mb-2 md:mb-3 transition-transform duration-300 group-hover:scale-125 text-white">
                            <span className="text-[9px] sm:text-[10px] md:text-[13px] font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none whitespace-nowrap">
                              C$ {data.value >= 1000 ? (data.value / 1000).toFixed(1) + 'k' : data.value}
                            </span>
                          </div>
                          <div className={`w-full max-w-[26px] sm:max-w-[34px] md:max-w-[60px] rounded-t-3xl transition-all duration-1000 ease-out relative bg-gradient-to-t ${gradient} shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-t border-cyan-300/20`} style={{ height: `${Math.max(hVal, 5)}%` }}>
                            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-3xl text-white"></div>
                            <div className={`absolute inset-0 opacity-0 transition-opacity rounded-t-3xl blur-xl bg-gradient-to-t ${gradient} group-hover:opacity-40 text-white`} />
                          </div>
                        </div>
                        <div className="h-8 md:h-10 flex items-center text-white">
                          <p className="text-[9px] md:text-[11px] font-black uppercase text-white italic tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-all leading-none">{data.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-white">
              <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <div className="px-8 py-7 border-b border-slate-800 bg-black/50 flex flex-col gap-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-3"><Package className="text-emerald-400" size={20} /> Reporte de Ventas de Productos</h5>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2 italic leading-none">{productRangeLabel}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 lg:items-start">
                      <div className="min-h-[52px] min-w-[220px] px-4 py-3 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex flex-col justify-center text-left">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/80 leading-none">
                          {productRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === productRangePreset)?.label || 'Mes'}`}
                        </span>
                        <span className="mt-2 text-[11px] font-black text-white leading-tight break-words">{productRangeLabel}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowProductRangeControls((prev) => !prev)}
                          className={`min-h-[52px] px-5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 ${
                            showProductRangeControls
                              ? 'bg-white/10 text-white border-cyan-300/20'
                              : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          <Filter size={14} />
                          {showProductRangeControls ? 'Ocultar filtros' : 'Filtros'}
                        </button>
                        <button
                          onClick={downloadProductSalesReport}
                          disabled={!productSalesSummary.length}
                          className="min-h-[52px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                        >
                          <Save size={14} /> Exportar Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  {showProductRangeControls && (
                    <div className="rounded-[1.8rem] border border-white/5 bg-slate-950/60 p-3 space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-3 gap-2">
                        {periodOptions.map((period) => (
                          <button
                            key={period.id}
                            type="button"
                            onClick={() => setProductRangePreset(period.id)}
                            className={`min-h-[44px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                              productRangePreset === period.id
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={productRangeInputStart}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeStart(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                        <input
                          type="date"
                          value={productRangeInputEnd}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeEnd(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {productSalesSummary.length > 0 ? (
                  <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(360px,40%)_1fr] gap-10 items-start">
                    <div className="space-y-6 flex justify-center xl:justify-center">
                      <div className="relative mx-auto aspect-square w-full max-w-[460px] flex items-center justify-center">
                        {productPieLabels.map((label) => (
                          <div
                            key={label.id}
                            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 min-w-[84px] px-4 py-2 rounded-full border text-center text-sm font-black italic text-white whitespace-nowrap"
                            style={{
                              left: label.left,
                              top: label.top,
                              backgroundColor: label.color,
                              borderColor: `${label.color}cc`,
                              boxShadow: '0 0 0 3px #0f172a, 0 10px 24px rgba(2,6,23,0.32)',
                            }}
                          >
                            {label.percentageLabel}
                          </div>
                        ))}

                        <div
                          className="aspect-square w-full rounded-full overflow-hidden flex items-center justify-center border border-white/5"
                          style={{
                            background: productPieBackground,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 22px 48px rgba(2,6,23,0.42)',
                          }}
                        >
                          <div className="aspect-square w-[50%] rounded-full bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center px-5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Ventas Totales</span>
                            <span className="mt-3 text-4xl font-black italic text-emerald-400 leading-none">C$ {productReportRevenue.toLocaleString()}</span>
                            <span className="mt-3 text-[11px] font-black uppercase italic text-slate-400 leading-none">{totalProductUnits} unidades</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-[720px] ml-auto space-y-3.5 min-h-[320px]">
                      {productChartSegments.map((product, index) => (
                        <div key={product.id} className="rounded-[1.9rem] border border-white/5 bg-black/35 px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="mt-1 block w-4 h-4 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.12)]" style={{ backgroundColor: product.color }} />
                              <div>
                                <p className="text-[13px] font-black uppercase italic tracking-tight text-white leading-none">{product.name}</p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <span className="px-2.5 py-1 rounded-full border border-cyan-300/15 bg-white/[0.03] text-[8px] font-black uppercase italic text-slate-300 leading-none">{product.units} unidades</span>
                                  <span className="px-2.5 py-1 rounded-full border border-indigo-400/20 bg-indigo-500/10 text-[8px] font-black uppercase italic text-indigo-300 leading-none">{product.ticketsCount} tickets</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 leading-none">{product.percentage.toFixed(1)}%</p>
                              <p className="mt-2 text-[28px] font-black italic text-emerald-400 leading-none">C$ {product.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(product.percentage, 4)}%`, backgroundColor: product.color }} />
                          </div>
                          <p className="mt-2.5 text-[8px] font-black uppercase tracking-[0.16em] text-slate-600 leading-none">Producto #{index + 1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-8 py-16 text-center">
                    <Package size={34} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-sm font-black uppercase italic text-slate-400">No hay ventas de productos en este rango</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mt-3">Prueba con otra sucursal o cambia el periodo</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-12 text-white">
            <div className="flex items-center gap-4 text-white"><div className="h-px flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent"></div><h4 className="text-xl font-black italic uppercase text-indigo-400 tracking-tighter">Eficiencia del Staff</h4><div className="h-px flex-1 bg-gradient-to-l from-indigo-500/50 to-transparent"></div></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white">
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Ticket Promedio Equipo</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-indigo-400 leading-none">C$ {stats.globalAvgTicket.toFixed(0)}</h5><div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-500"><TrendingUp size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Nivel Satisfacción</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-amber-500 leading-none">4.8 / 5.0</h5><div className="p-2 bg-amber-600/10 rounded-lg text-amber-500"><Star size={16} fill="currentColor"/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Tasa de Retención</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-emerald-400 leading-none">82%</h5><div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-400"><UserCheck size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Servicios Finalizados</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-rose-400 leading-none">{finished.length}</h5><div className="p-2 bg-rose-600/10 rounded-lg text-rose-400"><Scissors size={16}/></div></div></div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-white">
              <div className="bg-mesh-amber border-2 border-amber-500/60 p-10 rounded-[3.5rem] flex flex-col items-center text-center shadow-[0_0_60px_rgba(245,158,11,0.4)] animate-glow relative overflow-hidden group text-white min-h-[570px] justify-center">
                <div className="absolute inset-0 aurora-effect opacity-10 pointer-events-none z-0"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.20] pointer-events-none z-0 animate-spin-very-slow text-white"><Crown size={500} className="text-amber-500" strokeWidth={0.6} /></div>
                <Scissors className="absolute top-20 right-10 text-emerald-400 -rotate-12 animate-float" size={50} />
                <Star className="absolute top-1/4 right-[30%] text-amber-500 rotate-12 animate-float" size={44} />
                <Sparkles className="absolute bottom-20 left-10 text-amber-500/90 animate-float" size={70} />
                <Award className="absolute bottom-1/4 right-10 text-amber-500/90 -rotate-15 animate-float" size={75} />
                <div className="relative z-10 flex flex-col items-center text-white w-full">
                  <Crown size={72} className="text-amber-500 drop-shadow-[0_10px_15px_rgba(245,158,11,1)] animate-bounce mb-6" />
                  <div className="transition-transform duration-700 relative group-hover:scale-110 text-white">
                    <div className="absolute inset-0 bg-amber-400 blur-3xl opacity-30 animate-pulse text-white"></div>
                    <div className="w-40 h-40 bg-amber-500 rounded-[3.5rem] flex items-center justify-center text-amber-950 font-black text-6xl italic shadow-[0_0_60px_rgba(245,158,11,0.8)] border-4 border-amber-50 relative z-10 overflow-hidden text-white">
                      <span className="relative z-10 drop-shadow-2xl">{stats.bestBarber?.avatar || '?'}</span>
                    </div>
                  </div>
                  <div className="mt-12 text-white w-full">
                    <p className="text-[14px] font-black text-amber-500 uppercase italic tracking-[0.4em] mb-2 drop-shadow-md leading-none">---THE BEST BARBER-PRO---</p>
                    <h4 className="text-6xl font-black italic uppercase text-white tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] leading-none">{stats.bestBarber?.name || '---'}</h4>
                  </div>
                  <div className="mt-16 pt-10 border-t border-cyan-300/20 w-full flex justify-between px-8 text-white relative">
                    <div className="flex flex-col items-start text-white"><p className="text-[13px] font-black text-amber-500 uppercase mb-2 italic tracking-widest opacity-80 leading-none">Total Cortes</p><p className="text-6xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{stats.bestBarberCount || 0}</p></div>
                    <div className="flex flex-col items-end text-white"><p className="text-[13px] font-black text-amber-500 uppercase mb-2 italic tracking-widest opacity-80 leading-none">Ventas Brutas</p><p className="text-6xl font-black text-white leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl mr-1 font-bold text-emerald-400">C$</span>{(stats.bestBarberSales || 0).toLocaleString()}</p></div>
                  </div>
                </div>
              </div>
              
              <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative text-white flex flex-col min-h-[560px]">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-start gap-8 mb-10 text-white">
                  <div className="max-w-xl">
                    <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-2"><BarChart3 className="text-indigo-500" /> Comparativa de Rendimiento Real</h5>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 italic leading-none">Citas e ingresos por barbero dentro del rango seleccionado</p>
                  </div>
                  <div className="w-full lg:w-auto flex items-start justify-end gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowStaffRangeControls((prev) => !prev)}
                        title="Filtros"
                        aria-label="Abrir filtros de rendimiento"
                        className={`h-[52px] w-[52px] rounded-2xl border transition-all flex items-center justify-center ${
                          showStaffRangeControls
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-950/40'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <Filter size={18} />
                      </button>

                      {showStaffRangeControls && (
                        <div className="adaptive-popover absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(88vw,22rem)] rounded-[1.8rem] border border-cyan-300/15 bg-slate-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-600/15 px-4 py-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-300/80 leading-none">
                              {staffRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === staffRangePreset)?.label || 'Mes'}`}
                            </span>
                            <span className="mt-2 block text-[12px] font-black text-white leading-tight">
                              {staffRangeLabel}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {periodOptions.map((period) => (
                              <button
                                key={period.id}
                                type="button"
                                onClick={() => setStaffRangePreset(period.id)}
                                className={`min-h-[42px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                  staffRangePreset === period.id
                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg'
                                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {period.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={rangeInputStart}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeStart(e.target.value);
                              }}
                              className="min-h-[46px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-indigo-500"
                            />
                            <input
                              type="date"
                              value={rangeInputEnd}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeEnd(e.target.value);
                              }}
                              className="min-h-[46px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={downloadMonthlyServicesReport}
                      disabled={monthlyFinished.length === 0}
                      className="w-full sm:w-auto min-h-[52px] lg:min-w-[190px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> Exportar Excel
                    </button>
                  </div>
                </div>
                
                <div className="relative z-10 mt-2 flex-1 overflow-x-hidden md:overflow-x-auto custom-scrollbar pb-3 px-1 md:px-0">
                  <div
                    className="relative h-[315px] min-w-0 md:h-[345px] md:min-w-[340px]"
                    style={{ width: '100%' }}
                  >
                    {/* CUADRÍCULA ESTRUCTURADA DE FONDO */}
                    <div className="absolute inset-x-0 top-8 bottom-0 md:top-10 flex flex-col justify-between opacity-[0.1] pointer-events-none border-l border-slate-700 ml-8 md:ml-10 mb-16 md:mb-20">
                      {[100, 80, 60, 40, 20, 0].map((val) => (
                        <div key={val} className="w-full flex items-center relative">
                          <span className="absolute -left-8 md:-left-10 text-[8px] font-black text-slate-500 w-7 md:w-8 text-right italic leading-none">{val}%</span>
                          <div className="flex-1 h-px border-t border-dashed border-slate-600"></div>
                        </div>
                      ))}
                    </div>

                    <div className="relative flex h-full items-end justify-between gap-2 md:gap-4 pl-10 pr-6 md:pl-12 md:pr-6 pt-10 md:pt-12">
                      {monthlyStaffMetrics.map((b) => {
                        const chartHeightCap = 84;
                        const countHeight = (b.count / maxMonthlyApts) * chartHeightCap;
                        const salesHeight = (b.sales / maxMonthlySales) * chartHeightCap;
                        const barberColorClass = b.bg || 'bg-indigo-600';

                        return (
                          <div
                            key={b.id}
                            className="flex min-w-0 flex-1 md:w-auto md:min-w-[78px] md:shrink-0 md:flex-1 flex-col items-center justify-end h-full group text-white"
                          >
                            <div className="flex items-end gap-1.5 md:gap-2.5 w-full justify-center px-1 h-full min-h-[40px] relative text-white">
                              {/* Barra de Citas */}
                              <div className="flex flex-col items-center justify-end h-full w-full max-w-[20px] md:max-w-[32px] relative text-white">
                                <span
                                  className="text-[9px] md:text-[11.5px] font-black text-white absolute whitespace-nowrap bg-indigo-600 px-2 py-1 rounded-lg border border-indigo-400 shadow-[0_5px_15px_rgba(79,70,229,0.3)] z-20 transition-all duration-1000 ease-out italic group-hover:scale-110 leading-none"
                                  style={{ bottom: `calc(${Math.max(countHeight, 4)}% + 6px)` }}
                                >
                                  {b.count}
                                </span>
                                <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${barberColorClass} shadow-lg text-white border-t border-cyan-300/20`} style={{ height: `${Math.max(countHeight, 4)}%` }}>
                                  <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity rounded-t-2xl group-hover:opacity-100 text-white"></div>
                                </div>
                              </div>

                              {/* Barra de Ingresos */}
                              <div className="flex flex-col items-center justify-end h-full w-full max-w-[20px] md:max-w-[32px] relative text-white">
                                <div
                                  className="absolute text-center z-20 transition-all duration-1000 ease-out"
                                  style={{ bottom: `calc(${Math.max(salesHeight, 4)}% + 6px)` }}
                                >
                                  <span className="text-[9px] md:text-[11.5px] font-black text-emerald-100 italic whitespace-nowrap bg-emerald-600 px-2 py-1 rounded-lg border border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform leading-none">
                                    C$ {b.sales >= 1000 ? (b.sales / 1000).toFixed(1) + 'k' : b.sales}
                                  </span>
                                </div>
                                <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${barberColorClass} brightness-125 shadow-lg text-white border-t border-white/30`} style={{ height: `${Math.max(salesHeight, 4)}%` }}>
                                  <div className="absolute inset-0 bg-white/10 opacity-30 rounded-t-2xl text-white"></div>
                                  <div className={`absolute -inset-1 opacity-0 transition-opacity rounded-t-2xl blur-lg ${barberColorClass} group-hover:opacity-20 text-white`} />
                                </div>
                              </div>
                            </div>

                            <div className="mt-6 md:mt-8 flex flex-col items-center gap-1.5 md:gap-2 text-white">
                              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${b.bg} flex items-center justify-center text-[10px] font-black italic shadow-lg border-2 border-slate-900 transition-transform group-hover:scale-110 text-white`}>
                                {b.avatar}
                              </div>
                              <p className="text-[9px] md:text-[11px] font-black uppercase text-slate-200 italic tracking-[0.08em] leading-none truncate w-16 md:w-20 text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                                {b.name.split(' ')[0]}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 md:mt-12 pt-5 md:pt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-white">
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Citas del rango</span>
                   </div>
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-emerald-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Ingresos del rango</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 text-white mt-12">
                <div className="flex items-center gap-4 text-white"><h4 className="text-xl font-black italic uppercase text-white tracking-tighter leading-none">Rendimiento Detallado por Barbero</h4><div className="h-px flex-1 bg-slate-900"></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
                  {stats.staffMetrics.map(b => (
                    <div key={b.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] transition-all group relative overflow-hidden hover:border-indigo-500/50 text-white">
                       <div className="flex items-center gap-4 mb-8 text-white">
                         <div className={`w-14 h-14 rounded-2xl ${b.bg} flex items-center justify-center text-white font-black italic text-xl shadow-xl transition-transform text-white`}>{b.avatar}</div>
                         <div className="text-white">
                           <h5 className="text-lg font-black uppercase italic text-white leading-none">{b.name}</h5>
                           <div className="flex items-center gap-1 mt-2 text-amber-500"><Star size={12} fill="currentColor"/><span className="text-[11px] font-black italic leading-none">{b.rating} / 5.0</span></div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 text-white">
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Ticket Promedio</p><p className="text-base font-black text-white italic leading-none mt-2">C$ {Math.round(b.avgTicket)}</p></div>
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Retención</p><p className="text-base font-black text-emerald-400 italic leading-none mt-2">{b.retention}%</p></div>
                       </div>
                    </div>
                  ))}
                </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const periodOptions = [{ id: 'week', label: 'Semana' }, { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }];

function ClientModal({ onClose, onSave, clients, initial }) {
  const [formData, setFormData] = useState({ name: initial?.name || '', phone: formatPhoneNumber(initial?.phone || ''), notes: initial?.notes || '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setErrorMsg(null); 
    const formattedPhone = formatPhoneNumber(formData.phone);
    if (!isValidPhoneNumber(formattedPhone)) { setErrorMsg('El celular debe tener exactamente 8 dígitos.'); return; }
    const duplicate = findClientByPhone(clients, formattedPhone, initial?.id);
    if (duplicate) { setErrorMsg(`Este número ya pertenece a: ${duplicate.name}`); return; } 
    onSave({ ...formData, phone: formattedPhone }); 
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 animate-in zoom-in-95 text-white">
        <div className="px-10 py-12 bg-gradient-to-br from-indigo-600/30 border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-5 text-white"><div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white"><UserPlus size={32}/></div><div><h3 className="text-3xl font-black uppercase italic text-white leading-none">{initial ? 'Editar Ficha' : 'Nuevo Cliente'}</h3></div></div>
          <button onClick={onClose} className="p-3 bg-black rounded-2xl text-slate-500 text-white"><X size={24}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-10 space-y-8 text-white">
          {errorMsg && <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl text-rose-400 text-[10px] font-black uppercase italic leading-none">{errorMsg}</div>}
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Nombre Completo</label><input required placeholder="Ej. Juan Pérez" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Celular</label><input required type="tel" placeholder="0000-0000" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.phone} onChange={e => { setErrorMsg(null); setFormData({...formData, phone: formatPhoneNumber(e.target.value)}); }} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Notas Técnicas</label><textarea placeholder="Ej. Piel sensible..." className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white min-h-[140px] outline-none focus:border-indigo-600 italic leading-relaxed" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
          <button type="submit" className="w-full bg-indigo-600 py-6 rounded-[2rem] font-black uppercase italic text-xs text-white leading-none">GUARDAR EN BASE DE DATOS</button>
        </form>
      </div>
    </div>
  );
}

function TransferAppointmentModal({ appointment, appointments, clients, barbers, onClose, onSave }) {
  const [targetBarberId, setTargetBarberId] = useState('');

  const client = clients.find((item) => String(item.id) === String(appointment?.clientId));
  const currentBarber = barbers.find((item) => String(item.id) === String(appointment?.barberId));
  const availableTargets = useMemo(
    () => (barbers || []).filter((barber) => String(barber.id) !== String(appointment?.barberId)),
    [barbers, appointment?.barberId],
  );
  const effectiveTargetBarberId = targetBarberId || availableTargets[0]?.id || '';
  const selectedTarget = availableTargets.find((barber) => String(barber.id) === String(effectiveTargetBarberId));
  const hasConflict = selectedTarget
    ? hasAppointmentBarberConflict({ appointments, appointment, targetBarberId: selectedTarget.id })
    : false;

  if (!appointment) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedTarget || hasConflict) return;
    onSave(appointment.id, selectedTarget.id);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Repeat size={21} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Trasladar cita</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {getAppointmentDisplayClientName(appointment, client)} - {appointment.time || '--:--'} - {normalizeFavoriteServiceName(appointment.service) || 'Servicio'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-[1.5rem] border border-white/5 bg-black/35 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Barbero actual</p>
            <div className="mt-3 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${currentBarber?.bg || 'bg-slate-800'} text-xs font-black italic text-white`}>
                {currentBarber?.avatar || '?'}
              </div>
              <p className="font-black uppercase italic text-white">{currentBarber?.name || 'Sin asignar'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Mover hacia</p>
            {availableTargets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                No hay otro barbero disponible para trasladar.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableTargets.map((barber) => {
                  const blocked = hasAppointmentBarberConflict({ appointments, appointment, targetBarberId: barber.id });
                  const selected = String(effectiveTargetBarberId) === String(barber.id);
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setTargetBarberId(barber.id)}
                      className={`flex items-center gap-3 rounded-[1.3rem] border p-3 text-left transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-600/15 shadow-[0_0_24px_rgba(79,70,229,0.18)]'
                          : 'border-slate-800 bg-black hover:border-slate-600'
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${barber.bg} text-xs font-black italic text-white`}>
                        {barber.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black uppercase italic text-white">{barber.name}</p>
                        <p className={`mt-1 text-[9px] font-black uppercase tracking-[0.18em] ${blocked ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {blocked ? 'Ocupado en ese horario' : 'Disponible'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasConflict && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase italic leading-relaxed text-rose-200">
              El barbero seleccionado ya tiene una cita que se cruza con este horario.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 bg-black/40 p-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:text-white">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!selectedTarget || hasConflict}
            className="flex-1 rounded-2xl bg-indigo-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar traslado
          </button>
        </div>
      </form>
    </div>
  );
}

function RescheduleAppointmentModal({ appointment, appointments, clients, barbers, onClose, onSave }) {
  const [targetDate, setTargetDate] = useState(appointment?.date || getTodayString());
  const [targetTime, setTargetTime] = useState(appointment?.time || '09:00');

  const client = clients.find((item) => String(item.id) === String(appointment?.clientId));
  const barber = barbers.find((item) => String(item.id) === String(appointment?.barberId));
  const normalizedTargetDate = standardizeDate(targetDate);
  const today = getTodayString();
  const isSameDate = normalizedTargetDate === standardizeDate(appointment?.date);
  const isSameTime = targetTime === appointment?.time;
  const hasConflict = hasAppointmentBarberConflict({
    appointments,
    appointment,
    targetBarberId: appointment?.barberId,
    targetDate,
    targetTime,
  });

  const freeSlots = HOURS.filter((time) => {
    if (isSameDate && time === appointment?.time) return true;
    return !hasAppointmentBarberConflict({
      appointments,
      appointment,
      targetBarberId: appointment?.barberId,
      targetDate,
      targetTime: time,
    });
  });

  if (!appointment) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!targetDate || !targetTime || hasConflict || (isSameDate && isSameTime)) return;
    onSave(appointment.id, targetDate, targetTime);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <CalendarCheck size={21} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Mover turno</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {getAppointmentDisplayClientName(appointment, client)} - {barber?.name || 'Sin barbero'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Fecha</span>
            <input
              type="date"
              min={today}
              value={targetDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setTargetDate(nextDate);
                const firstFree = HOURS.find((time) => !hasAppointmentBarberConflict({
                  appointments,
                  appointment,
                  targetBarberId: appointment.barberId,
                  targetDate: nextDate,
                  targetTime: time,
                }));
                setTargetTime(firstFree || appointment.time || '09:00');
              }}
              className="w-full rounded-2xl border border-slate-800 bg-black px-5 py-4 text-sm font-black italic text-white outline-none focus:border-indigo-500"
            />
          </label>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Horarios libres</p>
            {freeSlots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {freeSlots.map((time) => {
                  const selected = targetTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setTargetTime(time)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black italic transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-600 text-white'
                          : 'border-slate-800 bg-black text-slate-300 hover:border-indigo-500/40'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-black/40 p-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                No hay horarios libres para ese día.
              </div>
            )}
          </div>

          {hasConflict && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase italic leading-relaxed text-rose-200">
              Ese horario ya está ocupado para este barbero.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 bg-black/40 p-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:text-white">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!targetDate || !targetTime || hasConflict || (isSameDate && isSameTime)}
            className="flex-1 rounded-2xl bg-indigo-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar nuevo horario
          </button>
        </div>
      </form>
    </div>
  );
}

function AppointmentActionsModal({ appointment, clients, barbers, onClose, onUpdate, onMove, onTransfer, onEdit, onCancel, onMarkLost }) {
  if (!appointment) return null;

  const client = clients.find((item) => String(item.id) === String(appointment.clientId));
  const barber = barbers.find((item) => String(item.id) === String(appointment.barberId));
  const hasArrived = !!appointment.checkInAt;
  const isClosed = appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida' || appointment.status === 'Cancelada';
  const canMarkLost = appointment.type === 'reserva' && appointment.status === 'Confirmada';

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${barber?.bg || 'bg-slate-800'} text-sm font-black italic text-white`}>
              {barber?.avatar || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black uppercase italic tracking-tight text-white">{getAppointmentDisplayClientName(appointment, client)}</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {appointment.time || '--:--'} - {getAppointmentClientMetaLabel(appointment) || normalizeFavoriteServiceName(appointment.service) || 'Servicio'} - {barber?.name || 'Sin barbero'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <button
            type="button"
            disabled={isClosed}
            onClick={() => onEdit(appointment)}
            className="flex w-full items-center justify-between rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-4 text-left transition-all hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Editar cita</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Cambiar cliente, servicio, fecha, hora o barbero</span>
            </span>
            <Pencil size={18} className="text-cyan-200" />
          </button>
          <button
            type="button"
            disabled={isClosed}
            onClick={() => onMove(appointment)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600/10 px-5 py-4 text-left transition-all hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Mover horario</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Reubicar a un turno libre</span>
            </span>
            <CalendarCheck size={18} className="text-indigo-300" />
          </button>

          <button
            type="button"
            disabled={isClosed}
            onClick={() => onTransfer(appointment)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600/10 px-5 py-4 text-left transition-all hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Trasladar barbero</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Mover este turno a otro profesional</span>
            </span>
            <Repeat size={18} className="text-indigo-300" />
          </button>

          {canMarkLost && (
            <button
              type="button"
              onClick={() => onMarkLost(appointment)}
              className="flex w-full items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-left transition-all hover:bg-amber-500/20"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Marcar cita perdida</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Usa el mismo estado del vencimiento automático</span>
              </span>
              <UserX size={18} className="text-amber-300" />
            </button>
          )}

          {appointment.type === 'reserva' && !hasArrived && !isClosed && (
            <button
              type="button"
              onClick={() => onUpdate(appointment.id, 'En Espera')}
              className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600 px-5 py-4 text-left transition-all hover:bg-indigo-500"
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Marcar llegada</span>
              <UserCheck size={18} />
            </button>
          )}

          {!isClosed && (
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="flex w-full items-center justify-between rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-left transition-all hover:bg-rose-500/20"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">{appointment.type === 'walkin' ? 'Cancelar servicio' : 'Cancelar cita'}</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quitar este turno de la operación activa</span>
              </span>
              <X size={18} className="text-rose-300" />
            </button>
          )}

          {isClosed && (
            <div className="rounded-2xl border border-slate-800 bg-black/40 p-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Este turno ya está cerrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CashWithdrawalModal({ onClose, onSave, barbers, initial }) {
  const availableBarbers = useMemo(() => ((barbers && barbers.length > 0) ? barbers : []), [barbers]);
  const [form, setForm] = useState({
    barberId: initial?.barberId || availableBarbers[0]?.id || '',
    amount: CASH_WITHDRAWAL_QUICK_AMOUNTS[0],
    customAmount: '',
    note: '',
  });
  const [modalError, setModalError] = useState('');
  const selectedAmount = Number(form.customAmount || form.amount || 0);
  const selectedBarber = useMemo(
    () => availableBarbers.find((barber) => String(barber.id) === String(form.barberId)) || availableBarbers[0] || null,
    [availableBarbers, form.barberId],
  );
  const selectedBarberBg = selectedBarber?.bg || 'bg-indigo-600';
  const selectedBarberBorder = selectedBarber?.color || 'border-indigo-500';

  const handleQuickAmount = (amount) => {
    setForm((prev) => ({ ...prev, amount, customAmount: '' }));
    setModalError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.barberId) {
      setModalError('Selecciona el barbero que tomó dinero de caja.');
      return;
    }
    if (selectedAmount <= 0) {
      setModalError('Ingresa un monto válido para registrar el retiro.');
      return;
    }

    onSave({
      barberId: form.barberId,
      amount: selectedAmount,
      note: form.note,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${selectedBarberBg} text-white border border-cyan-300/15`}>
              <Wallet size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">Adelanto de barbero</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Dinero tomado hoy, se descuenta al liquidar</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 space-y-4">
          {modalError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase tracking-widest text-rose-300">
              {modalError}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">1. Barbero</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {availableBarbers.map((barber) => {
                const active = String(form.barberId) === String(barber.id);
                return (
                  <button
                    type="button"
                    key={barber.id}
                    onClick={() => setForm((prev) => ({ ...prev, barberId: barber.id }))}
                    className={`rounded-[1.15rem] border-2 p-3 text-center transition-all active:scale-95 ${active ? `${barber.color} ${barber.bg} text-white shadow-lg` : 'border-slate-800 bg-black/70 hover:border-indigo-400/50'}`}
                  >
                    <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white/20' : (barber.bg || 'bg-slate-800')} text-[10px] font-black italic text-white`}>
                      {barber.avatar || '?'}
                    </div>
                    <p className="mt-3 truncate text-[10px] font-black uppercase italic tracking-widest text-white">{barber.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">2. Monto</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CASH_WITHDRAWAL_QUICK_AMOUNTS.map((amount) => {
                const active = !form.customAmount && Number(form.amount) === Number(amount);
                return (
                  <button
                    type="button"
                    key={amount}
                    onClick={() => handleQuickAmount(amount)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black italic transition-all active:scale-95 ${active ? `${selectedBarberBorder} ${selectedBarberBg} text-white shadow-lg` : 'border-slate-800 bg-black/70 text-white hover:border-white/30 hover:bg-white/5'}`}
                  >
                    C$ {amount}
                  </button>
                );
              })}
            </div>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.customAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, customAmount: event.target.value }))}
              className="w-full rounded-2xl border border-slate-800 bg-black px-4 py-3.5 text-sm font-black uppercase italic text-white outline-none transition-all focus:border-indigo-400"
              placeholder="OTRO MONTO"
            />
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">3. Nota opcional</p>
            <input
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="w-full rounded-2xl border border-slate-800 bg-black px-4 py-3.5 text-sm font-bold text-white outline-none transition-all focus:border-indigo-400"
              placeholder="Ej. comida, adelanto, transporte"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-800 bg-black px-5 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Adelanto a descontar</p>
            <p className="mt-1 text-3xl font-black italic text-white">C$ {selectedAmount.toLocaleString()}</p>
          </div>
          <button
            type="submit"
            disabled={!form.barberId || selectedAmount <= 0}
            className={`rounded-2xl ${selectedBarberBg} px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Registrar adelanto
          </button>
        </div>
      </form>
    </div>
  );
}

function PayrollHistoryModal({ data, onClose }) {
  if (!data?.barber) return null;

  const { barber, settlements = [] } = data;
  const totalPaid = settlements.reduce((sum, settlement) => sum + (Number(settlement.total) || 0), 0);
  const totalAdvances = settlements.reduce((sum, settlement) => sum + (Number(settlement.withdrawalsTotal) || 0), 0);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${barber.bg || 'bg-indigo-600'} text-sm font-black italic text-white`}>
              {barber.avatar || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">Historial de pagos</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{barber.fullName || barber.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-black/35 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Pagos registrados</p>
            <p className="mt-2 text-2xl font-black italic text-white">{settlements.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Total pagado</p>
            <p className="mt-2 text-2xl font-black italic text-emerald-300">C$ {totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">Adelantos descontados</p>
            <p className="mt-2 text-2xl font-black italic text-amber-300">C$ {totalAdvances.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5">
          {settlements.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-black/35 p-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              Este barbero todavía no tiene pagos confirmados.
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => {
                const paidDate = settlement.paidAt ? new Date(settlement.paidAt) : null;
                const hasDate = paidDate && !Number.isNaN(paidDate.getTime());
                return (
                  <div key={settlement.id} className="rounded-[1.5rem] border border-slate-800 bg-black/35 p-4 md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase italic text-white">
                          {hasDate ? paidDate.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha sin registrar'}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          {hasDate ? paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'} �- {settlement.type === 'staff' ? 'Liquidación de planilla' : 'Pago individual'} �- {settlement.pendingServices || 0} servicios
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-right">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">Bruto</p>
                          <p className="mt-1 whitespace-nowrap text-sm font-black italic text-white">C$ {Number(settlement.grossTotal || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">Adelantos</p>
                          <p className="mt-1 whitespace-nowrap text-sm font-black italic text-amber-300">- C$ {Number(settlement.withdrawalsTotal || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">Pagado</p>
                          <p className="mt-1 whitespace-nowrap text-base font-black italic text-emerald-300">C$ {Number(settlement.total || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAppointmentModal({ onClose, onSave, barbers, initial, appointments }) {
  const availableBarbers = (barbers && barbers.length > 0) ? barbers : [];
  const [form, setForm] = useState({
    date: initial?.date || getTodayString(),
    time: initial?.time || getCurrentTimeHHmm(),
    barberId: initial?.barberId || availableBarbers[0]?.id || '',
    service: 'POR DEFINIR',
    price: 0,
    durationMinutes: 30,
  });
  const [modalError, setModalError] = useState('');

  const getWalkinQueueTime = (barberId, date) => resolveWalkinQueueTime({ appointments, barberId, date });

  const handleSelectBarber = (barberId) => {
    const nextDate = getTodayString();
    setForm((prev) => ({
      ...prev,
      barberId,
      date: nextDate,
      time: getWalkinQueueTime(barberId, nextDate),
    }));
    setModalError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.barberId) {
      setModalError('Selecciona un barbero para agendar rápido.');
      return;
    }

    onSave({
      ...form,
      service: 'POR DEFINIR',
      price: 0,
      durationMinutes: 30,
      date: getTodayString(),
      time: getWalkinQueueTime(form.barberId, getTodayString()),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Zap size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">Agendar rápido</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Cliente gen&eacute;rico - sin guardar ficha</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-6">
          {modalError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase tracking-widest text-rose-300">
              {modalError}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">1. Barbero</p>
            {availableBarbers.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                No hay barberos activos.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableBarbers.map((barber) => {
                  const active = String(form.barberId) === String(barber.id);
                  return (
                    <button
                      type="button"
                      key={barber.id}
                      onClick={() => handleSelectBarber(barber.id)}
                      className={`rounded-[1.25rem] border-2 p-4 text-center transition-all active:scale-95 ${active ? `${barber.color} bg-indigo-600/15 shadow-lg` : 'border-slate-800 bg-black hover:border-slate-600'}`}
                    >
                      <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${barber.bg || 'bg-slate-800'} text-xs font-black italic text-white`}>
                        {barber.avatar || '?'}
                      </div>
                      <p className="mt-3 truncate text-[10px] font-black uppercase italic tracking-widest text-white">{barber.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <div className="border-t border-slate-800 bg-black px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Siguiente paso</p>
            <p className="mt-1 text-3xl font-black italic text-white">Cobrar ahora</p>
          </div>
          <button
            type="submit"
            disabled={!form.barberId}
            className="rounded-2xl bg-emerald-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Abrir cobro
          </button>
        </div>
      </form>
    </div>
  );
}

function AppointmentModal({ onClose, onSave, services, clients, barbers, initial, appointments }) {
  const availableBarbers = (barbers && barbers.length > 0) ? barbers : [];
  const initialClient = initial?.client || (initial?.clientId ? (clients || []).find((client) => String(client.id) === String(initial.clientId)) : null);
  const isPendingWebClient = isWebAppointment(initial) && initial?.needsClientConfirmation;
  const initialIsGenericClient = !isPendingWebClient && !initialClient && (initial?.clientName === GENERIC_CLIENT_NAME || initial?.clientId === null);
  const initialServiceName = initial?.service || '';
  const initialWebGuestName = isWebAppointment(initial) ? (initial?.guestName || '') : '';
  const initialWebGuestPhone = isWebAppointment(initial) ? (initial?.guestPhone || '') : '';
  const [searchTerm, setSearchTerm] = useState(initialClient?.name || initialWebGuestName || '');
  const [phoneVal, setPhoneVal] = useState(formatPhoneNumber(initialClient?.phone || initialWebGuestPhone || ''));
  const [selectedClient, setSelectedClient] = useState(initialClient || null);
  const [skipClientData, setSkipClientData] = useState(initialIsGenericClient);
  const [showResults, setShowResults] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [serviceSearch, setServiceSearch] = useState(initialServiceName);
  const [showServiceList, setShowServiceList] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    date: initial?.date || getTodayString(), 
    time: initial?.time || '09:00', 
    barberId: initial?.barberId || availableBarbers[0]?.id || '', 
    service: initial?.service || '', 
    price: initial?.price || 0,
    durationMinutes: Number(initial?.durationMinutes) > 0 ? Number(initial.durationMinutes) : 30,
    type: initial?.type || 'reserva'
  });
  const wrapperRef = useRef(null);
  const serviceRef = useRef(null);
  useEffect(() => { 
    function handleClickOutside(event) { 
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowResults(false); 
      if (serviceRef.current && !serviceRef.current.contains(event.target)) setShowServiceList(false); 
    } 
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside); 
  }, []);
  const filteredClients = useMemo(() => {
    if (skipClientData || selectedClient) return [];
    const nameQuery = searchTerm.trim().toLowerCase();
    const phoneQueryFromSearch = getPhoneDigits(searchTerm);
    const phoneQueryFromField = getPhoneDigits(phoneVal);
    if (nameQuery.length < 2 && phoneQueryFromSearch.length < 2 && phoneQueryFromField.length < 2) return [];
    return (clients || []).filter((client) => {
      const clientName = String(client.name || '').toLowerCase();
      const clientPhone = getPhoneDigits(client.phone || '');
      return (nameQuery.length >= 2 && clientName.includes(nameQuery))
        || (phoneQueryFromSearch.length >= 2 && clientPhone.includes(phoneQueryFromSearch))
        || (phoneQueryFromField.length >= 2 && clientPhone.includes(phoneQueryFromField));
    });
  }, [searchTerm, phoneVal, clients, selectedClient, skipClientData]);
  const filteredServices = useMemo(
    () => (services || []).filter((service) => !isPromotionService(service) && service.name.toLowerCase().includes(serviceSearch.toLowerCase())),
    [services, serviceSearch],
  );
  const isNewClient = !skipClientData && searchTerm.trim().length >= 3 && filteredClients.length === 0 && !selectedClient;
  const shouldShowClientPhoneField = !skipClientData && (isPendingWebClient || selectedClient || isNewClient);
  const duplicatePhoneClient = useMemo(() => {
    if (!isValidPhoneNumber(phoneVal)) return null;
    return findClientByPhone(clients, phoneVal, selectedClient?.id);
  }, [clients, phoneVal, selectedClient]);
  const showGenericClientOption = !selectedClient && searchTerm.trim().length === 0;
  const handleToggleSkipClientData = (event) => {
    const checked = event.target.checked;
    setSkipClientData(checked);
    setModalError(null);
    setShowResults(false);
    if (checked) {
      setSelectedClient(null);
      setSearchTerm('');
      setPhoneVal('');
    }
  };
  const handleSelectClient = (c) => { setSelectedClient(c); setSkipClientData(false); setSearchTerm(c.name); setPhoneVal(formatPhoneNumber(c.phone)); setShowResults(false); setModalError(null); };
  const handleSelectService = (s) => { 
    if (s === "POR DEFINIR") { 
      setForm({ ...form, service: "POR DEFINIR", price: 0, durationMinutes: 30 }); 
      setServiceSearch("POR DEFINIR"); 
    } else { 
      setForm({
        ...form,
        service: s.name,
        price: s.price,
        durationMinutes: Number(s.durationMinutes) > 0 ? Number(s.durationMinutes) : 30,
      }); 
      setServiceSearch(s.name); 
    } 
    setShowServiceList(false); setModalError(null); 
  };
  
  const toMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getWalkinQueueTime = (barberId, date) => {
    return resolveWalkinQueueTime({ appointments, barberId, date });
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setModalError(null); 

    if (!form.barberId) {
      setModalError('Debes tener al menos un barbero activo en esta sucursal para registrar la cita.');
      return;
    }
    
    const selectedDateTime = new Date(`${form.date}T${form.time}:00`);
    const now = new Date();
    
    if (form.type !== 'walkin' && selectedDateTime < new Date(now.getTime() - 5 * 60000)) {
      setModalError('No puedes agendar una cita en el pasado. Elige hora futura.');
      return;
    }

    const newStartMinutes = toMinutes(form.time);
    const newDurationMinutes = Number(form.durationMinutes) > 0 ? Number(form.durationMinutes) : 30;
    const newEndMinutes = newStartMinutes + newDurationMinutes;
    const hasReservationConflict = form.type !== 'walkin' && (appointments || []).some(a => {
      if (String(a.id) === String(initial?.id || '')) return false;
      if (standardizeDate(a.date) !== standardizeDate(form.date) || String(a.barberId) !== String(form.barberId) || a.status === 'Cancelada' || a.status === 'Finalizada' || a.status === 'Cita Perdida') return false;
      const existingStartMinutes = toMinutes(a.time);
      const existingDurationMinutes = Number(a.durationMinutes) > 0 ? Number(a.durationMinutes) : 30;
      const existingEndMinutes = existingStartMinutes + existingDurationMinutes;
      return newStartMinutes < existingEndMinutes && existingStartMinutes < newEndMinutes;
    });

    if (hasReservationConflict) { 
      setModalError(`Este barbero ya tiene una cita que se solapa con el horario ${form.time}.`); 
      return; 
    } 
    
    if (!form.service) { setModalError("Por favor elige un servicio."); return; } 
    if (isPendingWebClient && skipClientData) { setModalError("Esta reserva web necesita confirmar cliente antes de continuar."); return; }
    if (!skipClientData && !selectedClient && filteredClients.length > 0) { setModalError("Selecciona una coincidencia existente o modifica los datos para crear un cliente nuevo."); return; }
    if (!skipClientData && (selectedClient || isNewClient) && phoneVal.trim() && !isValidPhoneNumber(phoneVal)) { setModalError("El celular debe tener exactamente 8 dígitos."); return; }
    if (!skipClientData && isNewClient && !phoneVal.trim()) { setModalError("Ingresa el número de celular del nuevo cliente."); return; }
    if (!skipClientData && isNewClient && duplicatePhoneClient) { setModalError(`Ese número ya está registrado con ${duplicatePhoneClient.name}.`); return; }
    
    onSave(form, skipClientData
      ? { id: null, name: GENERIC_CLIENT_NAME, phone: '', isNew: false, skipRegistration: true }
      : { name: searchTerm, phone: formatPhoneNumber(phoneVal), id: selectedClient?.id, isNew: isNewClient }
    ); 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8 animate-in fade-in text-white no-print">
      <div className="appointment-modal bg-slate-950 w-full max-w-4xl rounded-[2.25rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-black border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-4 text-white">
                <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-white">
                    {form.type === 'walkin' ? <Zap size={22}/> : <CalendarIcon size={22}/>}
            </div>
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white leading-none">
                {initial?.id ? 'EDITAR CITA' : form.type === 'walkin' ? 'NUEVO TURNO (SIN CITA)' : 'RESERVAR TURNO'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-900 rounded-xl text-slate-500 text-white"><X size={24} strokeWidth={3} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-white">
          {modalError && <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl flex items-center gap-3 text-rose-500 text-[10px] font-black uppercase italic leading-none">{modalError}</div>}
          {isPendingWebClient && (
            <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-3 text-cyan-100">
              <p className="text-[10px] font-black uppercase italic tracking-[0.22em] text-cyan-300 leading-none">Reserva web pendiente de confirmar</p>
              <p className="mt-2 text-[11px] font-bold text-cyan-50 leading-snug">
                Busca por nombre o celular. Si ya existe, selecciona el cliente; si no existe, guarda la ficha nueva antes de iniciar el corte.
              </p>
              <p className="mt-2 text-[10px] font-black uppercase italic tracking-[0.12em] text-cyan-200 leading-tight">
                {initialWebGuestName || 'Sin nombre'} {initialWebGuestPhone ? `- ${formatPhoneNumber(initialWebGuestPhone)}` : ''}
              </p>
            </div>
          )}
          <div className="space-y-3 text-white">
            <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">1. ELIGE BARBERO PROFESIONAL</label>
            {availableBarbers.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-slate-400">
                <p className="text-[11px] font-black uppercase italic leading-none">No hay barberos activos en esta sucursal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-white">
                {availableBarbers.map(b => (
                  <div key={b.id} onClick={() => setForm((prev) => {
                    const nextBarberId = b.id;
                    const nextTime = prev.type === 'walkin' ? getWalkinQueueTime(nextBarberId, prev.date) : prev.time;
                    return { ...prev, barberId: nextBarberId, time: nextTime };
                  })} className={`p-3 rounded-[1.35rem] border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-2 justify-center relative ${form.barberId === b.id ? `${b.color} bg-indigo-600/10 shadow-lg scale-[1.02]` : 'border-slate-800 bg-black'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black italic shadow-xl text-[11px] text-white ${b.bg}`}>{b.avatar}</div>
                    <p className="text-[9px] font-black uppercase italic text-white leading-tight truncate max-w-full">{b.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-white">
            <div className="space-y-3 text-white" ref={wrapperRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">2. DATOS DEL CLIENTE</label>
              <div className="space-y-3 text-white relative">
                <input disabled={skipClientData} required={!skipClientData} className={`w-full bg-black border border-slate-800 p-4 text-sm font-black uppercase italic text-white outline-none focus:border-indigo-600 leading-none disabled:cursor-not-allowed disabled:opacity-50 ${showResults && filteredClients.length > 0 ? 'rounded-t-[1.2rem] rounded-b-none' : 'rounded-[1.2rem]'}`} placeholder={skipClientData ? 'CLIENTE GEN\u00c9RICO' : 'BUSCAR NOMBRE O CELULAR'} value={skipClientData ? 'CLIENTE GEN\u00c9RICO' : searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedClient(null); setShowResults(true); }} onFocus={() => { if (!skipClientData) setShowResults(true); }} />
                {showGenericClientOption && (
                  <label className="ml-auto flex w-fit cursor-pointer select-none items-center gap-2 rounded-full px-1 text-[9px] font-black uppercase italic tracking-[0.14em] text-slate-400 transition-colors hover:text-white">
                    <input
                      type="checkbox"
                      checked={skipClientData}
                      onChange={handleToggleSkipClientData}
                      className="h-3 w-3 rounded border-slate-400 accent-emerald-500"
                    />
                    Cliente gen&eacute;rico
                  </label>
                )}
                {showResults && !skipClientData && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-slate-900 border border-t-0 border-slate-700 rounded-b-[1.2rem] shadow-2xl z-50 overflow-hidden text-white">
                    {filteredClients.map(c => (
                      <div key={c.id} onClick={() => handleSelectClient(c)} className="flex items-center justify-between gap-4 p-4 hover:bg-indigo-600 cursor-pointer border-b border-slate-800 text-white">
                        <span className="text-xs font-black uppercase italic text-white">{c.name}</span>
                        <span className="text-[10px] font-black uppercase italic text-cyan-200">{formatPhoneNumber(c.phone || '')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {isNewClient && !selectedClient && (
                  <div className="mt-2 p-3 rounded-xl bg-orange-500 border border-orange-400 text-white font-black uppercase tracking-wider text-sm text-center shadow-[0_0_20px_rgba(255,159,67,0.65)] animate-pulse ring-2 ring-orange-300/60 leading-none">
                    <span className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">¡Nuevo cliente detectado!</span>
                  </div>
                )}
                {shouldShowClientPhoneField && (
                  <input required type="tel" className="w-full bg-black border-2 border-indigo-600/40 p-4 rounded-[1.2rem] text-sm font-black text-white italic leading-none" placeholder="TELEFONO 0000-0000" value={phoneVal} onFocus={() => { if (!skipClientData && !selectedClient) setShowResults(true); }} onChange={e => { setPhoneVal(formatPhoneNumber(e.target.value)); setSelectedClient(null); setShowResults(true); }} />
                )}
              </div>
            </div>
            <div className="space-y-3 text-white" ref={serviceRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">3. SERVICIO Y HORARIO</label>
              <div className="space-y-3 text-white">
                <div className="relative text-white">
                  <input className="w-full bg-black border border-slate-800 p-4 rounded-[1.2rem] text-sm font-black uppercase italic text-white outline-none focus:border-emerald-600 leading-none" placeholder="ELEGIR SERVICIO" value={serviceSearch} onChange={(e) => { setServiceSearch(e.target.value); setShowServiceList(true); }} onFocus={() => setShowServiceList(true)} />
                {showServiceList && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-slate-900 border border-slate-700 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden text-white">
                    <div className="max-h-52 overflow-y-auto inner-scrollbar p-2 text-white">
                      <div onClick={() => handleSelectService("POR DEFINIR")} className="p-3.5 hover:bg-emerald-600/20 rounded-[1rem] cursor-pointer text-emerald-400 text-[10px] font-black uppercase italic leading-none">--- DEFINIR EN CAJA ---</div>
                      {filteredServices.length === 0 ? (
                        <div className="p-3.5 text-slate-400 text-[10px] font-black uppercase italic leading-none">No se encontraron servicios.</div>
                      ) : filteredServices.map(s => (
                        <div key={s.id} onClick={() => handleSelectService(s)} className="flex items-center justify-between p-3.5 hover:bg-indigo-600 rounded-[1rem] cursor-pointer text-white text-white"><span className="text-xs font-black uppercase italic text-white">{s.name}</span><span className="text-[10px] font-black italic text-emerald-400">C$ {s.price}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-white">
                <input
                  type="date"
                  className="w-full bg-black border border-slate-800 py-3.5 px-5 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic"
                  value={form.date}
                  onChange={e => setForm((prev) => {
                    const nextDate = e.target.value;
                    const nextTime = prev.type === 'walkin' ? getWalkinQueueTime(prev.barberId, nextDate) : prev.time;
                    return { ...prev, date: nextDate, time: nextTime };
                  })}
                />
                {form.type === 'walkin' ? (
                  <div className="w-full bg-indigo-600/10 border border-indigo-500/30 py-3.5 px-5 rounded-[1.2rem] flex items-center gap-2 text-white">
                    <Clock size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black text-indigo-400 uppercase italic leading-none">Cola (auto): {form.time || '--:--'}</span>
                  </div>
                ) : (
                  <input type="time" className="w-full bg-black border border-slate-800 py-3.5 px-5 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                )}
              </div>
              </div>
            </div>
          </div>
          <div className="pt-5 border-t border-slate-900 flex justify-between items-center gap-4 text-white">
            <div className="flex flex-col text-white"><span className="text-[9px] font-black text-slate-500 uppercase italic mb-1.5 leading-none">MONTO ESTIMADO</span><h4 className="text-3xl md:text-4xl font-black italic text-white leading-none"><span className="text-emerald-500 mr-2 text-white">C$</span>{(Number(form.price) || 0).toLocaleString()}</h4></div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase text-[11px] italic transition-all text-white leading-none">{initial?.id ? 'GUARDAR CAMBIOS' : 'RESERVAR ESPACIO'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}





