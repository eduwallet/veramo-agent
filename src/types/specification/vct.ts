// https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-08.html#name-sd-jwt-vc-type-metadata
export type VctClaimPathElement = string | null;

export interface VctClaimDisplay {
    lang: string;
    name: string;
    description: string;
}

export type sd_claim = 'always' | 'allowed' | 'never';

export interface VctClaim {
    path: VctClaimPathElement[];
    display?:VctClaimDisplay[];
    sd?:sd_claim;
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
    vct?: string;
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
