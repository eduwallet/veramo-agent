import {
    CredentialDataSupplier,
    CredentialDataSupplierArgs,
    CredentialDataSupplierResult
} from "@sphereon/oid4vci-issuer"
import {ICredential} from "@sphereon/ssi-types"
import {getTypesFromRequest, CredentialsSupportedDisplay} from "@sphereon/oid4vci-common"
import { IIssuerOptsPersistArgs } from '@sphereon/ssi-sdk.oid4vci-issuer-store'
import {format} from 'date-fns'

import agent from '../agent';
import { findCredentialDefinitionInMetadata } from "./findCredentialDefinitionInMetadata"
import { IssuerMetadataV1_0_13 } from '@sphereon/oid4vci-common'
import { Issuer } from "issuer/Issuer"

export function getCredentialDataSupplier(issuer:Issuer): CredentialDataSupplier {
    const credentialDataSupplier = new BasicJWTCredentialSupplier(issuer)
    return credentialDataSupplier.generateCredentialData.bind(credentialDataSupplier)
}

const isoTimeFormat = 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'';

class BasicJWTCredentialSupplier {
    private readonly issuer:Issuer;

    constructor(issuer:Issuer) {
        this.issuer = issuer;
    }

    public async generateCredentialData(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
        const types: string[] = getTypesFromRequest(args.credentialRequest);
        const display = (this.issuer.metadata.display ?? [{}])[0];
        const credentialName = types.filter((v) => v != 'VerifiableCredential')[0];
        const credentialConfiguration = findCredentialDefinitionInMetadata(this.issuer.metadata, credentialName);
        const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration.display?.length ? credentialConfiguration.display[0] : undefined;

        // construction with a cast, because we do not yet know the actual issuer key id
        // that is used to sign the ICredential, but the type definition requires it
        const credential:ICredential = ({
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": types,
            "issuer": {
                //id: this.issuer.metadata.credential_issuer,
                // additional, not further specified data about the issuer
                // This would be wallet-dependent
                name: display.name ?? this.issuer.metadata.credential_issuer,
                description: display.description ?? ''
            },
            'name': credentialDisplay?.name ?? '',
            'description': credentialDisplay?.description ?? '',
            "issuanceDate": format(new Date(), isoTimeFormat),
            "credentialSubject": args.credentialDataSupplierInput
        } as unknown) as ICredential;
        return ({
            format: 'jwt_vc_json',
            credential: credential
        } as unknown) as CredentialDataSupplierResult;
    }
}

