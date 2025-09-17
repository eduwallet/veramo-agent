import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { COSE } from '../COSE';
import { Credential } from '../../Credential';
import { Factory } from '@muisit/cryptokey';

test('COSE conversion', async () => {
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

    const cose = new COSE(credential);
    await cose.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output).toBe('hEuhY2FsZ2VFUzI1NqRjdHlwc2FwcGxpY2F0aW9uL3ZjK2Nvc2VjY3R5bmFwcGxpY2F0aW9uL3ZjY2tpZHkBFmRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZFhObElqb2ljMmxuSWl3aVlXeG5Jam9pUlZNeU5UWWlMQ0o0SWpvaWVIVktOVXhLZG1kWk5XRm5aVUpWWW5sS05YWldWRkZUZVhKQlFYZ3RlSGg0WW0xVGF6Uk9WekpaUVNJc0lua2lPaUphU0hWcVdYSXRTR2hPYlZaeWRHUm1OR2xqZW5SRFRUSmxUVW8yV0VOeE5ESk5kM2QxYUd0RU5tUkZJbjAjMDNjNmUyNzkyYzliZTA2Mzk2YTA3ODE1MWJjODllNmY1NTM0MTJjYWIwMDBjN2VjNzFjNWI5OTI5MzgzNTZkOTgwY2lzc3jTZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2lkWE5sSWpvaWMybG5JaXdpWVd4bklqb2lSVk15TlRZaUxDSjRJam9pZUhWS05VeEtkbWRaTldGblpVSlZZbmxLTlhaV1ZGRlRlWEpCUVhndGVIaDRZbTFUYXpST1Z6SlpRU0lzSW5raU9pSmFTSFZxV1hJdFNHaE9iVlp5ZEdSbU5HbGplblJEVFRKbFRVbzJXRU54TkRKTmQzZDFhR3RFTm1SRkluMFkCfadoQGNvbnRleHSBeCRodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjJkdHlwZYJ0VmVyaWZpYWJsZUNyZWRlbnRpYWxuQ3JlZGVudGlhbFRlc3RxY3JlZGVudGlhbFN1YmplY3SiZG5hbWVkVGVzdGJpZG9kaWQ6dGVzdDpob2xkZXJmaXNzdWVyoWJpZHjTZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2lkWE5sSWpvaWMybG5JaXdpWVd4bklqb2lSVk15TlRZaUxDSjRJam9pZUhWS05VeEtkbWRaTldGblpVSlZZbmxLTlhaV1ZGRlRlWEpCUVhndGVIaDRZbTFUYXpST1Z6SlpRU0lzSW5raU9pSmFTSFZxV1hJdFNHaE9iVlp5ZEdSbU5HbGplblJEVFRKbFRVbzJXRU54TkRKTmQzZDFhR3RFTm1SRkluMGl2YWxpZEZyb214GTIwMjUtMDEtMDFUMDE6MDE6MDErMDE6MDBjaXNzeNNkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJbU55ZGlJNklsQXRNalUySWl3aWRYTmxJam9pYzJsbklpd2lZV3huSWpvaVJWTXlOVFlpTENKNElqb2llSFZLTlV4S2RtZFpOV0ZuWlVKVllubEtOWFpXVkZGVGVYSkJRWGd0ZUhoNFltMVRhelJPVnpKWlFTSXNJbmtpT2lKYVNIVnFXWEl0U0doT2JWWnlkR1JtTkdsamVuUkRUVEpsVFVvMldFTnhOREpOZDNkMWFHdEVObVJGSW4wY3N1Ym9kaWQ6dGVzdDpob2xkZXKiZHR5cGVmQnVmZmVyZGRhdGGYVhgzGFkYaRh3GFgYRBh1GEUYdRgxGGkYVRgtGHIYWRhMGGgYShh5GG0YRxhXGFcYRhhuGHgYdRhSGDgYeRhzGDMYYhh6GEkYWBhJGFcYahhtGGsYeBhVGHkYdxhoGHYYTxg3GHEYQxgtGFoYUhhYGGsYchhkGHYYVRhUGDQYSRhDGFoYWRhrGG0YRhhYGHkYUxg2GHoYTBhJGGkYbBhpGF8YURhmGE8YZRhpGHc')
});
