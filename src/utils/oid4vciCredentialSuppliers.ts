import {
    CredentialDataSupplier,
    CredentialDataSupplierArgs,
    CredentialDataSupplierResult
} from "@sphereon/oid4vci-issuer"
import {ICredential} from "@sphereon/ssi-types"
import {getTypesFromRequest, CredentialsSupportedDisplay} from "@sphereon/oid4vci-common"
import { IIssuerOptsPersistArgs } from '@sphereon/ssi-sdk.oid4vci-issuer-store'
import {format} from 'date-fns'

import {TemplateVCGenerator} from "./templateManager"
import {CONF_PATH} from "../environment"
import {CredentialSupplierConfigWithTemplateSupport } from '../types';
import {normalizeFilePath } from '../utils';
import agent from '../agent';
import { findCredentialDefinitionInMetadata } from "./findCredentialDefinitionInMetadata"

const templateVCGenerator = new TemplateVCGenerator()

export function getCredentialDataSupplier(opts: IIssuerOptsPersistArgs): CredentialDataSupplier {
    //const credentialDataSupplier = new TemplateCredentialDataSupplier(issuerCorrelationId)
    const credentialDataSupplier = new BasicJWTCredentialSupplier(opts)
    return credentialDataSupplier.generateCredentialData.bind(credentialDataSupplier)
}

const isoTimeFormat = 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'';

class BasicJWTCredentialSupplier {
    private readonly issuerOptions: IIssuerOptsPersistArgs

    constructor(opts: IIssuerOptsPersistArgs) {
        this.issuerOptions = opts;
    }

    public async generateCredentialData(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
        const instance = await agent.oid4vciGetInstance({ credentialIssuer: this.issuerOptions.correlationId});
        const issuer = await instance.get({context: { agent: agent } });
        console.log(issuer);

        const types: string[] = getTypesFromRequest(args.credentialRequest);
        const display = (issuer.issuerMetadata.display ?? [{}])[0];
        const credentialName = types.filter((v) => v != 'VerifiableCredential')[0];
        const credentialConfiguration = findCredentialDefinitionInMetadata(issuer.issuerMetadata, credentialName);
        const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration.display?.length ? credentialConfiguration.display[0] : undefined;

        const credential:ICredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": types,
            "issuer": {
                //id: issuer.issuerMetadata.credential_issuer,
                // additional, not further specified data about the issuer
                // This would be wallet-dependent
                name: display.name ?? issuer.issuerMetadata.credential_issuer,
                description: display.description ?? ''
            },
            'name': credentialDisplay?.name ?? '',
            'description': credentialDisplay?.description ?? '',
            "issuanceDate": format(new Date(), isoTimeFormat),
            "credentialSubject": args.credentialDataSupplierInput
        };
        return ({
            format: 'jwt_vc_json',
            credential: credential
        } as unknown) as CredentialDataSupplierResult;
    }
}

class TemplateCredentialDataSupplier {
    private readonly issuerCorrelationId: string

    constructor(correlationId: string) {
        this.issuerCorrelationId = correlationId
    }

    public async generateCredentialData(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
        const types: string[] = getTypesFromRequest(args.credentialRequest)
        const credentialSupplierConfig = args.credentialSupplierConfig as CredentialSupplierConfigWithTemplateSupport
        if (credentialSupplierConfig.template_mappings) {
            const templateMapping = credentialSupplierConfig.template_mappings
                .find(mapping => mapping.credential_types.some(type => type !== 'VerifiableCredential' && types.includes(type)))
            if (templateMapping) {
                const templatePath = normalizeFilePath(CONF_PATH, credentialSupplierConfig?.templates_base_dir, templateMapping.template_path)
                const credential = templateVCGenerator.generateCredential(templatePath, args.credentialDataSupplierInput)
                if(!credential) {
                    throw new Error(`Credential generation failed for template ${templatePath}`)
                }
                return Promise.resolve({
                    format: templateMapping.format || args.credentialRequest.format,
                    credential: credential
                } as unknown as CredentialDataSupplierResult)
            } else {
                throw new Error(`No template mapping could be found for types ${types.join(', ')}`)
            }
        }
        throw new Error(`The credential supplier could not find a match for the requested credential types ${types.join(', ')}. The issuer correlationId is ${this.issuerCorrelationId}`)
    }
}
