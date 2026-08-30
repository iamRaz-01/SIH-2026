import { Link } from 'react-router-dom'
import { Star, X, Trash2, ExternalLink } from 'lucide-react'
import { useWatchlist } from '../context/WatchlistContext'

interface WatchlistDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function WatchlistDrawer({ isOpen, onClose }: WatchlistDrawerProps) {
  const { watchedItems, removeWatch, clearWatchlist } = useWatchlist()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FFFFFF] border-l border-[#E2E8F0] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[#F59E0B] fill-[#F59E0B]" />
              <h2 className="font-semibold text-[18px] text-[#0F172A] tracking-tight">
                Pinned Watchlist ({watchedItems.length})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {watchedItems.length > 0 && (
                <button
                  onClick={clearWatchlist}
                  className="text-[13px] font-normal text-[#64748B] hover:text-[#DC2626] px-2 py-1 rounded transition flex items-center gap-1"
                  title="Clear all watchlist items"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List of Watched Projects */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-[#EDF2F7]">
            {watchedItems.length > 0 ? (
              watchedItems.map(item => {
                const cov = item.cost_overrun_pct

                return (
                  <div
                    key={item.project_id}
                    className="pt-3 first:pt-0 bg-[#FFFFFF] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2 hover:border-[#CBD5E1] transition shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-[14px] text-[#0F172A] line-clamp-2 leading-snug">
                        {item.project_name}
                      </h4>
                      <button
                        onClick={() => removeWatch(item.project_id)}
                        className="text-[#94A3B8] hover:text-[#DC2626] p-1 shrink-0"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[13px] text-[#475569]">
                      <span className="text-[#2563EB] font-medium">Code: {item.project_code || item.project_id}</span>
                      <span className="truncate max-w-[140px] font-normal">{item.state}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#EDF2F7] text-[13px]">
                      <div>
                        <span className="text-[#64748B]">Overrun: </span>
                        {cov != null ? (
                          <span className={`font-semibold ${cov > 30 ? 'text-[#B91C1C]' : cov > 10 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>
                            {cov > 0 ? `+${cov}%` : `${cov}%`}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] italic">N/A</span>
                        )}
                      </div>

                      <Link
                        to={`/projects/${item.project_id}`}
                        onClick={onClose}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1 transition text-[13px]"
                      >
                        View Details <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-20 text-center text-[14px] text-[#64748B] space-y-2">
                <Star className="h-8 w-8 mx-auto text-[#CBD5E1]" />
                <p className="font-semibold text-[#0F172A] text-[16px]">Your Watchlist is Empty</p>
                <p className="text-[13px] font-normal max-w-xs mx-auto text-[#64748B]">
                  Click the star icon (⭐) on any infrastructure project or monitor card to pin it here for quick tracking.
                </p>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[12px] text-[#64748B] flex items-center justify-between font-normal">
            <span>Persisted across sessions</span>
            <span className="font-medium text-[#0F172A]">MoSPI / IPMD</span>
          </div>
        </div>
      </div>
    </div>
  )
}
