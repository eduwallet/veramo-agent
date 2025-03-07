
/* Credential Offer Parameters
 *
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-offer-parameters
 */

/* Grants */
export const AUTHORIZATION_CODE_GRANT = "authorization_code";
export const PRE_AUTHORIZED_CODE = 'pre-authorized_code';
export const PRE_AUTHORIZED_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface TxCode {
    input_mode?: 'numeric' | 'text';
    length?: number;
    description?: string;
}

export interface AuthorizationCodeGrant {
    issuer_state?: string;
    authorization_server?: string;
}

export interface PreAuthGrant {
    'pre-authorized_code': string;
    tx_code?: TxCode;
    interval?: number;
    authorization_server?: string;
}

export interface Grants {
    authorization_code?: AuthorizationCodeGrant;
    'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: PreAuthGrant;
}

// https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-08.html#name-sd-jwt-vc-type-metadata
export type VctClaimPathElement = string | null;

export interface VctClaimDisplay {

}

export interface VctClaim {
    path: VctClaimPathElement[];
    display?:VctClaimDisplay;
    sd?:string;
    svg_id?:string;
}

export type VctSchemaType = 'string' | 'number' | 'integer' | 'object' | 'array' | 'boolean' | 'null' | 'regular expressions';

export interface VctSchemaProperty {
    type: VctSchemaType | VctSchemaType[];
    properties?:VctSchemaProperties;
    [x:string]: any;
}

export interface VctSchemaProperties {
    [x:string]: VctSchemaProperty;
}

// https://json-schema.org/draft/2020-12/release-notes
export interface VctSchema {
    "$schema": "https://json-schema.org/draft/2020-12/schema";
    "type":"object";
    properties?: VctSchemaProperties;
    required?:string[];
}

export interface VctDisplayRenderingLogo {
    uri: string;
    "uri#integrity"?:string;
    alt_text?:string;
}

export interface VctDisplayRenderingSimple {
    logo?: VctDisplayRenderingLogo;
    background_color?:string;
    text_color?:string;
}

export interface VctDisplayRenderingSvgProperty {
    orientation?: 'portrait' | 'landscape';
    color_scheme?: 'light' | 'dark';
    contrast?: 'normal' | 'high';
}

export interface VctDisplayRenderingSvg {
    uri:string;
    "uri#integrity"?:string;
    properties?:any;
}

export interface VctDisplayRendering {
    "simple"?:VctDisplayRenderingSimple;
    "svg_template"?:VctDisplayRenderingSvg;
}

export interface VctDisplay {
    lang:string;
    name:string;
    description:string;
    rendering?:VctDisplayRendering;
}

export interface Vct {
    name?:string;
    description?:string;
    extends?:string;
    "extends#integrity"?:string;
    display?: VctDisplay;
    claims?: VctClaim[];
    schema?:VctSchema;
    schema_uri?:string;
    "schema_uri#integrity"?:string;
}
