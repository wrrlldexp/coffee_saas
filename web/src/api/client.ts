let activeOrgId: string | null = null

export function setActiveOrg(orgId: string | null) {
  activeOrgId = orgId
}

export function getActiveOrg(): string | null {
  return activeOrgId
}

interface ApiResponse<T> {
  ok: true
  data: T
}

interface ApiError {
  ok: false
  error: { code: string; message: string }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const headers: Record<string, string> = {}

  if (activeOrgId) {
    headers['x-org-id'] = activeOrgId
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  })

  if (res.status === 401) {
    window.location.href = '/login'
    return null
  }

  const json = (await res.json()) as ApiResult<T>

  if (!json.ok) {
    throw new Error(json.error.message)
  }

  return json.data
}
