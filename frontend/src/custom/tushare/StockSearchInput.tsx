import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { tushareApi, type SearchResult } from './tushareApi'

interface Props {
  /** 选中一只标的（标准 ts_code + 名称 + 行业）。 */
  onPick: (tsCode: string, name: string, industry: string | null) => void
  /** 回车且下拉无结果：把原始文本交给父级做后端归一化（裸代码自动补后缀）。 */
  onSubmitRaw: (raw: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Tushare 个股搜索框 — 代码 / 中文名 / 拼音缩写分层下拉，键盘上下 + Enter 选择。
 * 数据源 /api/tushare/search（stock_basic 名单缓存），不依赖主看板行情缓存。
 */
export function StockSearchInput({ onPick, onSubmitRaw, disabled, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  // 外部点击关闭
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // 防抖搜索
  useEffect(() => {
    const q = query.trim()
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timerRef.current = window.setTimeout(async () => {
      try {
        const res = await tushareApi.search(q, 20)
        setResults(res.results)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [query])

  function pick(r: SearchResult) {
    onPick(r.ts_code, r.name, r.industry)
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIdx(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') {
      if (!open) { setOpen(true); return }
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results.length > 0) {
        pick(results[activeIdx >= 0 ? activeIdx : 0])
      } else if (query.trim()) {
        onSubmitRaw(query.trim())
      }
    }
  }

  const trimmed = query.trim()

  return (
    <div ref={containerRef} className="relative w-56">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder ?? '代码 / 中文名 / 拼音'}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1) }}
          onFocus={() => { if (trimmed) setOpen(true) }}
          onKeyDown={onKeyDown}
          className="w-full rounded-card border border-border bg-surface pl-9 pr-8 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted animate-spin" />
        )}
      </div>

      {open && trimmed && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[320px] overflow-y-auto rounded-card border border-border bg-base shadow-xl">
          {loading ? (
            <div className="px-4 py-5 flex items-center justify-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 搜索中…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted">未找到匹配股票，回车按代码直接查询</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.ts_code}
                type="button"
                onClick={() => pick(r)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === activeIdx ? 'bg-accent/10 text-accent' : 'hover:bg-elevated text-foreground'
                }`}
              >
                <span className="font-mono shrink-0 text-xs w-[92px]">{r.ts_code}</span>
                <span className="truncate text-sm flex-1">{r.name}</span>
                {r.industry && <span className="shrink-0 text-[10px] text-muted">{r.industry}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
