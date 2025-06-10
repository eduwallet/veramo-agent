import Debug from 'debug';
const debug = Debug('issuer:agent');
import { TAgent } from '@veramo/core'
import { TAgentTypes } from './plugins.js';

export var _agent:TAgent<TAgentTypes>|null = null;
export function setAgent(a: TAgent<TAgentTypes>): void {
    _agent = a;
}
export function getAgent():TAgent<TAgentTypes> { 
    if (_agent === null) {
        debug('ERROR: returning null agent value');
    }
    return _agent!; 
}

