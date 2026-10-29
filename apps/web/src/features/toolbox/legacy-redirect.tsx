'use client'

import { useEffect } from 'react'

export function LegacyToolRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    const route = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    if (
      hash === '#/' ||
      ['text', 'files', 'pdf', 'rename', 'compare', 'table', 'workspace'].includes(route)
    ) {
      window.location.replace('/tools/' + hash)
    }
  }, [])
  return null
}
