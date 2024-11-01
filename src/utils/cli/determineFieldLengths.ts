export interface FieldSetting {
    length: number;
    type: string;
    name ?:string;
}

export interface FieldSettings {
    [x:string]: FieldSetting;
}

export function determineFieldLengths(objlist:any[], settings:FieldSettings): FieldSettings
{
    for (const obj of objlist) {
        for (const key of Object.keys(settings)) {
            if (key && obj[key]) {
                var length = settings[key].length;
                switch (settings[key].type) {
                    case 'number':
                        // only support integers here
                        length = Math.log10(parseInt(obj[key])) + 1;
                        break;
                    case 'string':
                        length = obj[key].length;
                        break;
                    case 'date':
                        length = 10;
                        break;
                    case 'datetime':
                        length = 18;
                        break;
                    case 'json':
                        // do not adjust length, print out full field always (so make sure it is the last one)
                        break;
                }
                if (settings[key].length < length) {
                    settings[key].length = length;
                }
            }
        }
    }
    return settings;
}