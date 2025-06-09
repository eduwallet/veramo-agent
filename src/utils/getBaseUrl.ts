import { env } from '@sphereon/ssi-express-support'
import { trimEnd } from './stringFunctions.js'

export function getBaseUrl(url?: URL | string | undefined) {
    let baseUrl = url
    if (!baseUrl) {
      const envUrl = env('BASEURL', process?.env?.ENV_PREFIX)
      if (envUrl && envUrl.length > 0) {
        baseUrl = new URL(envUrl)
      }
    }
    if (!baseUrl) {
      throw Error(`No base URL provided`)
    }
    return trimEnd(baseUrl.toString(), '/')
}