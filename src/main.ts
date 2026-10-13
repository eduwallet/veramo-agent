import Debug from 'debug';
const debug = Debug('issuer:agent');

import { initialiseServer } from '#root/server/index';
import { initialiseIssuerStore } from '#root/issuer/Store';
import { initialiseCredentialConfigurationStore } from '#root/credentials/Store';
import { initialiseVctConfigurationStore } from '#root/vct/Store';
import { getContextConfigurationStore } from '#root/contexts/Store';
import { getDIDConfigurationStore } from '#root/dids/Store';
import { resolvePassphraseKey } from '#root/database/privateKeyPassphrase';

async function main() {
    // fail fast on a missing/misconfigured PASSPHRASE, rather than only discovering it
    // later when a key happens to be created or decoded
    debug('Validating PASSPHRASE configuration');
    await resolvePassphraseKey();

    debug('Loading contexts');
    const contextStore = getContextConfigurationStore();
    await contextStore.init();

    debug('Loading vcts');
    await initialiseVctConfigurationStore().catch((e:any) => console.error(e))

    debug('Loading and/or creating keys and identifiers');
    const didStore = getDIDConfigurationStore();
    await didStore.init();

    debug('Loading credential configurations');
    await initialiseCredentialConfigurationStore();

    debug('Creating Issuer instances');
    await initialiseIssuerStore();

    debug("Starting Express Server");
    await initialiseServer();

    debug("Sending initial log message");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
