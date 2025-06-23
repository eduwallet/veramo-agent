import { trimEnd } from '#root/utils/stringFunctions'
import { BASEURL } from '#root/environment';

export function getBaseUrl(url?: URL | string | undefined) {
    let baseUrl = url
    if (!baseUrl) {
      const envUrl = BASEURL;
      if (envUrl && envUrl.length > 0) {
        baseUrl = new URL(envUrl)
      }
    }
    if (!baseUrl) {
      throw Error(`No base URL provided`)
    }
    return trimEnd(baseUrl.toString(), '/')
}