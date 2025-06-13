import { expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JOSE } from '../JOSE';
import { Credential } from '../../Credential';
import { Factory } from '@muisit/cryptokey';

test('JOSE conversion', async () => {
    const issuer = new Issuer({}, {});
    issuer.key = await Factory.createFromType('Secp256r1', "44d2575ca39d5b875b17f3ae372183acd1da561dbbfde6591facbca98b83fb11"); 
    issuer.did = { did: await Factory.toDIDJWK(issuer.key) };
    issuer.keyRef = issuer.key.exportPublicKey();
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';

    const jose = new JOSE(credential, 'vc+jwt', '2020-01-01 01:01:01');
    await jose.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output).toBe('eyJhbGciOiJFUzI1NiIsImtpZCI6IjAzYzZlMjc5MmM5YmUwNjM5NmEwNzgxNTFiYzg5ZTZmNTUzNDEyY2FiMDAwYzdlYzcxYzViOTkyOTM4MzU2ZDk4MCIsInR5cCI6InZjK2p3dCIsImN0eSI6InZjIiwiaXNzIjoiZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2lkWE5sSWpvaWMybG5JaXdpWVd4bklqb2lSVk15TlRZaUxDSjRJam9pZUhWS05VeEtkbWRaTldGblpVSlZZbmxLTlhaV1ZGRlRlWEpCUVhndGVIaDRZbTFUYXpST1Z6SlpRU0lzSW5raU9pSmFTSFZxV1hJdFNHaE9iVlp5ZEdSbU5HbGplblJEVFRKbFRVbzJXRU54TkRKTmQzZDFhR3RFTm1SRkluMCJ9.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNyZWRlbnRpYWxUZXN0Il0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJUZXN0IiwiaWQiOiJkaWQ6dGVzdDpob2xkZXIifSwiaXNzdWVyIjp7ImlkIjoiZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2lkWE5sSWpvaWMybG5JaXdpWVd4bklqb2lSVk15TlRZaUxDSjRJam9pZUhWS05VeEtkbWRaTldGblpVSlZZbmxLTlhaV1ZGRlRlWEpCUVhndGVIaDRZbTFUYXpST1Z6SlpRU0lzSW5raU9pSmFTSFZxV1hJdFNHaE9iVlp5ZEdSbU5HbGplblJEVFRKbFRVbzJXRU54TkRKTmQzZDFhR3RFTm1SRkluMCJ9LCJ2YWxpZEZyb20iOiIyMDI1LTAxLTAxVDAxOjAxOjAxKzAxOjAwIiwiaWF0IjoxNTc3ODM2ODYxLCJzdWIiOiJkaWQ6dGVzdDpob2xkZXIiLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wIn0.amLFpSEygR68mbYfY_0r9XQsfXo1luk2HR7nBk-R-0IgCKd_q-JSOfs51GVkxLUtqby3MTOmwYM66K5WvaD3FA')
});
