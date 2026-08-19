import Debug from 'debug';
const debug = Debug('issuer:cli');
debug('start of cli.ts');
import { getArgs } from "#root/utils/args";
debug('cli.ts: importing getDbConnection');
import { getDbConnection } from "#root/database/databaseService";
import { Credential } from "#root/database/entities/Credential";
import { Issuer } from "#root/database/entities/Issuer";
import { CredentialType } from "#root/database/entities/CredentialType";
import { Nonce } from "#root/database/entities/Nonce";
import { Session } from "#root/database/entities/Session";
import { VCTDocument } from "#root/database/entities/VCTDocument";
import { determineFieldLengths, FieldSettings } from '#root/utils/cli/determineFieldLengths';
import { printField, printHeader } from '#root/utils/cli/printField';

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
    console.log('    help               Print this help text');
    console.log('    inspect-credential Inspect a specific credential, add the id as option');
    console.log('    list-credentials   List a selection of the database credentials. Add key=value options to filter');
    console.log('    migrate            Execute pending database migrations');
    console.log('    rollback           Revert the last executed migration');
    console.log('    clear              Remove database stored configurations')
    console.log('');
    console.log('Available options:');
    console.log('--help/-?   Print this help text');
    console.log('');
}

async function clearConfiguration()
{
    const dataSource = await getDbConnection();
    console.log('Clearing issuer configurations');
    await dataSource.getRepository(Issuer).clear();

    console.log('Clearing credential configurations');
    await dataSource.getRepository(CredentialType).clear();

    console.log('Clearing vct configurations');
    await dataSource.getRepository(VCTDocument).clear();

    console.log('Clearing nonce configurations');
    await dataSource.getRepository(Nonce).clear();

    console.log('Clearing session configurations');
    await dataSource.getRepository(Session).clear();
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
        console.log('Please provide an id option');
        return;
    }
    const dbConnection = await getDbConnection();
    const qb = dbConnection.getRepository(Credential).createQueryBuilder('c');
    const res = await qb.select('*').where('uuid=:id', {id: idOpt}).getRawOne();
    console.log(res);
}

async function listCredentials(options:any[])
{
    const dbConnection = await getDbConnection();
    let qb = dbConnection.getRepository(Credential).createQueryBuilder('c');
    qb = qb.select('*').where('id > 0');
    for (const opt of options) {
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
    let fieldSettings:FieldSettings = {
        id: { length: 6, type: 'number' },
        uuid: { length: 6, type: 'string' },
        issuer: { length: 10, type: 'string'},
        credentialId: { length: 20, type: 'string' },
        issuanceDate: {length: 10,type: 'datetime'}
    }
    fieldSettings = determineFieldLengths(credentials, fieldSettings);
    printHeader(fieldSettings);
    for (const cred of credentials) {
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

    if (files.includes('clear')) {
        await clearConfiguration();
        return;
    }

    console.log('No supported command found. Please use the "help" command to get a list of supported commands.');
}

await main().catch(console.log)

// destroy the connection so we can exit immediately
const dbConnection = await getDbConnection();
await dbConnection.destroy();
