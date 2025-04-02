import moment from 'moment';
import { createUniqueId } from '#root/utils/createUniqueId';

export interface SessionState {
    expires:number;
    id:string;
    [x:string]:any;
}

export class SessionStateManager {
    private states: Map<string, any>;

    public constructor() {
        this.states = new Map();
    }

    public clear(id: string) {
        if (!id) {
            throw Error('No state id supplied');
        }
        if (this.states.has(id)) {
            this.states.delete(id);
        }
    }

    public get(id:string, callbackIfNotFound?:Function):SessionState {
        if (this.states.has(id)) {
            return this.states.get(id);
        }
        let state = this.newState();
        if (callbackIfNotFound) {
            state = callbackIfNotFound(state);
        }
        this.states.set(state.id, state);
        return state;
    }

    public set(state:SessionState)
    {
        this.states.set(state.id, state);
    }

    public newState():SessionState {
        return {
            expires: moment().add(1, 'hours').valueOf(),
            id: createUniqueId()
        }
    }

    public clearAll() {
        const now = moment().valueOf();
        let expiredStates:string[] = [];
        this.states.forEach((value, key) => {
            if (value.expires < now) {
                expiredStates.push(key);
            }
        })
        for (const key of expiredStates) {
            this.states.delete(key);
        }
    }
}