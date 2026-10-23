"use client"

// Access token muddati tez tugaydi (15 daqiqa). Server 401 + code:
// "TOKEN_EXPIRED" qaytarsa, shu yordamchi /api/auth/refresh'ni chaqirib
// (refresh_token httpOnly cookie orqali) yangi access token oladi va
// asl so'rovni bir marta qayta yuboradi. Foydalanuvchi buni sezmaydi.

let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let res = await fetch(input, init)

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => null)
    if (body?.code === "TOKEN_EXPIRED") {
      const refreshed = await tryRefresh()
      if (refreshed) {
        res = await fetch(input, init)
      }
    }
  }

  return res
}
