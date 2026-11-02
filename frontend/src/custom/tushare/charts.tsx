// Tushare 各分区 ECharts 图表 — 统一复用 useECharts 与 useChartTheme。
// 配色沿用品牌青 #38e1ff、红涨 #ff5c6b、绿跌 #2fd17c。
import { useMemo } from 'react'
import { useECharts } from '@/pages/backtest/charts/useECharts'
import { useChartTheme } from '@/lib/theme'
import type {
  FinancialPeriod,
  MoneyflowDay,
  NorthDay,
  HolderItem,
} from './tushareApi'

const ACCENT = '#38e1ff'
const BULL = '#ff5c6b'
const BEAR = '#2fd17c'
const ORANGE = '#f59e0b'
const PURPLE = '#b98bff'
const BLUE = '#4f7cff'

function axisLabels(ct: ReturnType<typeof useChartTheme>) {
  return {
    axisLabel: { color: ct.text, fontSize: 10 },
    axisLine: { lineStyle: { color: ct.border } },
    axisTick: { show: false },
  }
}

function baseTooltip(ct: ReturnType<typeof useChartTheme>) {
  return {
    trigger: 'axis' as const,
    backgroundColor: ct.tooltipBg,
    borderColor: ct.tooltipBorder,
    textStyle: { color: ct.tooltipText, fontSize: 12 },
  }
}

// ---------- 盈利能力指标走势（ROE / ROA / 毛利率 / 净利率） ----------

export function FinancialProfitChart({ periods }: { periods: FinancialPeriod[] }) {
  const ct = useChartTheme()
  const option = useMemo(() => {
    if (!periods.length) return null
    const rows = [...periods].reverse() // 旧 → 新
    const labels = rows.map(r => r.end_date)
    const series = [
      { name: 'ROE', key: 'roe', color: ACCENT },
      { name: '扣非ROE', key: 'roe_dt', color: BLUE },
      { name: 'ROA', key: 'roa', color: PURPLE },
      { name: '毛利率', key: 'grossprofit_margin', color: ORANGE },
      { name: '净利率', key: 'netprofit_margin', color: BEAR },
    ]
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 30, bottom: 26 },
      legend: {
        top: 0, textStyle: { color: ct.text, fontSize: 10 },
        itemWidth: 12, itemHeight: 8, icon: 'roundRect',
      },
      tooltip: {
        ...baseTooltip(ct),
        formatter: (params: any) => {
          const axis = params[0]?.axisValue ?? ''
          let html = `<div style="font-size:11px;color:${ct.text};margin-bottom:4px">${axis}</div>`
          for (const p of params) {
            if (p.value == null) continue
            html += `<div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${p.color}">${p.seriesName}</span>
              <span style="font-family:monospace">${Number(p.value).toFixed(2)}%</span>
            </div>`
          }
          return html
        },
      },
      xAxis: { type: 'category', data: labels, ...axisLabels(ct) },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: ct.grid } },
        axisLine: { show: false },
      },
      series: series.map(s => ({
        name: s.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: s.color, width: 1.8 },
        itemStyle: { color: s.color },
        data: rows.map(r => (r as any)[s.key]),
      })),
    } as any
  }, [periods, ct])

  const ref = useECharts(option, [periods, ct])
  return <div ref={ref} className="h-[220px]" />
}

// ---------- 成长能力：营收 / 净利润同比 ----------

export function FinancialGrowthChart({ periods }: { periods: FinancialPeriod[] }) {
  const ct = useChartTheme()
  const option = useMemo(() => {
    if (!periods.length) return null
    const rows = [...periods].reverse()
    const labels = rows.map(r => r.end_date)
    const mk = (key: string, color: string) => ({
      name: key === 'tr_yoy' ? '营收同比' : '净利润同比',
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { color, width: 1.8 },
      itemStyle: { color },
      data: rows.map(r => (r as any)[key]),
    })
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 30, bottom: 26 },
      legend: { top: 0, textStyle: { color: ct.text, fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      tooltip: {
        ...baseTooltip(ct),
        formatter: (params: any) => {
          const axis = params[0]?.axisValue ?? ''
          let html = `<div style="font-size:11px;color:${ct.text};margin-bottom:4px">${axis}</div>`
          for (const p of params) {
            if (p.value == null) continue
            html += `<div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${p.color}">${p.seriesName}</span>
              <span style="font-family:monospace">${Number(p.value).toFixed(2)}%</span>
            </div>`
          }
          return html
        },
      },
      xAxis: { type: 'category', data: labels, ...axisLabels(ct) },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: ct.grid } },
        axisLine: { show: false },
      },
      series: [mk('tr_yoy', ACCENT), mk('netprofit_yoy', ORANGE)],
    } as any
  }, [periods, ct])

  const ref = useECharts(option, [periods, ct])
  return <div ref={ref} className="h-[200px]" />
}

// ---------- 个股资金流向：分单净额堆叠柱 + 主力净流入折线 ----------

