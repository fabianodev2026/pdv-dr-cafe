export type PdvRole = 'admin' | 'gerente' | 'caixa' | 'garcom' | 'suporte_tecnico'

export interface CurrentUser {
  id?: number
  username: string
  role: string
}

export const ROLE_LABELS: Record<PdvRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  caixa: 'Caixa',
  garcom: 'Garcom',
  suporte_tecnico: 'Suporte tecnico',
}

export const ADMIN_ROLES: PdvRole[] = ['admin']
export const MANAGER_ROLES: PdvRole[] = ['admin', 'gerente']
export const CASHIER_ROLES: PdvRole[] = ['admin', 'gerente', 'caixa']
export const OPERATION_ROLES: PdvRole[] = ['admin', 'gerente', 'caixa', 'garcom']
export const DIAGNOSTIC_ROLES: PdvRole[] = ['admin', 'gerente', 'suporte_tecnico']
export const SUPPORT_ROLES: PdvRole[] = ['suporte_tecnico']

export function hasRole(currentUser: CurrentUser, allowedRoles: readonly PdvRole[]) {
  return allowedRoles.includes(currentUser.role as PdvRole)
}

export function getHomePath(currentUser: CurrentUser) {
  if (hasRole(currentUser, SUPPORT_ROLES)) return '/suporte-ia'
  return '/mesas'
}
