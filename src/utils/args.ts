
export interface Option {
    short ?: string;
    name ?: string;
    hasArg ?: boolean;
}

export interface Arguments {
    [key:string]: boolean|string;
}

export const getArgs = (opts:Option[]) => {
    var currentOpt:Option|null = null;
    var options:Arguments = {};
    var files:string[] = [];

    process.argv.forEach((v,i) => {
        if (i > 1) {
            if (currentOpt && currentOpt.hasArg === true) {
                options[currentOpt.name ?? ''] = v;
                currentOpt = null;
            }
            else {
                var found = false;
                for (const opt of opts) {
                    if (v == ('-' + opt.short) || v == ('--' + opt.name)) {
                        found = true;
                        if (opt?.hasArg === true) {
                            currentOpt = opt;
                        }
                        else {
                            options[currentOpt?.name ?? ''] = true;
                        }
                    }
                }

                if (!found) {
                    files.push(v);
                }
            }
        }
    })
    return {options, files};
}