import React, { createContext, useContext, useState, useEffect } from 'react'

export interface WatchedProjectItem {
  project_id: string
  project_code?: string
  project_name: string
  agency?: string
  state?: string
  risk_class?: string
  cost_overrun_pct?: number | null
}

interface WatchlistContextType {
  watchedItems: WatchedProjectItem[]
  isWatched: (projectId: string) => boolean
  toggleWatch: (item: WatchedProjectItem) => void
  removeWatch: (projectId: string) => void
  clearWatchlist: () => void
}

const STORAGE_KEY = 'infraguard_watchlist_v1'

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined)

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchedItems, setWatchedItems] = useState<WatchedProjectItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchedItems))
    } catch {
      // Ignore storage write error
    }
  }, [watchedItems])

  const isWatched = (projectId: string) => {
    return watchedItems.some(i => i.project_id === projectId)
  }

  const toggleWatch = (item: WatchedProjectItem) => {
    setWatchedItems(prev => {
      const exists = prev.some(i => i.project_id === item.project_id)
      if (exists) {
        return prev.filter(i => i.project_id !== item.project_id)
      } else {
        return [...prev, item]
      }
    })
  }

  const removeWatch = (projectId: string) => {
    setWatchedItems(prev => prev.filter(i => i.project_id !== projectId))
  }

  const clearWatchlist = () => setWatchedItems([])

  return (
    <WatchlistContext.Provider
      value={{
        watchedItems,
        isWatched,
        toggleWatch,
        removeWatch,
        clearWatchlist,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  )
}

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext)
  if (!ctx) {
    throw new Error('useWatchlist must be used within a WatchlistProvider')
  }
  return ctx
}
