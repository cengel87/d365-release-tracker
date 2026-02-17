import { useEffect, useState } from 'react'

const STORAGE_KEY = 'd365_name'

export function useIdentity() {
  const [name, setName] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [editing, setEditing] = useState(() => !localStorage.getItem(STORAGE_KEY))

  // On first visit (no stored name), try to pick up the Basic Auth username
  // from the edge function response header and auto-set it.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    fetch(window.location.href, { method: 'HEAD' })
      .then((res) => {
        const authUser = res.headers.get('x-auth-user')
        if (authUser) {
          localStorage.setItem(STORAGE_KEY, authUser)
          setName(authUser)
          setEditing(false)
        }
      })
      .catch(() => {
        // Ignore — user will see the manual name prompt
      })
  }, [])

  function save(n: string) {
    const cleaned = n.trim()
    localStorage.setItem(STORAGE_KEY, cleaned)
    setName(cleaned)
    setEditing(false)
  }

  return { name, editing, setEditing, save }
}
