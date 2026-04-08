const GWS = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/']

export async function fetchJSON(cid: string): Promise<any> {
  for (const gw of GWS) {
    try {
      const r = await fetch(gw + cid)
      if (r.ok) return await r.json()
    } catch { continue }
  }
  return {}
}

export async function fetchEncryptedFile(cid: string): Promise<Uint8Array> {
  for (const gw of GWS) {
    try {
      const r = await fetch(gw + cid)
      if (!r.ok) continue
      const bytes = new Uint8Array(await r.arrayBuffer())
      try {
        const txt = new TextDecoder().decode(bytes).trim()
        if (txt.startsWith('{')) {
          const json = JSON.parse(txt)
          if (json.encryptedFile)
            return Uint8Array.from(atob(json.encryptedFile), c => c.charCodeAt(0))
        }
      } catch { /**/ }
      return bytes
    } catch { continue }
  }
  throw new Error('IPFS fetch failed: ' + cid)
}