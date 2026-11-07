import axios from 'axios'
import { FLASH_KEY } from '../context/NoticeContext.jsx'

export const SESSION_REPLACED_TEXT =
  'You were signed out because this account signed in on another device. Only one device can be signed in at a time.'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      if (err.response.data?.detail === 'SESSION_REPLACED') {
        try {
          sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message: SESSION_REPLACED_TEXT, kind: 'info' }))
        } catch {
          // storage unavailable: the redirect still happens
        }
      }
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
