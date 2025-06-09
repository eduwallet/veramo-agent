import { getBaseUrl } from './getBaseUrl.js'
import { trimBoth } from './stringFunctions.js'

export function getBasePath(url?: URL | string) {
    const basePath = new URL(getBaseUrl(url)).pathname
    if (basePath === '' || basePath === '/') {
      return ''
    }
    return `/${trimBoth(basePath, '/')}`
  }