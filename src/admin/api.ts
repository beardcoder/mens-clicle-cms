import type { Issue } from '../fields'

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
		public issues: Issue[] = [],
	) {
		super(message)
	}
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
	onUnauthorized = fn
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
	const isForm = body instanceof FormData
	const res = await fetch(`/api${path}`, {
		method,
		headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
		body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
	})
	const type = res.headers.get('content-type') ?? ''
	const data = type.includes('json') ? await res.json() : await res.text()
	if (!res.ok) {
		if (res.status === 401 && !path.startsWith('/auth')) onUnauthorized()
		const message =
			typeof data === 'string' ? data : (data.message ?? data.detail ?? data.title ?? `Fehler ${res.status}`)
		const issues: Issue[] = data?.issues ?? (data?.on ? [{ path: data.property ?? data.on, message }] : [])
		throw new ApiError(message, res.status, issues)
	}
	return data as T
}

export const get = <T>(path: string) => api<T>(path)
export const post = <T>(path: string, body?: unknown) => api<T>(path, 'POST', body ?? {})
export const put = <T>(path: string, body: unknown) => api<T>(path, 'PUT', body)
export const patch = <T>(path: string, body: unknown) => api<T>(path, 'PATCH', body)
export const del = <T>(path: string) => api<T>(path, 'DELETE')
