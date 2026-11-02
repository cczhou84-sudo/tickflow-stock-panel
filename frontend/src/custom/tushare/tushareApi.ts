// Tushare 分析 API 客户端（同源 /api/tushare）

export interface TushareStatus {
  configured: boolean
  tokenMask: string
}

export interface SearchResult {
  ts_code: string
  symbol: string | null
  name: string
  industry: string | null
  market: string | null
}

export interface FinancialPeriod {
  end_date: string
  eps: number | null
  bps: number | null
  roe: number | null
  roe_dt: number | null
  roa: number | null
  grossprofit_margin: number | null
  netprofit_margin: number | null
  debt_to_assets: number | null
  current_ratio: number | null
  assets_turn: number | null
  ocfps: number | null
  netprofit_yoy: number | null
  tr_yoy: number | null
}

export interface MoneyflowDay {
  trade_date: string
  net_mf: number | null
  sm_net: number | null
  md_net: number | null
  lg_net: number | null
  elg_net: number | null
}

export interface NorthDay {
  trade_date: string
  hgt: number | null
  sgt: number | null
  north: number | null
  south: number | null
}

export interface DragonItem {
  ts_code: string
  name: string
  close: number | null
  pct_change: number | null
  turnover_rate: number | null
  l_buy: number | null
  l_sell: number | null
  net_amount: number | null
  net_rate: number | null
  amount_rate: number | null
  reason: string
}

export interface HolderItem {
  end_date: string
  ann_date: string
  holder_num: number | null
  change: number | null
}

export interface HolderTradeItem {
  ann_date: string
  holder_name: string
  holder_type: string
  in_de: string
  change_vol: number | null
  change_ratio: number | null
  avg_price: number | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

const qs = (p: Record<string, string | number>) =>
  '?' + new URLSearchParams(p as Record<string, string>).toString()

export const tushareApi = {
  status: () => request<TushareStatus>('/api/tushare/status'),
  saveToken: (token: string) =>
    request<{ ok: boolean; tokenMask: string }>('/api/tushare/token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  clearToken: () => request<{ ok: boolean }>('/api/tushare/token', { method: 'DELETE' }),

  search: (q: string, limit = 20) =>
    request<{ results: SearchResult[] }>('/api/tushare/search' + qs({ q, limit })),
  resolve: (code: string) =>
    request<{ ts_code: string; name: string | null; industry: string | null }>(
      '/api/tushare/resolve' + qs({ code }),
    ),

  financial: (ts_code: string) =>
    request<{ ts_code: string; empty: boolean; periods: FinancialPeriod[] }>(
      '/api/tushare/financial' + qs({ ts_code }),
    ),
  moneyflow: (ts_code: string) =>
    request<{ ts_code: string; unit: string; empty: boolean; total_net: number; daily: MoneyflowDay[] }>(
      '/api/tushare/moneyflow' + qs({ ts_code }),
    ),
  north: () =>
    request<{ unit: string; empty: boolean; daily: NorthDay[] }>('/api/tushare/north'),
  dragon: (trade_date: string) =>
    request<{ trade_date: string; unit: string; empty: boolean; items: DragonItem[] }>(
      '/api/tushare/dragon' + qs({ trade_date }),
    ),
  holders: (ts_code: string) =>
    request<{ ts_code: string; empty: boolean; items: HolderItem[] }>(
      '/api/tushare/holders' + qs({ ts_code }),
    ),
  holdertrade: (ts_code: string) =>
    request<{ ts_code: string; empty: boolean; vol_unit: string; items: HolderTradeItem[] }>(
      '/api/tushare/holdertrade' + qs({ ts_code }),
    ),
}
