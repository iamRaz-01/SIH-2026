import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FolderOpen, ArrowRight } from 'lucide-react'
import { getProjects, type Project } from '../api/client'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  // Real-time project search debounced
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      getProjects({ search: query.trim(), page_size: 8 })
        .then(res => {
          setResults(res.projects || [])
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    }
  }

  const handleSelect = (p: Project) => {
    onClose()
    navigate(`/projects/${p.project_id || p.project_code}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="bg-[#FFFFFF] border border-[#E2E8F0] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E2E8F0] gap-3 bg-[#F8FAFC]">
          <Search className="h-5 w-5 text-[#2563EB] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-0 outline-none text-[#0F172A] placeholder-[#94A3B8] text-[16px] font-normal leading-normal"
            placeholder="Search projects by name, code, state, or agency… (Press Esc to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#94A3B8] hover:text-[#0F172A] p-1">
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-[12px] font-medium text-[#64748B] bg-[#FFFFFF] px-2 py-0.5 rounded border border-[#E2E8F0] shadow-2xs">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-[#EDF2F7]">
          {loading && (
            <div className="p-8 text-center text-[13px] text-[#64748B] flex items-center justify-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-[#2563EB] border-t-transparent rounded-full" />
              Searching infrastructure dataset…
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[12px] font-medium uppercase tracking-wider text-[#64748B]">
                Matched Projects ({results.length})
              </div>
              {results.map((p, idx) => {
                const isSelected = idx === selectedIndex
                const cov = p.cost_overrun_ratio != null ? (p.cost_overrun_ratio * 100).toFixed(1) : null

                return (
                  <div
                    key={p.project_id || idx}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3.5 py-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-[#EFF6FF] border border-[#93C5FD]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <FolderOpen className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isSelected ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#0F172A] line-clamp-1">
                          {p.project_name}
                        </p>
                        <p className="text-[13px] text-[#475569] font-normal mt-0.5 truncate">
                          <span className="text-[#2563EB] font-medium">Code: {p.project_code || p.project_id}</span> · {p.agency} · {p.state}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {cov !== null && (
                        <span className={`text-[13px] font-semibold ${
                          Number(cov) > 30 ? 'text-[#B91C1C]' : Number(cov) > 10 ? 'text-[#B45309]' : 'text-[#15803D]'
                        }`}>
                          {Number(cov) > 0 ? `+${cov}%` : `${cov}%`}
                        </span>
                      )}
                      <ArrowRight className={`h-4 w-4 ${isSelected ? 'text-[#2563EB]' : 'text-transparent'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-8 text-center text-[13px] text-[#64748B]">
              No infrastructure projects found matching "<strong className="text-[#0F172A]">{query}</strong>".
            </div>
          )}

          {!query && (
            <div className="p-6 text-center text-[13px] text-[#64748B] space-y-1">
              <p className="font-semibold text-[14px] text-[#0F172A]">Quick Search</p>
              <p className="text-[13px] text-[#64748B]">Type any project keyword, sanction code, implementing agency, or state.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[12px] text-[#64748B]">
          <span>Use ↑↓ to navigate, Enter to select</span>
          <span className="font-medium text-[#0F172A]">InfraGuard Intelligence</span>
        </div>
      </div>
    </div>
  )
}
