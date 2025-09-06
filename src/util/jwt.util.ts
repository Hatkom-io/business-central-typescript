import { jwtDecode } from 'jwt-decode'

export const isTokenValid = (token: string): boolean => {
  const decodedToken = jwtDecode(token)

  if (!decodedToken.exp) {
    return false
  }

  const expirationDate = new Date(decodedToken.exp * 1000) // Convert to milliseconds
  const currentDate = new Date()
  const nextMinute = new Date(currentDate.getTime() + 60 * 1000) // Add 1 minute to current date

  return expirationDate > nextMinute
}
