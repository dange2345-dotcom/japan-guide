import { describe, expect, it } from 'vitest'
import { humanizeError } from './errors'

describe('humanizeError', () => {
  it('переводит типовые ошибки', () => {
    expect(humanizeError(new Error('Invalid login credentials'))).toBe('Неверная почта или пароль')
    expect(humanizeError(new TypeError('Failed to fetch'))).toBe('Нет связи с сервером. Проверьте интернет')
    expect(humanizeError(new TypeError('Load failed'))).toBe('Нет связи с сервером. Проверьте интернет')
  })

  it('понимает ошибки Supabase — обычные объекты с message', () => {
    expect(humanizeError({ message: 'Invalid login credentials', status: 400 })).toBe('Неверная почта или пароль')
    expect(humanizeError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(
      'Нет доступа к данным (правила RLS)',
    )
  })

  it('возвращает исходный текст для неизвестных ошибок', () => {
    expect(humanizeError(new Error('Something odd'))).toBe('Something odd')
    expect(humanizeError(undefined)).toBe('Неизвестная ошибка')
  })
})
