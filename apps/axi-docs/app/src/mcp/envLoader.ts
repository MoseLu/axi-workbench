// Load environment variables from a `.env` file in the working directory.
// Equivalent to dotenv's default behaviour but avoids taking a runtime
// dependency just for one side-effect at server boot.

import fs from 'fs'
import path from 'path'

export function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=')
    const k = key?.trim()
    const v = valueParts?.join('=').trim().replace(/^["']|["']$/g, '')
    if (k && v && !k.startsWith('#') && !process.env[k]) {
      process.env[k] = v
    }
  })
}
