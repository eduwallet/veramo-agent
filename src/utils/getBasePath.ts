import { trimBoth } from '@sphereon/oid4vci-common/dist/functions/HttpUtils'
import { getBaseUrl } from './getBaseUrl'

export function getBasePath(url?: URL | string) {
    const basePath = new URL(getBaseUrl(url)).pathname
    if (basePath === '' || basePath === '/') {
      return ''
    }
    return `/${trimBoth(basePath, '/')}`
  }