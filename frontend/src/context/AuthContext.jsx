import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../config/firebase'
import { getMyProfile, saveProfile } from '../services/api'
import { AuthContext } from './authContextCore'


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null)
      setProfileError('')
      return null
    }

    setProfileLoading(true)
    setProfileError('')

    try {
      const response = await getMyProfile(firebaseUser)
      setProfile(response.data)
      return response.data
    } catch (error) {
      if (error.status === 404) {
        setProfile(null)
        return null
      }
      setProfileError(error.message || 'No se pudo cargar el perfil')
      setProfile(null)
      return null
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
      await loadProfile(firebaseUser)
    })

    return () => unsubscribe()
  }, [loadProfile])

  const completeProfile = useCallback(async (profileData) => {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión para crear tu perfil')
    }

    const response = await saveProfile(auth.currentUser, profileData)
    setProfile(response.data)
    return response.data
  }, [])

  const refreshProfile = useCallback(() => loadProfile(auth.currentUser), [loadProfile])

  const value = useMemo(() => ({
    user,
    profile,
    loading: authLoading || profileLoading,
    authLoading,
    profileLoading,
    profileError,
    needsProfile: Boolean(user && !profile && !profileLoading),
    completeProfile,
    refreshProfile,
  }), [
    user,
    profile,
    authLoading,
    profileLoading,
    profileError,
    completeProfile,
    refreshProfile,
  ])

  return (
    <AuthContext.Provider value={value}>
      {!authLoading && children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

