
import Debug from 'debug';
const debug = Debug('agent:cli');
debug('start of cli.ts');
import { getArgs } from "utils/args";
debug('cli.ts: importing getDbConnection');
import { getDbConnection } from "database/databaseService";

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

    console.log('No supported command found. Please use the "help" command to get a list of supported commands.');
}

main().catch(console.log)

  