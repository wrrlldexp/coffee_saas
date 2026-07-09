import type { TaktRole } from '@/types/api'

const ROLE_LEVELS: Record<TaktRole, number> = {
  OWNER: 100,
  OPS_DIRECTOR: 80,
  HEAD_BARISTA: 60,
  MANAGER: 40,
  BARISTA: 20,
  TRAINEE: 10,
}

export function hasMinRole(current: TaktRole | null, minimum: TaktRole): boolean {
  if (!current) return false
  return ROLE_LEVELS[current] >= ROLE_LEVELS[minimum]
}

export function useRoleCheck(role: TaktRole | null) {
  return {
    isOwner: role === 'OWNER',
    isManager: hasMinRole(role, 'MANAGER'),
    isHeadBarista: hasMinRole(role, 'HEAD_BARISTA'),
    isOpsDirector: hasMinRole(role, 'OPS_DIRECTOR'),
    canManageTeam: hasMinRole(role, 'MANAGER'),
    canManageLocations: hasMinRole(role, 'OPS_DIRECTOR'),
    canViewDashboard: hasMinRole(role, 'MANAGER'),
    canManageProducts: hasMinRole(role, 'HEAD_BARISTA'),
  }
}
