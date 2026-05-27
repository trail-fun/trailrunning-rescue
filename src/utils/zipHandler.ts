import JSZip from 'jszip'
import { parseGpx, coordsToGpx } from './gpxParser'
import type { Race, Route, Point } from '../types/race'

export type ZipData = { race: Race; routes: Route[]; points: Point[] }

export async function importZip(file: File): Promise<ZipData> {
  const zip = await JSZip.loadAsync(file)

  const raceFile = zip.file('race.json')
  if (!raceFile) throw new Error('race.json が見つかりません')
  const json = JSON.parse(await raceFile.async('text'))

  const routes: Route[] = []
  for (const rDef of (json.routes ?? [])) {
    const gpxFile = zip.file(rDef.gpxFile)
    const coords = gpxFile ? parseGpx(await gpxFile.async('text')) : []
    routes.push({ ...rDef, coords })
  }

  const points: Point[] = []
  for (const pDef of (json.points ?? [])) {
    const photos: string[] = []
    for (const photoFile of (pDef.photoFiles ?? [])) {
      const f = zip.file(photoFile)
      if (f) {
        const b64 = await f.async('base64')
        const ext = (photoFile.split('.').pop() ?? 'jpg')
        photos.push(`data:image/${ext};base64,${b64}`)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photoFiles: _pf, photos: _ph, ...rest } = pDef
    points.push({ ...rest, photos })
  }

  return { race: json.race ?? { id: '', name: '', date: '', description: '' }, routes, points }
}

export async function exportZip(race: Race, routes: Route[], points: Point[]): Promise<void> {
  const zip = new JSZip()

  const routeDefs = routes.map(r => ({
    id: r.id, name: r.name, type: r.type, gpxFile: r.gpxFile,
    difficulty: r.difficulty, transportSuitability: r.transportSuitability,
    segments: r.segments, junction: r.junction,
  }))

  // 写真を別ファイルとしてZIPに格納
  const pointDefs = points.map(p => {
    const photoFiles = (p.photos ?? []).map((_, i) => `photos/${p.id}_${i}.jpg`)
    return { ...p, photos: undefined, photoFiles }
  })
  for (const p of points) {
    ;(p.photos ?? []).forEach((dataUrl, i) => {
      const b64 = dataUrl.split(',')[1]
      if (b64) zip.file(`photos/${p.id}_${i}.jpg`, b64, { base64: true })
    })
  }

  zip.file('race.json', JSON.stringify({ version: '1.0', race, routes: routeDefs, points: pointDefs }, null, 2))

  for (const r of routes) {
    if (r.coords.length > 0) {
      zip.file(r.gpxFile, coordsToGpx(r.coords, r.name))
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${race.name || 'race'}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
