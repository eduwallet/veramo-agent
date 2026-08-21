export function isSingleTenant()
{
    return process.env.SINGLE_TENANT && (process.env.SINGLE_TENANT ?? '').length > 0;
}