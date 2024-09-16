import Debug from 'debug'

/**
 * Use this logger to log debug messages.
 * In order to add a namespace to the logger, use the `debug.extend` method. For example:
 *
 * ```typescript
 * import { debug } from "@utils/logger";
 * const dbg = debug.extend('myNamespace');
 * dbg('my debug message');
 * ```
 * Then you can enable the namespace by setting the `DEBUG` environment variable:
 * ```bash
 * DEBUG=agent:server:myNamespace yarn start:dev
 * ```
 */
export const debug = Debug('agent:server')

