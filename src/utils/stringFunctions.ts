export const trimBoth = (value: string, trim: string): string => {
    return trimEnd(trimStart(value, trim), trim);
};
  
export const trimEnd = (value: string, trim: string): string => {
    return value.endsWith(trim) ? value.substring(0, value.length - trim.length) : value;
};
  
export const trimStart = (value: string, trim: string): string => {
    return value.startsWith(trim) ? value.substring(trim.length) : value;
};
