import { expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JOSE } from '../JOSE';
import { Credential } from '../../Credential';
import { Factory } from '@muisit/cryptokey';
import { VCDM } from '../VCDM';

test('JOSE conversion', async () => {
    const issuer = new Issuer({}, {});
    issuer.key = await Factory.createFromType('Secp256r1', "44d2575ca39d5b875b17f3ae372183acd1da561dbbfde6591facbca98b83fb11"); 
    issuer.did = { did: await Factory.toDIDJWK(issuer.key) };
    issuer.keyRef = issuer.key.exportPublicKey();
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    credential.holder = {type:'kid', did:'did:test:holder', data: 'did:test:holder#0'};
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';

    const vcdm = new VCDM(credential);
    const baseCredential = await vcdm.build();
    const jose = new JOSE(credential, baseCredential, 'vc+jwt', '2020-01-01 01:01:01');
    await jose.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output).toBe('eyJhbGciOiJFUzI1NiIsImtpZCI6IiMwIiwidHlwIjoidmMrand0IiwiY3R5IjoidmMiLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wIn0.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNyZWRlbnRpYWxUZXN0Il0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJUZXN0IiwiaWQiOiJkaWQ6dGVzdDpob2xkZXIjMCJ9LCJpc3N1ZXIiOnsiaWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wIn0sInZhbGlkRnJvbSI6IjIwMjUtMDEtMDFUMDE6MDE6MDErMDE6MDAiLCJpYXQiOjE1Nzc4MzY4NjEsIm5iZiI6MTczNTY4OTY2MSwic3ViIjoiZGlkOnRlc3Q6aG9sZGVyIzAiLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wIn0.3vzfSKTQWpX8DOXJYfDwBbZN-5iLlU0HKDgAPg-D3BmwikGk9VQmAvOO1f1eG4u2obRC3q-mLuPJq_X4KsPqHA')
});
