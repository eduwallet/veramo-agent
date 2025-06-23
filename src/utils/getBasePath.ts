import { getBaseUrl } from '#root/utils/getBaseUrl'
import { trimBoth } from '#root/utils/stringFunctions'

export function getBasePath(url?: URL | string) {
    const basePath = new URL(getBaseUrl(url)).pathname
    if (basePath === '' || basePath === '/') {
      return ''
    }
    return `/${trimBoth(basePath, '/')}`
  }