import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string) {
  return bcrypt.hash(password.trim(), BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password.trim(), passwordHash)
}
