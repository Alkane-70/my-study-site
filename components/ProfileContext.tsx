'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { createClient } from '@/utils/supabase/client'

type ProfileValue = {
  username: string | null
  avatarUrl: string | null
  email: string | null
  refresh: () => void
}

const ProfileContext = createContext<ProfileValue>({
  username: null,
  avatarUrl: null,
  email: null,
  refresh: () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? null)
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setUsername(data.username)
      setAvatarUrl(data.avatar_url)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <ProfileContext.Provider value={{ username, avatarUrl, email, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
