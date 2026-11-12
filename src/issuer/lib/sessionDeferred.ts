import { Session } from '#root/database/entities/index';
import { DeferredSessionData } from '#root/types/internal';

export function getDeferredTransactions(session:Session):DeferredSessionData[]
{
    return Object.values(session.data?.deferredTransactions ?? {}) as DeferredSessionData[];
}

export function findDeferredByTransactionId(session:Session, transactionId:string):DeferredSessionData|null
{
    const transactions = session.data?.deferredTransactions;
    return transactions && Object.prototype.hasOwnProperty.call(transactions, transactionId) ? transactions[transactionId] : null;
}

export function findDeferredByDataSet(session:Session, dataSetId:string):DeferredSessionData|null
{
    return getDeferredTransactions(session).find((d) => d.credentialDataSet?.id === dataSetId) ?? null;
}

export function storeDeferred(session:Session, deferred:DeferredSessionData)
{
    session.data.deferredTransactions = { ...(session.data.deferredTransactions ?? {}), [deferred.transactionId]: deferred };
}

// The back-office identifies a transaction by its session and transaction id
export function createTransactionKey(session:Session, deferred:DeferredSessionData):string
{
    return session.uuid + '.' + deferred.transactionId;
}

export function parseTransactionKey(key:string):{sessionId:string, transactionId:string}|null
{
    const idx = typeof(key) == 'string' ? key.lastIndexOf('.') : -1;
    return idx > 0 ? { sessionId: key.substring(0, idx), transactionId: key.substring(idx + 1) } : null;
}
