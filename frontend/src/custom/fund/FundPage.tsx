import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { fundApi, type Fund, type FundOverview, type FundState } from './fundApi'

function fmtMoney(v: number | null | undefined) {
  if (v == null || isNaN(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | null | undefined) {
  if (v == null || isNaN(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function fmtXirr(v: number | null | undefined) {
  if (v == null || isNaN(v)) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function pnlClass(v: number | null | undefined) {
  if (v == null || isNaN(v)) return 'text-muted'
  return v >= 0 ? 'text-bull' : 'text-bear'
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

function FundRow({ fund }: { fund: Fund }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 hover:bg-elevated/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{fund.name}</div>
        <div className="text-xs text-muted tabular-nums">{fund.code} · {fund.type === 'etf' ? 'ETF' : '场外'}</div>
      </div>
      <div className="w-20 text-right tabular-nums text-sm">{fmtMoney(fund.shares)}</div>
      <div className="w-20 text-right tabular-nums text-sm">{fund.nav != null ? fund.nav.toFixed(4) : '—'}</div>
      <div className={`w-20 text-right tabular-nums text-sm ${pnlClass(fund.chg)}`}>{fmtPct(fund.chg)}</div>
      <div className={`w-20 text-right tabular-nums text-sm ${pnlClass(fund.xirrValue)}`}>{fmtXirr(fund.xirrValue)}</div>
      <div className="w-24 text-right tabular-nums text-sm text-muted">{fund.navDate ?? ''}</div>
    </div>
  )
}

export default function FundPage() {
  const [state, setState] = useState<FundState | null>(null)
  const [overview, setOverview] = useState<FundOverview | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fundApi.getState()
      setState(data.state)
      setOverview(data.overview)
    } catch (e) {
      console.error('加载基金数据失败', e)
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await fundApi.refresh()
      setState(data.state)
      setOverview(data.overview)
    } catch (e) {
      console.error('刷新行情失败', e)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = state?.groups ?? []
  const funds = state?.funds ?? []

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="基金管理"
        subtitle="个人基金持仓与收益"
        right={
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中' : '刷新行情'}
          </button>
        }
      />
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="总市值" value={`¥${fmtMoney(overview?.totalValue)}`} />
          <StatCard
            label="累计盈亏"
            value={`${overview?.totalPnl != null && overview.totalPnl >= 0 ? '+' : ''}${fmtMoney(overview?.totalPnl)}`}
            sub={`成本 ¥${fmtMoney(overview?.totalCost)}`}
          />
          <StatCard label="组合 XIRR" value={fmtXirr(overview?.portfolioXirr)} />
          <StatCard label="基金数量" value={`${overview?.fundCount ?? funds.length}`} />
        </div>
        <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted border-b border-border">
          <div className="flex-1">名称 / 代码</div>
          <div className="w-20 text-right">持仓份额</div>
          <div className="w-20 text-right">净值</div>
          <div className="w-20 text-right">今日涨跌</div>
          <div className="w-20 text-right">XIRR</div>
          <div className="w-24 text-right">净值日期</div>
        </div>
        {groups.map((g) => {
          const list = funds.filter((f) => f.groupId === g.id)
          if (list.length === 0) return null
          return (
            <div key={g.id} className="mt-3">
              <div className="px-4 py-1.5 text-xs font-medium text-muted flex items-center gap-1.5">
                <Wallet size={12} />
                {g.name}
                <span className="text-muted/60">({list.length})</span>
              </div>
              {list.map((f) => <FundRow key={f.code} fund={f} />)}
            </div>
          )
        })}
        {funds.length === 0 && (
          <div className="text-center text-muted text-sm py-10">暂无基金持仓</div>
        )}
      </div>
    </div>
  )
}
