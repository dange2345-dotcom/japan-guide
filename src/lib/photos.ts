import type { SupabaseClient } from '@supabase/supabase-js'
import { PHOTO_BUCKET, photoUrl } from '../config'
import type { Photo } from '../db/types'

// Фото мест: сжимаем на устройстве (большое ≤1600 px и миниатюра ≤600 px), грузим в хранилище jp-photos.
// Для офлайна фото кладутся в кэш service worker'а (тот же, что настроен в vite.config.ts).

export const PHOTO_CACHE = 'jp-photos'
const FULL_SIDE = 1600
const THUMB_SIDE = 600

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // старый Safari не понимает параметры — пробуем через <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function sizeOf(image: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return 'naturalWidth' in image ? { w: image.naturalWidth, h: image.naturalHeight } : { w: image.width, h: image.height }
}

async function encode(image: ImageBitmap | HTMLImageElement, maxSide: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = sizeOf(image)
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Не удалось обработать фото')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Не удалось сжать фото')
  return { blob, w: canvas.width, h: canvas.height }
}

/** Сжать и загрузить фото места (или товара — folder 'items'). Нужна сеть. */
export async function uploadPhoto(client: SupabaseClient, placeId: string, file: Blob, folder: 'places' | 'items' = 'places'): Promise<Photo> {
  const image = await decode(file)
  const full = await encode(image, FULL_SIDE, 0.82)
  const thumb = await encode(image, THUMB_SIDE, 0.78)
  if ('close' in image) image.close()

  const base = `${folder}/${placeId}/${crypto.randomUUID()}`
  const photo: Photo = { path: `${base}.jpg`, thumb: `${base}-t.jpg`, w: full.w, h: full.h }
  const bucket = client.storage.from(PHOTO_BUCKET)
  for (const [path, blob] of [
    [photo.path, full.blob],
    [photo.thumb, thumb.blob],
  ] as const) {
    const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
    if (error) throw error
  }
  // Только что снятое фото сразу кладём в кэш — откроется и без сети.
  void cachePhotos([photo])
  return photo
}

/** Удалить файлы старого фото (не страшно, если не получится — останется лишний файл). */
export async function deletePhotoFiles(client: SupabaseClient, photo: Photo): Promise<void> {
  try {
    await client.storage.from(PHOTO_BUCKET).remove([photo.path, photo.thumb])
  } catch {
    // нет сети — файл останется в хранилище
  }
}

/**
 * Скачать фото в кэш для офлайна. Возвращает, сколько обработано; onProgress — для полоски на экране.
 * Уже лежащие в кэше пропускаются.
 */
export async function cachePhotos(photos: Photo[], onProgress?: (done: number, total: number) => void): Promise<{ done: number; failed: number }> {
  if (!('caches' in window)) return { done: 0, failed: photos.length * 2 }
  const cache = await caches.open(PHOTO_CACHE)
  const urls = photos.flatMap((p) => [photoUrl(p.thumb), photoUrl(p.path)])
  let done = 0
  let failed = 0
  const queue = [...urls]
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        if (!(await cache.match(url))) {
          const response = await fetch(url, { mode: 'cors' })
          if (!response.ok) throw new Error(String(response.status))
          await cache.put(url, response)
        }
        done++
      } catch {
        failed++
      }
      onProgress?.(done + failed, urls.length)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { done, failed }
}

/** Сколько фото уже в кэше (по большим). */
export async function countCachedPhotos(photos: Photo[]): Promise<number> {
  if (!('caches' in window)) return 0
  const cache = await caches.open(PHOTO_CACHE)
  let n = 0
  for (const p of photos) if (await cache.match(photoUrl(p.path))) n++
  return n
}
