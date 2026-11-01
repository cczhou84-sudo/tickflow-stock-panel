// 基金管理 API 客户端（同源 /api/fund）

export interface Fund {
  code: string
  name: string
  type: 'otc' | 'etf'
  secid: string
  shares: number
  dayInvest: number
  mtype: string
  groupId: string
  nav: number | null
  navDate: string | null
  chg: number | null
  xirrValue: number | null
  r3: number | null
  r5: number | null
  r10: number | null
  note?: string
}

export interface FundGroup {
  id: string
  name: string
  order: number
}

export interface FundState {
  funds: Fund[]
  groups: FundGroup[]
  transactions: unknown[]
}

export interface FundOverview {
  totalValue: number
  totalCost: number
  totalPnl: number
  portfolioXirr: number | null
  fundCount: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} ${text}`)
  }
  return res.json()
}

export const fundApi = {
  getState: () =>
    request<{ state: FundState; overview: FundOverview }>('/api/fund/state'),

  saveState: (state: FundState) =>
    request<{ ok: boolean; overview: FundOverview }>('/api/fund/state', {
      method: 'PUT',
      body: JSON.stringify(state),
    }),

  refresh: () =>
    request<{ state: FundState; overview: FundOverview }>('/api/fund/refresh', {
      method: 'POST',
    }),

  overview: () => request<FundOverview>('/api/fund/overview'),
}
