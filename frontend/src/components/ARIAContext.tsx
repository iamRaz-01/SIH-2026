/**
 * src/components/ARIAContext.tsx
 *
 * React context that provides the current ARIA chat mode and project scope
 * to the ARIAChat floating widget.
 *
 * mode="portfolio"  → Chat is about all projects (used on Dashboard, Projects list)
 * mode="project"    → Chat is scoped to a specific project (used on ProjectDetailPage)
 */

import { createContext, useContext } from 'react'

export type ARIAMode = 'portfolio' | 'project'

export interface ARIAContextValue {
  mode: ARIAMode
  projectId: string | null
  projectName: string | null
}

export const ARIAContext = createContext<ARIAContextValue>({
  mode: 'portfolio',
  projectId: null,
  projectName: null,
})

export function useARIA() {
  return useContext(ARIAContext)
}
