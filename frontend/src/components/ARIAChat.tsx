/**
 * src/components/ARIAChat.tsx
 *
 * ARIA — AI Risk & Intelligence Assistant
 *
 * A floating chat widget that lets users ask free-text questions about
 * projects or the full portfolio. Backed by the Web Intelligence Agent
 * (GET /api/projects/{id}/web-evidence) when scoped to a project, or
 * by the existing risk/anomaly APIs when in portfolio mode.
 *
 * Integrates cleanly into the existing InfraGuard AI layout — it mounts
 * as a floating button in the bottom-right corner, over all other content.
 * No existing components are modified.
 */

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useARIA } from './ARIAContext'
import {
  getWebEvidence,
  analyzeQuery,
  type WebEvidenceItem,
  type WebIntelligenceResponse,
  type AnalysisResponse,
} from '../api/aria'

interface Message {
  id: string
  role: 'user' | 'aria' | 'error'
  text: string
  timestamp: Date
  evidence?: WebEvidenceItem[]
  triggered?: boolean
}

const PORTFOLIO_STARTERS = [
  'Which projects are at highest risk?',
  'Show me all high-risk projects',
  'What are the top risk concerns this month?',
]

const PROJECT_STARTERS = [
  'What external signals exist for this project?',
  'Are there any news or court cases affecting this project?',
  'Search for contractor disputes on this project',
  'Find any land acquisition issues',
]

function trustBadgeColor(source_quality: WebEvidenceItem['source_quality']) {
  switch (source_quality) {
    case 'HIGH':    return 'bg-green-100 text-green-800 border-green-200'
    case 'MEDIUM':  return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'LOW':     return 'bg-orange-100 text-orange-800 border-orange-200'
    default:        return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function formatInlineText(text: string) {
  // Split tokens by bold (**...**) and inline code (`...`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800 border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={i} className="h-1.5" />

    // Header line starting and ending with ** (e.g., **Project Intelligence...**)
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      return (
        <p key={i} className="font-bold text-slate-900 mt-2 mb-1 text-[13px] tracking-tight">
          {trimmed.slice(2, -2)}
        </p>
      )
    }

    // Bullet point line starting with • or - or *
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.replace(/^[•\-\*]\s+/, '')
      return (
        <div key={i} className="flex items-start gap-1.5 text-[13px] text-slate-700 leading-relaxed my-0.5">
          <span className="text-violet-500 font-bold shrink-0 mt-0.5 text-xs">•</span>
          <div className="flex-1">{formatInlineText(content)}</div>
        </div>
      )
    }

    return (
      <p key={i} className="text-[13px] text-slate-800 leading-relaxed my-0.5">
        {formatInlineText(line)}
      </p>
    )
  })
}

