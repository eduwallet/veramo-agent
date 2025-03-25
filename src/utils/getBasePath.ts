import { getBaseUrl } from './getBaseUrl'
import { trimBoth } from './stringFunctions'

export function getBasePath(url?: URL | string) {
    const basePath = new URL(getBaseUrl(url)).pathname
    if (basePath === '' || basePath === '/') {
      return ''
    }
    return `/${trimBoth(basePath, '/')}`
  }