import { IEWIssuerOptsImportArgs } from "types";
import { IssuerMetadataV1_0_13 } from '@sphereon/oid4vci-common';
import { VcIssuer, VcIssuerBuilder } from '@sphereon/oid4vci-issuer';
import { Router } from "express";
import { DIDDocument } from '@veramo/core';
import { getCredentialSignerCallback, getJwtVerifyCallback } from "@sphereon/ssi-sdk.oid4vci-issuer";
import { JWTVerifyOptions } from "did-jwt";
import { resolver } from '../plugins';
import { context } from '../agent';
import { getCredentialDataSupplier } from "@utils/oid4vciCredentialSuppliers";

export class Issuer
{
    public name:string;
    public metadata:IssuerMetadataV1_0_13;
    public options:IEWIssuerOptsImportArgs;
    public keyRef:string;
    public router:Router|undefined;
    public vcIssuer:VcIssuer<DIDDocument>;

    public constructor(_options:IEWIssuerOptsImportArgs, _metadata: IssuerMetadataV1_0_13) {
        this.options = _options;
        this.metadata = _metadata;
        this.keyRef = '';
        this.name = _options.options.correlationId;

        this.vcIssuer = this.buildVcIssuer();
    }

    private buildVcIssuer() {
        const builder = new VcIssuerBuilder<DIDDocument>()
        if (!resolver) {
          throw Error('A Resolver is necessary to verify DID JWTs')
        }
        const jwtVerifyOpts: JWTVerifyOptions = {
          resolver,
          audience: this.metadata.credential_issuer,
        }
        builder.withIssuerMetadata(this.metadata)
            .withCredentialSignerCallback(getCredentialSignerCallback(this.options.options.issuerOpts.didOpts, context))
            .withJWTVerifyCallback(getJwtVerifyCallback({ verifyOpts: jwtVerifyOpts }, context))
            .withInMemoryCNonceState()
            .withInMemoryCredentialOfferState()
            .withCredentialDataSupplier(getCredentialDataSupplier(this))
            .withInMemoryCredentialOfferURIState();
      
        return builder.build();
    }
}
