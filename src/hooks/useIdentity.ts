import { useState } from 'react'

export function useIdentity() {
  const [name, setName] = useState(() => localStorage.getItem('d365_name') || '')
  const [editing, setEditing] = useState(() => !localStorage.getItem('d365_name'))

  function save(n: string) {
    const cleaned = n.trim()
    localStorage.setItem('d365_name', cleaned)
    setName(cleaned)
    setEditing(false)
  }

  return { name, editing, setEditing, save }
}
