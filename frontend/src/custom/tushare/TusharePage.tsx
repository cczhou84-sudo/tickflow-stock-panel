import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { BarChart3, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
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

// ---------- 财务（行=指标，列=报告期） ----------
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
  )
}

// ---------- 资金流 ----------
function MoneyflowView({ data }: { data: MoneyflowDay[] }) {
  return (
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
  )
}

// ---------- 北向 ----------
function NorthView({ data }: { data: NorthDay[] }) {
  return (
    <>
      <p className="text-xs text-muted mb-2">注：2024年8月后北向实时净买入口径调整，历史数据仅作资金活跃度参考。单位：亿元</p>
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
    </>
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

// ---------- 主页面 ----------
export default function TusharePage() {
  const [status, setStatus] = useState<TushareStatus | null>(null)
  const [tab, setTab] = useState<Tab>('财务分析')
  const [codeInput, setCodeInput] = useState('')
  const [tsCode, setTsCode] = useState('')
  const [dragonDate, setDragonDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [financial, setFinancial] = useState<FinancialPeriod[]>([])
  const [moneyflow, setMoneyflow] = useState<MoneyflowDay[]>([])
  const [north, setNorth] = useState<NorthDay[]>([])
  const [dragon, setDragon] = useState<DragonItem[]>([])
  const [holders, setHolders] = useState<HolderItem[]>([])
  const [trades, setTrades] = useState<HolderTradeItem[]>([])

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

  // 北向、龙虎榜不依赖个股代码
  const loadNorth = useCallback(async () => {
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

  useEffect(() => {
    if (status?.configured && tab === '北向资金') loadNorth()
    if (status?.configured && tab === '龙虎榜') loadDragon()
  }, [tab, status, loadNorth, loadDragon])

  const query = async (overrideCode?: string) => {
    const code = (overrideCode ?? codeInput).trim()
    if (!code) {
      setError('请输入股票代码，如 000001.SZ')
      return
    }
    setLoading(true)
    setError('')
    setTsCode(code)
    setCodeInput(code)
    try {
      if (tab === '财务分析') setFinancial((await tushareApi.financial(code)).periods)
      if (tab === '资金流向') setMoneyflow((await tushareApi.moneyflow(code)).daily)
      if (tab === '股东研究') {
        const [h, t] = await Promise.all([tushareApi.holders(code), tushareApi.holdertrade(code)])
        setHolders(h.items)
        setTrades(t.items)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 切换到个股类 tab 且已有代码、对应数据为空时自动加载
  useEffect(() => {
    if (status?.configured && tsCode && ['财务分析', '资金流向', '股东研究'].includes(tab)) {
      const empty =
        (tab === '财务分析' && financial.length === 0) ||
        (tab === '资金流向' && moneyflow.length === 0) ||
        (tab === '股东研究' && holders.length === 0)
      if (empty) query(tsCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  if (!status?.configured) return <TokenPanel onSaved={refreshStatus} />

  const needCode = tab !== '北向资金' && tab !== '龙虎榜'

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tushare 分析" subtitle="财务 · 资金流 · 龙虎榜 · 股东筹码" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 控制条 */}
        <div className="flex flex-wrap items-center gap-2">
          {needCode ? (
            <>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && query()}
                placeholder="股票代码，如 000001.SZ"
                className="rounded-card border border-border bg-surface px-3 py-1.5 text-sm w-44 outline-none focus:border-accent"
              />
              <button
                onClick={query}
                disabled={loading}
                className="rounded-card bg-accent px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
              >
                {loading ? '查询中…' : '查询'}
              </button>
            </>
          ) : tab === '龙虎榜' ? (
            <>
              <input
                value={dragonDate}
                onChange={(e) => setDragonDate(e.target.value)}
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

        {error && <div className="rounded-card border border-border bg-surface px-3 py-2 text-bear text-sm">{error}</div>}

        {/* 内容 */}
        {tab === '财务分析' && (financial.length ? <FinancialView periods={financial} /> : <Empty />)}
        {tab === '资金流向' && (moneyflow.length ? <MoneyflowView data={moneyflow} /> : <Empty />)}
        {tab === '北向资金' && (north.length ? <NorthView data={north} /> : <Empty />)}
        {tab === '龙虎榜' && (dragon.length ? <DragonView data={dragon} /> : <Empty />)}
        {tab === '股东研究' && (holders.length ? <HoldersView holders={holders} trades={trades} /> : <Empty />)}
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div className="rounded-card border border-border bg-surface py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
      <BarChart3 size={28} strokeWidth={1.5} />
      输入条件后查询数据
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
          {error && <p className="text-bear text-xs">{error}</p>}
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