export default function ARIAChat() {
  const { mode, projectId, projectName } = useARIA()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const greeting: Message = {
    id: 'greeting',
    role: 'aria',
    text:
      mode === 'project' && projectName
        ? `Hi! I'm **ARIA** — your AI Risk & Intelligence Assistant.\n\nI'm focused on **${projectName}**. Ask me about external signals, news, court cases, contractor disputes, or any risk signals for this project.`
        : `Hi! I'm **ARIA** — your AI Risk & Intelligence Assistant.\n\nI have access to the full InfraGuard project portfolio. Ask me about any project by name or code, or about portfolio-wide risk signals.`,
    timestamp: new Date(),
  }

  // Reset when project context changes
  useEffect(() => {
    setMessages([])
    setInitialized(false)
  }, [projectId])

  // Add greeting when opened for the first time
  useEffect(() => {
    if (open && !initialized) {
      setMessages([greeting])
      setInitialized(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, initialized])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const isExplicitWebSearch =
        mode === 'project' &&
        projectId &&
        (text.toLowerCase().includes('search') ||
          text.toLowerCase().includes('find') ||
          text.toLowerCase().includes('news') ||
          text.toLowerCase().includes('court') ||
          text.toLowerCase().includes('dispute'))

      if (isExplicitWebSearch) {
        // Direct Web Intelligence search for specific project external signals
        const result: WebIntelligenceResponse = await getWebEvidence(projectId, true)

        let responseText: string
        if (!result.triggered) {
          responseText = `Web Intelligence search was not triggered for this project.\n\n**Reason:** ${result.trigger_reason}`
        } else if (result.evidence.length === 0) {
          responseText = `I searched the web for **${result.topics_searched.join(', ')}** related to this project but found no relevant external signals.\n\n**Topics searched:** ${result.topics_searched.join(' • ')}`
        } else {
          responseText = `Found **${result.evidence_count} external signal${result.evidence_count !== 1 ? 's' : ''}** for this project.\n\n**Topics searched:** ${result.topics_searched.join(' • ')}`
          if (result.warnings.length > 0) {
            responseText += `\n\n**Warnings:** ${result.warnings.join('; ')}`
          }
        }

        const ariaMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'aria',
          text: responseText,
          timestamp: new Date(),
          evidence: result.evidence,
          triggered: result.triggered,
        }
        setMessages(prev => [...prev, ariaMsg])
      } else {
        // Coordinator Agent Q&A (handles both Portfolio queries and Project analysis)
        const res: AnalysisResponse = await analyzeQuery(text.trim(), projectId)

        const ariaMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'aria',
          text: res.text || res.report?.executive_summary || 'I analyzed your query.',
          timestamp: new Date(),
          evidence: res.evidence || [],
        }
        setMessages(prev => [...prev, ariaMsg])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const isUnconfigured = message.includes('500') && message.includes('TAVILY')
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        text: isUnconfigured
          ? 'The Web Intelligence Agent is not configured (TAVILY_API_KEY missing). Add your Tavily API key to backend/.env and restart the server.'
          : `I couldn't complete the analysis: ${message}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  const starters = mode === 'project' ? PROJECT_STARTERS : PORTFOLIO_STARTERS

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open ARIA chat"
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 print:hidden ${
          open
            ? 'bg-slate-800 rotate-45 scale-95'
            : 'bg-gradient-to-br from-violet-600 to-indigo-700 hover:scale-110'
        }`}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <circle cx="9" cy="10" r="1" fill="white" /><circle cx="12" cy="10" r="1" fill="white" /><circle cx="15" cy="10" r="1" fill="white" />
          </svg>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-violet-500" />
          </span>
        )}
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-96 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden print:hidden"
          style={{ height: '540px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white font-bold text-sm">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">ARIA</div>
              <div className="text-violet-200 text-xs truncate">
                {mode === 'project' && projectName
                  ? `📌 ${projectName}`
                  : '🌐 Portfolio Intelligence'}
              </div>
            </div>
            <div className="flex h-2 w-2 rounded-full bg-emerald-400" title="Online" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.role !== 'user' && (
                  <span className="text-xs text-slate-400 px-1">ARIA</span>
                )}
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : msg.role === 'error'
                      ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.text}</p>
                  ) : (
                    <div className="space-y-0.5">{renderText(msg.text)}</div>
                  )}
                </div>

                {/* Evidence items */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="w-full max-w-[90%] mt-1 space-y-1">
                    <button
                      onClick={() => setExpandedEvidence(expandedEvidence === msg.id ? null : msg.id)}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                    >
                      {expandedEvidence === msg.id ? '▼' : '▶'} {msg.evidence.length} source{msg.evidence.length !== 1 ? 's' : ''}
                    </button>
                    {expandedEvidence === msg.id && (
                      <div className="space-y-2">
                        {msg.evidence.slice(0, 5).map(ev => (
                          <div
                            key={ev.evidence_id}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-700 flex-1 leading-tight">
                                {ev.title || ev.source}
                              </span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${trustBadgeColor(ev.source_quality)}`}>
                                {ev.source_quality}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{ev.finding}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 capitalize">{ev.topic}</span>
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-violet-600 hover:text-violet-800 font-medium"
                              >
                                Source ↗
                              </a>
                            </div>
                          </div>
                        ))}
                        {msg.evidence.length > 5 && (
                          <p className="text-xs text-slate-400 text-center">
                            +{msg.evidence.length - 5} more sources
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-1">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Starter suggestions */}
          {messages.length <= 1 && !loading && (
            <div className="px-3 py-2 border-t border-slate-100 bg-white">
              <p className="text-xs text-slate-400 mb-1.5">Suggested questions</p>
              <div className="flex flex-col gap-1">
                {starters.slice(0, 3).map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg px-2.5 py-1.5 transition-colors border border-violet-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                mode === 'project' ? 'Ask about external signals…' : 'Ask about the portfolio…'
              }
              disabled={loading}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:bg-white disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
