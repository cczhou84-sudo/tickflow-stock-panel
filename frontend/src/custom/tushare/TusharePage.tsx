import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { BarChart3, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StockSearchInput } from './StockSearchInput'
import {
  FinancialProfitChart,
  FinancialGrowthChart,
  MoneyflowChart,
  NorthChart,
  HoldersChart,
} from './charts'
import {
  tushareApi,
  type TushareStatus,
  type FinancialPeriod,
  type MoneyflowDay,
  type NorthDay,
  type DragonItem,
  type HolderItem,
  type HolderTradeItem,
} from './tushareApi'

// ---------- 格式化 ----------
function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || isNaN(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}
function signClass(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'text-muted'
  return v >= 0 ? 'text-bull' : 'text-bear'
}
function periodLabel(end: string): string {
  const m = end.slice(4, 6)
  const year = end.slice(0, 4)
  const tag = m === '12' ? '年报' : m === '06' ? '半年报' : m === '09' ? '三季报' : '一季报'
  return `${year}${tag}`
}

const TABS = ['财务分析', '资金流向', '北向资金', '龙虎榜', '股东研究'] as const
type Tab = (typeof TABS)[number]

// ---------- 通用表格壳 ----------
function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-elevated/50 text-muted text-xs">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ---------- 财务（图表在上，明细表格在下） ----------
function FinancialView({ periods }: { periods: FinancialPeriod[] }) {
  const rows: [string, (p: FinancialPeriod) => string, (p: FinancialPeriod) => string][] = [
    ['每股收益(元)', (p) => fmt(p.eps), () => ''],
    ['每股净资产(元)', (p) => fmt(p.bps), () => ''],
    ['净资产收益率ROE', (p) => fmtPct(p.roe), (p) => signClass(p.roe)],
    ['扣非ROE', (p) => fmtPct(p.roe_dt), (p) => signClass(p.roe_dt)],
    ['总资产报酬率', (p) => fmtPct(p.roa), (p) => signClass(p.roa)],
    ['销售毛利率', (p) => fmtPct(p.grossprofit_margin), (p) => signClass(p.grossprofit_margin)],
    ['销售净利率', (p) => fmtPct(p.netprofit_margin), (p) => signClass(p.netprofit_margin)],
    ['资产负债率', (p) => fmtPct(p.debt_to_assets), () => ''],
    ['流动比率', (p) => fmt(p.current_ratio), () => ''],
    ['总资产周转率', (p) => fmt(p.assets_turn), () => ''],
    ['每股经营现金流', (p) => fmt(p.ocfps), (p) => signClass(p.ocfps)],
    ['营收同比', (p) => fmtPct(p.tr_yoy), (p) => signClass(p.tr_yoy)],
    ['净利润同比', (p) => fmtPct(p.netprofit_yoy), (p) => signClass(p.netprofit_yoy)],
  ]
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface p-3">
        <h3 className="text-sm font-medium mb-1">盈利能力趋势（%）</h3>
        <FinancialProfitChart periods={periods} />
      </div>
      <div className="rounded-card border border-border bg-surface p-3">
        <h3 className="text-sm font-medium mb-1">成长能力同比（%）</h3>
        <FinancialGrowthChart periods={periods} />
      </div>
      <div className="rounded-card border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevated/50 text-muted text-xs">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-elevated/90">指标</th>
              {periods.map((p) => (
                <th key={p.end_date} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {periodLabel(p.end_date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get, cls]) => (
              <tr key={label} className="border-b border-border/50">
                <td className="px-3 py-2 text-muted whitespace-nowrap sticky left-0 bg-surface">{label}</td>
                {periods.map((p) => (
                  <td key={p.end_date} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${cls(p)}`}>
                    {get(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- 资金流 ----------
function MoneyflowView({ data }: { data: MoneyflowDay[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface p-3">
        <h3 className="text-sm font-medium mb-1">分单净额堆叠（万元）+ 净流入折线</h3>
        <MoneyflowChart data={data} />
      </div>
      <Table headers={['交易日期', '净流入', '特大单', '大单', '中单', '小单']}>
        {data.map((d) => (
          <tr key={d.trade_date} className="border-b border-border/50">
            <td className="px-3 py-2 tabular-nums">{d.trade_date}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.net_mf)}`}>{fmt(d.net_mf)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.elg_net)}`}>{fmt(d.elg_net)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.lg_net)}`}>{fmt(d.lg_net)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.md_net)}`}>{fmt(d.md_net)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.sm_net)}`}>{fmt(d.sm_net)}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ---------- 北向 ----------
function NorthView({ data }: { data: NorthDay[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">注：2024年8月后北向实时净买入口径调整，历史数据仅作资金活跃度参考。单位：亿元</p>
      <div className="rounded-card border border-border bg-surface p-3">
        <NorthChart data={data} />
      </div>
      <Table headers={['交易日期', '北向净流入', '沪股通', '深股通', '南向净流入']}>
        {data.map((d) => (
          <tr key={d.trade_date} className="border-b border-border/50">
            <td className="px-3 py-2 tabular-nums">{d.trade_date}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.north)}`}>{fmt(d.north)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.hgt)}`}>{fmt(d.hgt)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.sgt)}`}>{fmt(d.sgt)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.south)}`}>{fmt(d.south)}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ---------- 龙虎榜 ----------
function DragonView({ data }: { data: DragonItem[] }) {
  return (
    <Table headers={['代码', '名称', '涨跌幅', '换手率', '买入', '卖出', '净买入', '上榜理由']}>
      {data.map((d) => (
        <tr key={d.ts_code} className="border-b border-border/50">
          <td className="px-3 py-2 tabular-nums">{d.ts_code}</td>
          <td className="px-3 py-2 whitespace-nowrap">{d.name}</td>
          <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.pct_change)}`}>{fmtPct(d.pct_change)}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmt(d.turnover_rate)}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmt(d.l_buy)}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmt(d.l_sell)}</td>
          <td className={`px-3 py-2 text-right tabular-nums ${signClass(d.net_amount)}`}>{fmt(d.net_amount)}</td>
          <td className="px-3 py-2 text-muted text-xs">{d.reason}</td>
        </tr>
      ))}
    </Table>
  )
}

// ---------- 股东 ----------
function HoldersView({ holders, trades }: { holders: HolderItem[]; trades: HolderTradeItem[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">股东户数变化（户数下降=筹码集中）</h3>
        <div className="rounded-card border border-border bg-surface p-3 mb-2">
          <HoldersChart holders={holders} />
        </div>
        <Table headers={['截止日期', '股东户数', '环比变化']}>
          {holders.map((h) => (
            <tr key={h.end_date} className="border-b border-border/50">
              <td className="px-3 py-2 tabular-nums">{h.end_date}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(h.holder_num, 0)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${signClass(h.change)}`}>
                {h.change == null ? '—' : `${h.change > 0 ? '+' : ''}${h.change}`}
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">重要股东增减持</h3>
        <Table headers={['公告日', '股东', '类型', '方向', '变动(万股)', '占流通比', '均价']}>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="px-3 py-2 tabular-nums">{t.ann_date}</td>
              <td className="px-3 py-2 whitespace-nowrap">{t.holder_name}</td>
              <td className="px-3 py-2 text-muted">{t.holder_type}</td>
              <td className={`px-3 py-2 ${t.in_de === 'IN' ? 'text-bull' : 'text-bear'}`}>
                {t.in_de === 'IN' ? '增持' : '减持'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(t.change_vol)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(t.change_ratio)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(t.avg_price)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}

// ---------- 分场景空态 ----------
function Empty({ variant }: { variant: 'need-code' | 'no-data' | 'date-empty' }) {
  const text =
    variant === 'need-code'
      ? '输入股票代码、中文名或拼音开始查询'
      : variant === 'date-empty'
        ? '该交易日无龙虎榜数据，换一个最近交易日试试'
        : '未查询到该标的对应数据：可能代码有误、该期尚未披露或暂无记录'
  return (
    <div className="rounded-card border border-border bg-surface py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
      <BarChart3 size={28} strokeWidth={1.5} />
      {text}
    </div>
  )
}

// ---------- 主页面 ----------
interface Picked {
  tsCode: string
  name: string
  industry: string | null
}

export default function TusharePage() {
  const [status, setStatus] = useState<TushareStatus | null>(null)
  const [tab, setTab] = useState<Tab>('财务分析')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [dragonDate, setDragonDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [financial, setFinancial] = useState<FinancialPeriod[]>([])
  const [moneyflow, setMoneyflow] = useState<MoneyflowDay[]>([])
  const [north, setNorth] = useState<NorthDay[]>([])
  const [dragon, setDragon] = useState<DragonItem[]>([])
  const [holders, setHolders] = useState<HolderItem[]>([])
  const [trades, setTrades] = useState<HolderTradeItem[]>([])
  const pickedRef = useRef<Picked | null>(null)
  useEffect(() => { pickedRef.current = picked }, [picked])

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await tushareApi.status())
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // 按当前 tab 加载个股/全局数据；成功后清空 error
  const loadForTab = useCallback(async (code: string, activeTab: Tab) => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === '财务分析') setFinancial((await tushareApi.financial(code)).periods)
      else if (activeTab === '资金流向') setMoneyflow((await tushareApi.moneyflow(code)).daily)
      else if (activeTab === '股东研究') {
        const [h, t] = await Promise.all([tushareApi.holders(code), tushareApi.holdertrade(code)])
        setHolders(h.items)
        setTrades(t.items)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadNorth = useCallback(async () => {
    setError('')
    try {
      setNorth((await tushareApi.north()).daily)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const loadDragon = useCallback(async () => {
    if (!dragonDate) return
    setError('')
    try {
      setDragon((await tushareApi.dragon(dragonDate)).items)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [dragonDate])

  // 选中标的（来自搜索下拉）
  const handlePick = useCallback(
    (tsCode: string, name: string, industry: string | null) => {
      setPicked({ tsCode, name, industry })
      void loadForTab(tsCode, tab)
    },
    [tab, loadForTab],
  )

  // 回车裸输入：后端 resolve 归一化（自动补后缀 + 名单反查名称）
  const handleSubmitRaw = useCallback(
    async (raw: string) => {
      setError('')
      try {
        const res = await tushareApi.resolve(raw)
        setPicked({ tsCode: res.ts_code, name: res.name ?? raw, industry: res.industry })
        void loadForTab(res.ts_code, tab)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [tab, loadForTab],
  )

  // 切换 tab：先清旧错误；全局 tab 自动加载，个股 tab 已有标的则重载。
  // 仅随 tab 切换触发，picked 变化由 handlePick/handleSubmitRaw 主动加载，避免重复请求。
  useEffect(() => {
    setError('')
    if (!status?.configured) return
    if (tab === '北向资金') void loadNorth()
    else if (tab === '龙虎榜') void loadDragon()
    else if (pickedRef.current) void loadForTab(pickedRef.current.tsCode, tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status, loadNorth, loadDragon, loadForTab])

  if (!status?.configured) return <TokenPanel onSaved={refreshStatus} />

  const needCode = tab !== '北向资金' && tab !== '龙虎榜'

  // 空态判定
  const emptyVariant: 'need-code' | 'no-data' | 'date-empty' =
    tab === '龙虎榜'
      ? dragon.length
        ? 'no-data'
        : 'date-empty'
      : tab === '北向资金'
        ? 'no-data'
        : !picked
          ? 'need-code'
          : 'no-data'

  const hasData =
    tab === '财务分析' ? financial.length > 0
    : tab === '资金流向' ? moneyflow.length > 0
    : tab === '北向资金' ? north.length > 0
    : tab === '龙虎榜' ? dragon.length > 0
    : holders.length > 0

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tushare 分析" subtitle="财务 · 资金流 · 龙虎榜 · 股东筹码" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 控制条 */}
        <div className="flex flex-wrap items-center gap-2">
          {needCode ? (
            <>
              <StockSearchInput
                onPick={handlePick}
                onSubmitRaw={handleSubmitRaw}
                disabled={loading}
              />
              {picked && (
                <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-1.5">
                  <span className="text-sm font-medium">{picked.name}</span>
                  <span className="font-mono text-xs text-muted">{picked.tsCode}</span>
                  {picked.industry && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">{picked.industry}</span>
                  )}
                </div>
              )}
            </>
          ) : tab === '龙虎榜' ? (
            <>
              <input
                value={dragonDate}
                onChange={(e) => setDragonDate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDragon()}
                placeholder="交易日期 YYYYMMDD"
                className="rounded-card border border-border bg-surface px-3 py-1.5 text-sm w-44 outline-none focus:border-accent"
              />
              <button onClick={loadDragon} className="rounded-card bg-accent px-4 py-1.5 text-sm font-medium text-black">
                查询
              </button>
            </>
          ) : null}
          <span className="ml-auto text-xs text-muted flex items-center gap-1">
            <KeyRound size={12} /> token 已配置 {status.tokenMask}
          </span>
        </div>

        {/* Tab 栏 */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm relative ${tab === t ? 'text-accent' : 'text-muted hover:text-foreground'}`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent rounded-full" />}
            </button>
          ))}
        </div>

        {/* 错误条：红色（红涨绿跌，bull=红） */}
        {error && (
          <div className="rounded-card border border-bull/30 bg-bull/5 px-3 py-2 text-bull text-sm">{error}</div>
        )}

        {/* 内容 */}
        {tab === '财务分析' && (hasData ? <FinancialView periods={financial} /> : <Empty variant={emptyVariant} />)}
        {tab === '资金流向' && (hasData ? <MoneyflowView data={moneyflow} /> : <Empty variant={emptyVariant} />)}
        {tab === '北向资金' && (hasData ? <NorthView data={north} /> : <Empty variant={emptyVariant} />)}
        {tab === '龙虎榜' && (hasData ? <DragonView data={dragon} /> : <Empty variant={emptyVariant} />)}
        {tab === '股东研究' && (hasData ? <HoldersView holders={holders} trades={trades} /> : <Empty variant={emptyVariant} />)}
      </div>
    </div>
  )
}

// ---------- Token 配置 ----------
function TokenPanel({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!token.trim()) {
      setError('请输入 Tushare token')
      return
    }
    setSaving(true)
    setError('')
    try {
      await tushareApi.saveToken(token.trim())
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tushare 分析" subtitle="配置后启用" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="text-accent" />
            <h2 className="text-base font-semibold">配置 Tushare Pro Token</h2>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            token 仅保存在后端 data/user_data/secrets.json（权限 0600），不写入代码、不发送给第三方。
            在 Tushare 个人中心获取，5000 积分可解锁财务、资金流、龙虎榜等全部模块。
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="粘贴你的 Tushare token"
            className="w-full rounded-card border border-border bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-bull text-xs">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-card bg-accent py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存并启用'}
          </button>
        </div>
      </div>
    </div>
  )
}
