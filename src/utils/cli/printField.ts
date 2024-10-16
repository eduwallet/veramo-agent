import { FieldSettings } from './determineFieldLengths';
import moment from 'moment';

function padWithSpaces(str:string, length:number, onRight:boolean)
{
    if (onRight && length > str.length) {
        str = str + ' '.repeat(length - str.length);
    }
    else if (length > str.length) {
        str = ' '.repeat(length - str.length) + str;
    }
    return str;
}

export function printHeader(settings:FieldSettings)
{
    var isFirst = true;
    var line = '';
    for (var key of Object.keys(settings)) {
        var output = padWithSpaces(settings[key].name || key, settings[key].length, true);
        line += (!isFirst ? ' | ' : '') + output;
        isFirst = false;
    }
    console.log(line);
    console.log('-'.repeat(line.length));
}

export function printField(obj:any, settings:FieldSettings)
{
    var isFirst = true;
    var line = '';
    for (var key of Object.keys(settings)) {
        var output = '' + (obj[key] || '');
        switch (settings[key].type) {
            case 'string':
                output = padWithSpaces(output, settings[key].length, true);
                break;
            case 'number':
                output = padWithSpaces(output, settings[key].length, false);
                break;
            case 'json':
                break;
            case 'date':
                if (output.length) {
                    output = moment(output, 'YYYY-MM-DD').format('YYYY-MM-DD');
                }
                break;
            case 'datetime':
                if (output.length) {
                    output = moment(output, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
                }
                break;                
        }
        line += (!isFirst ? ' | ' : '') + output;
        isFirst = false;
    }
    console.log(line);
}