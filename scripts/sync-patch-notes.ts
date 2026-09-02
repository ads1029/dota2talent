import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const API = 'https://www.dota2.com/datafeed'
const root = new URL('../data/raw/', import.meta.url)
const patchesDir = new URL('./patches/', root)
const languages = [{ api: 'english', suffix: 'en' }, { api: 'schinese', suffix: 'zh' }] as const

type PatchList = { patches: Array<{ patch_number: string; patch_name: string; patch_timestamp: number }>; success: boolean }

await mkdir(patchesDir, { recursive: true })

async function fetchJson(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers: { 'user-agent': 'AncientArchive/0.1 talent-history-research' } })
    if (response.ok) return response.text()
    if (attempt === retries) throw new Error(`${response.status} ${url}`)
    await Bun.sleep(attempt * 750)
  }
  throw new Error(`Unreachable: ${url}`)
}

const manifests: Array<Record<string, unknown>> = []

for (const language of languages) {
  const listUrl = `${API}/patchnoteslist?language=${language.api}`
  const listText = await fetchJson(listUrl)
  const list = JSON.parse(listText) as PatchList
  await writeFile(new URL(`./patchnotes-list-${language.suffix}.json`, root), listText)

  let downloaded = 0
  let cached = 0
  for (const [index, patch] of list.patches.entries()) {
    const file = new URL(`./${patch.patch_number}-${language.suffix}.json`, patchesDir)
    if (!existsSync(file)) {
      const url = `${API}/patchnotes?version=${encodeURIComponent(patch.patch_number)}&language=${language.api}`
      const text = await fetchJson(url)
      await writeFile(file, text)
      downloaded++
      await Bun.sleep(80)
    } else {
      cached++
    }
    if ((index + 1) % 25 === 0) console.log(`${language.suffix}: ${index + 1}/${list.patches.length}`)
  }

  const listHash = createHash('sha256').update(await readFile(new URL(`./patchnotes-list-${language.suffix}.json`, root))).digest('hex')
  manifests.push({ language: language.suffix, patches: list.patches.length, downloaded, cached, listSha256: listHash })
}

const manifest = {
  source: 'Valve Dota 2 datafeed',
  endpoint: `${API}/patchnotes`,
  generatedAt: new Date().toISOString(),
  languages: manifests,
}
await writeFile(new URL('./manifest.json', root), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest, null, 2))
