// Componentes compartidos de la plataforma (cualquier módulo institucional los usa).
export { Icon } from './Icon.jsx';
export { Spinner, LoadingState, ErrorState, EmptyState, Alerta, PendienteIntegracion, TEXTO_PENDIENTE } from './Estados.jsx';
export { Dialogo } from './Dialogo.jsx';
export { NotificationsProvider, ConfirmDialog, useConfirmar, useNotificar } from './Notificaciones.jsx';
export { FormField, BotonEnviar, SearchBar, FilterBar, FormularioVistaPrevia } from './Formularios.jsx';
export { StatusBadge, DataTable, TablaPendiente, StatCard, KeyValue, Pager } from './Datos.jsx';
export { PageHeader, Card, Tabs } from './Pagina.jsx';
export { useCarga, useEnvio } from './hooks.js';

// Nombres anteriores, conservados para el código existente del módulo pediátrico.
export { LoadingState as Cargando, ErrorState as ErrorCarga, EmptyState as Vacio } from './Estados.jsx';
export { FormField as Campo } from './Formularios.jsx';
export { StatusBadge as Badge } from './Datos.jsx';