export function MoneyflowChart({ data }: { data: MoneyflowDay[] }) {
  const ct = useChartTheme()
  const option = useMemo(() => {
    if (!data.length) return null
    const labels = data.map(d => d.trade_date)
    const layers = [
      { name: '小单', key: 'sm_net', color: 'rgba(79,124,255,0.55)' },
      { name: '中单', key: 'md_net', color: 'rgba(185,139,255,0.55)' },
      { name: '大单', key: 'lg_net', color: 'rgba(245,158,11,0.6)' },
      { name: '特大单', key: 'elg_net', color: 'rgba(56,225,255,0.65)' },
    ]
    return {
      animation: false,
      grid: { left: 56, right: 56, top: 30, bottom: 26 },
      legend: { top: 0, textStyle: { color: ct.text, fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      tooltip: {
        ...baseTooltip(ct),
        formatter: (params: any) => {
          const axis = params[0]?.axisValue ?? ''
          let html = `<div style="font-size:11px;color:${ct.text};margin-bottom:4px">${axis}</div>`
          for (const p of params) {
            if (p.value == null) continue
            html += `<div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${p.color}">${p.seriesName}</span>
              <span style="font-family:monospace">${Number(p.value).toFixed(1)}</span>
            </div>`
          }
          return html
        },
      },
      xAxis: { type: 'category', data: labels, ...axisLabels(ct) },
      yAxis: [
        {
          type: 'value', name: '分单净额(万元)', nameTextStyle: { color: ct.text, fontSize: 9 },
          axisLabel: { color: ct.text, fontSize: 10 },
          splitLine: { lineStyle: { color: ct.grid } },
          axisLine: { show: false },
        },
        {
          type: 'value', name: '主力净额(万元)', nameTextStyle: { color: ct.text, fontSize: 9 },
          axisLabel: { color: ct.text, fontSize: 10 },
          splitLine: { show: false },
          axisLine: { show: false },
        },
      ],
      series: [
        ...layers.map(l => ({
          name: l.name,
          type: 'bar' as const,
          stack: 'order',
          barMaxWidth: 14,
          itemStyle: { color: l.color },
          data: data.map(d => (d as any)[l.key]),
        })),
        {
          name: '净流入',
          type: 'line' as const,
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: BULL, width: 1.8 },
          itemStyle: { color: BULL },
          data: data.map(d => d.net_mf),
        },
      ],
    } as any
  }, [data, ct])

  const ref = useECharts(option, [data, ct])
  return <div ref={ref} className="h-[240px]" />
}

// ---------- 北向 / 南向资金多线 ----------

export function NorthChart({ data }: { data: NorthDay[] }) {
  const ct = useChartTheme()
  const option = useMemo(() => {
    if (!data.length) return null
    const labels = data.map(d => d.trade_date)
    const layers = [
      { name: '北向净流入', key: 'north', color: ACCENT },
      { name: '沪股通', key: 'hgt', color: BLUE },
      { name: '深股通', key: 'sgt', color: PURPLE },
      { name: '南向净流入', key: 'south', color: ORANGE },
    ]
    return {
      animation: false,
      grid: { left: 56, right: 16, top: 30, bottom: 26 },
      legend: { top: 0, textStyle: { color: ct.text, fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      tooltip: {
        ...baseTooltip(ct),
        formatter: (params: any) => {
          const axis = params[0]?.axisValue ?? ''
          let html = `<div style="font-size:11px;color:${ct.text};margin-bottom:4px">${axis}</div>`
          for (const p of params) {
            if (p.value == null) continue
            html += `<div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${p.color}">${p.seriesName}</span>
              <span style="font-family:monospace">${Number(p.value).toFixed(2)} 亿</span>
            </div>`
          }
          return html
        },
      },
      xAxis: { type: 'category', data: labels, ...axisLabels(ct) },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.text, fontSize: 10 },
        splitLine: { lineStyle: { color: ct.grid } },
        axisLine: { show: false },
      },
      series: layers.map(l => ({
        name: l.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: l.color, width: 1.6 },
        itemStyle: { color: l.color },
        data: data.map(d => (d as any)[l.key]),
      })),
    } as any
  }, [data, ct])

  const ref = useECharts(option, [data, ct])
  return <div ref={ref} className="h-[240px]" />
}

// ---------- 股东户数变化（下降=筹码集中） ----------

export function HoldersChart({ holders }: { holders: HolderItem[] }) {
  const ct = useChartTheme()
  const option = useMemo(() => {
    if (!holders.length) return null
    const rows = [...holders].reverse() // 旧 → 新
    const labels = rows.map(r => r.end_date)
    return {
      animation: false,
      grid: { left: 64, right: 16, top: 16, bottom: 26 },
      tooltip: {
        ...baseTooltip(ct),
        formatter: (params: any) => {
          const p = params[0]
          if (p?.value == null) return ''
          const row = rows[p.dataIndex]
          const chg = row?.change
          const chgTxt = chg == null ? '—' : `${chg > 0 ? '+' : ''}${chg}`
          return `<div style="font-size:11px;color:${ct.text};margin-bottom:4px">${p.axisValue}</div>
            <div>股东户数 <span style="font-family:monospace">${Number(p.value).toLocaleString()}</span></div>
            <div>环比 <span style="font-family:monospace;color:${chg != null && chg >= 0 ? BULL : BEAR}">${chgTxt}</span></div>`
        },
      },
      xAxis: { type: 'category', data: labels, ...axisLabels(ct) },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v: number) => v.toLocaleString() },
        splitLine: { lineStyle: { color: ct.grid } },
        axisLine: { show: false },
      },
      series: [
        {
          name: '股东户数',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: ACCENT, width: 2 },
          itemStyle: { color: ACCENT },
          areaStyle: { color: 'rgba(56,225,255,0.08)' },
          data: rows.map(r => r.holder_num),
        },
      ],
    } as any
  }, [holders, ct])

  const ref = useECharts(option, [holders, ct])
  return <div ref={ref} className="h-[200px]" />
}
