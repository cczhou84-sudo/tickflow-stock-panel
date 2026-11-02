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

// ---------- 三大报表（金额原始单位元，前端转亿元） ----------

export interface IncomePeriod {
  end_date: string
  total_revenue: number | null
  revenue: number | null
  oper_cost: number | null
  sell_exp: number | null
  admin_exp: number | null
  fin_exp: number | null
  rd_exp: number | null
  operate_profit: number | null
  total_profit: number | null
  income_tax: number | null
  n_income: number | null
  n_income_attr_p: number | null
  minority_gain: number | null
}

export interface BalancePeriod {
  end_date: string
  money_cap: number | null
  accounts_receiv: number | null
  inventories: number | null
  total_cur_assets: number | null
  total_nca: number | null
  total_assets: number | null
  accounts_pay: number | null
  total_cur_liab: number | null
  total_liab: number | null
  total_hldr_eqy_exc_min_int: number | null
  goodwill: number | null
  lt_borr: number | null
}

export interface CashflowPeriod {
  end_date: string
  c_fr_sale_sg: number | null
  n_cashflow_act: number | null
  n_cashflow_inv_act: number | null
  n_cash_flows_fnc_act: number | null
  net_profit: number | null
}

export interface BasicValuation {
  trade_date: string
  close: number | null
  turnover_rate: number | null
  turnover_rate_f: number | null
  volume_ratio: number | null
  pe: number | null
  pe_ttm: number | null
  pb: number | null
  ps: number | null
  ps_ttm: number | null
  dv_ratio: number | null
  dv_ttm: number | null
  total_share: number | null
  float_share: number | null
  free_share: number | null
  total_mv: number | null
  circ_mv: number | null
  limit_status: number | null
}

export interface DailyBar {
  trade_date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  pre_close: number | null
  pct_chg: number | null
  vol: number | null
  amount: number | null
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

  income: (ts_code: string) =>
    request<{ ts_code: string; unit: string; empty: boolean; periods: IncomePeriod[] }>(
      '/api/tushare/income' + qs({ ts_code }),
    ),
  balancesheet: (ts_code: string) =>
    request<{ ts_code: string; unit: string; empty: boolean; periods: BalancePeriod[] }>(
      '/api/tushare/balancesheet' + qs({ ts_code }),
    ),
  cashflow: (ts_code: string) =>
    request<{ ts_code: string; unit: string; empty: boolean; periods: CashflowPeriod[] }>(
      '/api/tushare/cashflow' + qs({ ts_code }),
    ),
  basic: (ts_code: string) =>
    request<{ ts_code: string; unit_mv: string; empty: boolean; basic: BasicValuation | null }>(
      '/api/tushare/basic' + qs({ ts_code }),
    ),
  daily: (ts_code: string, limit = 120) =>
    request<{ ts_code: string; empty: boolean; daily: DailyBar[] }>(
      '/api/tushare/daily' + qs({ ts_code, limit }),
    ),
}
