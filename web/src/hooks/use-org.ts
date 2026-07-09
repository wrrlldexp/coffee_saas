import { useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, setActiveOrg, getActiveOrg } from '@/api/client'
import type { MeResponse } from '@/types/api'

const ORG_KEY = 'takt_active_org'

function getSavedOrgId(): string | null {
  return localStorage.getItem(ORG_KEY)
}

function saveOrgId(orgId: string) {
  localStorage.setItem(ORG_KEY, orgId)
}

export function useOrg() {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('GET', '/api/me'),
  })

  const memberships = me?.memberships ?? []
  const activeOrgId = getActiveOrg()
  const activeMembership = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0] ?? null

  useEffect(() => {
    if (!activeOrgId && memberships.length > 0) {
      const savedId = getSavedOrgId()
      const target = memberships.find((m) => m.orgId === savedId) ?? memberships[0]
      setActiveOrg(target.orgId)
      saveOrgId(target.orgId)
    }
  }, [activeOrgId, memberships])

  const switchOrg = useCallback((orgId: string) => {
    setActiveOrg(orgId)
    saveOrgId(orgId)
    window.location.reload()
  }, [])

  return {
    me,
    memberships,
    activeMembership,
    activeOrgId: activeMembership?.orgId ?? null,
    role: activeMembership?.taktRole ?? null,
    isLoading,
    switchOrg,
  }
}
