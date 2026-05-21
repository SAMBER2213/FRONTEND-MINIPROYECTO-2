import { useContext } from 'react'
import { AuthContext } from './authContextCore'

export const useAuth = () => useContext(AuthContext)
