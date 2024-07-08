import { adjustUrl, trimBoth, trimStart } from '@sphereon/oid4vci-common/dist/functions/HttpUtils'
import { getBasePath } from './getBasePath';
import { getBaseUrl } from './getBaseUrl';

export function determinePath(
    baseUrl: URL | string | undefined,
    endpoint: string,
    opts?: { skipBaseUrlCheck?: boolean; prependUrl?: string; stripBasePath?: boolean },
  ) {
    const basePath = baseUrl ? getBasePath(baseUrl) : ''
    let path = endpoint
    if (opts?.prependUrl) {
      path = adjustUrl(path, { prepend: opts.prependUrl })
    }
    if (opts?.skipBaseUrlCheck !== true) {
      assertEndpointHasIssuerBaseUrl(baseUrl, endpoint)
    }
    if (endpoint.includes('://')) {
      path = new URL(endpoint).pathname
    }
    path = `/${trimBoth(path, '/')}`
    if (opts?.stripBasePath && path.startsWith(basePath)) {
      path = trimStart(path, basePath)
      path = `/${trimBoth(path, '/')}`
    }
    return path
}

function assertEndpointHasIssuerBaseUrl(baseUrl: URL | string | undefined, endpoint: string) {
    if (!validateEndpointHasIssuerBaseUrl(baseUrl, endpoint)) {
      throw Error(`endpoint '${endpoint}' does not have base url '${baseUrl ? getBaseUrl(baseUrl) : '<no baseurl supplied>'}'`)
    }
}

function validateEndpointHasIssuerBaseUrl(baseUrl: URL | string | undefined, endpoint: string): boolean {
    if (!endpoint) {
      return false
    } else if (!endpoint.includes('://')) {
      return true //absolute or relative path, not containing a hostname
    } else if (!baseUrl) {
      return true
    }
    return endpoint.startsWith(getBaseUrl(baseUrl))
}