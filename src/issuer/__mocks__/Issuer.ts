import { vi } from 'vitest'
import { Issuer as OriginalIssuer } from '../Issuer';  // Import the actual class

// Mock the Issuer class
export const Issuer = vi.fn().mockImplementation((options, metadata) => {
    // Call the original constructor by creating an instance of the actual Issuer class
    const instance = new OriginalIssuer(options, metadata);

    //vi.spyOn(instance, 'signData').mockReturnValue('mocked-signature');

    return instance;
});
