
import Debug from 'debug';
const debug = Debug('agent:cli');
debug('start of cli.ts');
import { getArgs } from "utils/args";
debug('cli.ts: importing getDbConnection');
import { getDbConnection, Credential } from "database";
import { determineFieldLengths, FieldSettings } from 'utils/cli/determineFieldLengths';
import { printField, printHeader } from 'utils/cli/printField';

function printHelp()
{
    console.log('Veramo Agent CLI');
    console.log('Version ' + process.env.npm_package_version);
    console.log('Copyright NPuls 2024');
    console.log('');
    console.log('Usage:');
    console.log('    npm run cli <command> <options>');
    console.log('');
    console.log('Available commands:');
    console.log('    help      Print this help text');
    console.log('    migrate   Execute pending database migrations');
    console.log('    rollback  Revert the last executed migration');
    console.log('');
    console.log('Available options:');
    console.log('--help/-?   Print this help text');
    console.log('');
}

async function migrate()
{
    const dataSource = await getDbConnection();
    console.log('Running migrations');
    await dataSource.runMigrations();
}

async function rollback()
{
    const dataSource = await getDbConnection();
    console.log('Running migrations');
    await dataSource.undoLastMigration();
}

async function inspectCredential(idOpt?:string)
{
    if (!idOpt || !idOpt.length) {
        console.log('Please provide an id=... option');
        return;
    }
    const dbConnection = await getDbConnection();
    var qb = dbConnection.getRepository(Credential).createQueryBuilder('c');
    const res = await qb.select('*').where('id=:id', {id: idOpt}).getRawOne();
    console.log(res);
}

async function listCredentials(options:any[])
{
    const dbConnection = await getDbConnection();
    var qb = dbConnection.getRepository(Credential).createQueryBuilder('c');
    qb = qb.select('*').where('id > 0');
    for (var opt of options) {
        const kv = opt.split('=');
        switch (kv[0]) {
            case 'issuer':
                qb = qb.andWhere('c.issuer=:issuer', {issuer: kv[1]});
                break;
            case 'credpid':
                qb = qb.andWhere('c.credpid=:credpid', {credpid: kv[1]});
                break;
            case 'credentialId':
                qb = qb.andWhere('c.credentialId=:credentialId', {credentialId: kv[1]});
                break;
            case 'issuanceDate':
                qb = qb.andWhere('c."issuanceDate" > :issuanceDate', {issuanceDate: kv[1]});
                break;
            case 'state':
                qb = qb.andWhere('c.state=:state', {state: kv[1]});
                break;
            case 'holder':
                qb = qb.andWhere('c.holder=:holder', {holder: kv[1]});
                break;
            default:
                console.log('Filter option ', kv[0], ' not supported');
                break;
        }
    }
    const credentials = await qb.orderBy('c.id', 'ASC').getRawMany();
    var fieldSettings:FieldSettings = {
        id: { length: 6, type: 'number' },
        issuer: { length: 10, type: 'string'},
        credentialId: { length: 20, type: 'string' },
        issuanceDate: {length: 10,type: 'datetime'}
    }
    fieldSettings = determineFieldLengths(credentials, fieldSettings);
    printHeader(fieldSettings);
    for (var cred of credentials) {
        printField(cred, fieldSettings);
    }
    console.log('');
}

async function main()
{
    const {options, files} = getArgs([{
      name: "help",
      short: "?",
      hasArg: false
    }]);

    if (options.help || files.includes('help')) {
        printHelp();
        return;
    }
    if (files.includes('migrate')) {
        await migrate();
        return;
    }
    if (files.includes('rollback')) {
        await rollback();
        return;
    }

    if (files.includes('list-credentials')) {
        await listCredentials(files.filter((f) => f != 'list-credentials'));
        return;
    }

    if (files.includes('inspect-credential')) {
        await inspectCredential(files.filter((f) => f != 'inspect-credential').join());
        return;
    }

    console.log('No supported command found. Please use the "help" command to get a list of supported commands.');
}

await main().catch(console.log)

// destroy the connection so we can exit immediately
const dbConnection = await getDbConnection();
await dbConnection.destroy();
