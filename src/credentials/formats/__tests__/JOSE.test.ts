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
    expect(credential.output).toBe('eyJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZFhObElqb2ljMmxuSWl3aVlXeG5Jam9pUlZNeU5UWWlMQ0o0SWpvaWVIVktOVXhLZG1kWk5XRm5aVUpWWW5sS05YWldWRkZUZVhKQlFYZ3RlSGg0WW0xVGF6Uk9WekpaUVNJc0lua2lPaUphU0hWcVdYSXRTR2hPYlZaeWRHUm1OR2xqZW5SRFRUSmxUVW8yV0VOeE5ESk5kM2QxYUd0RU5tUkZJbjAjMDNjNmUyNzkyYzliZTA2Mzk2YTA3ODE1MWJjODllNmY1NTM0MTJjYWIwMDBjN2VjNzFjNWI5OTI5MzgzNTZkOTgwIiwidHlwIjoidmMrand0IiwiY3R5IjoidmMiLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wIn0.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNyZWRlbnRpYWxUZXN0Il0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJUZXN0IiwiaWQiOiJkaWQ6dGVzdDpob2xkZXIifSwiaXNzdWVyIjp7ImlkIjoiZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2lkWE5sSWpvaWMybG5JaXdpWVd4bklqb2lSVk15TlRZaUxDSjRJam9pZUhWS05VeEtkbWRaTldGblpVSlZZbmxLTlhaV1ZGRlRlWEpCUVhndGVIaDRZbTFUYXpST1Z6SlpRU0lzSW5raU9pSmFTSFZxV1hJdFNHaE9iVlp5ZEdSbU5HbGplblJEVFRKbFRVbzJXRU54TkRKTmQzZDFhR3RFTm1SRkluMCJ9LCJ2YWxpZEZyb20iOiIyMDI1LTAxLTAxVDAxOjAxOjAxKzAxOjAwIiwiaWF0IjoxNTc3ODM2ODYxLCJuYmYiOjE1Nzc4MzY4NjEsInN1YiI6ImRpZDp0ZXN0OmhvbGRlciIsImlzcyI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZFhObElqb2ljMmxuSWl3aVlXeG5Jam9pUlZNeU5UWWlMQ0o0SWpvaWVIVktOVXhLZG1kWk5XRm5aVUpWWW5sS05YWldWRkZUZVhKQlFYZ3RlSGg0WW0xVGF6Uk9WekpaUVNJc0lua2lPaUphU0hWcVdYSXRTR2hPYlZaeWRHUm1OR2xqZW5SRFRUSmxUVW8yV0VOeE5ESk5kM2QxYUd0RU5tUkZJbjAifQ.1Wyw8TyI0xqH6A2FZB5XGckbJ0baSi42lgK_4qcP5H1MJaQaP1BXeq2UwYVbZAlxFR3igXlpCDzJdxolE5OSwA')
});
