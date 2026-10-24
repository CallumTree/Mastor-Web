import { describe, it, expect } from 'vitest'
import { thumbGet, thumbPut } from '../src/lib/thumbs'
import { wipeLocal } from '../src/lib/db'

describe('photo tile cache', () => {
  it('is wiped on sign-out with everything else, so the next person on the phone sees none of it', async () => {
    await thumbPut('p1', new Blob(['tile'], { type: 'image/jpeg' }))
    expect(await thumbGet('p1')).toBeTruthy()
    await wipeLocal()
    expect(await thumbGet('p1')).toBeUndefined()
  })
})
