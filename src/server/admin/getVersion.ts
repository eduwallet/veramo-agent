import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { ErrorCodes } from '#root/types/api';
import { getBuildInfo } from '#root/utils/getBuildInfo';
import { Request, Response } from 'express'

export async function getVersion(request: Request, response: Response) {
    try {
        return response.json(getBuildInfo());
    } 
    catch (e) {
        return sendErrorResponse(response, 500, {
                error: ErrorCodes.INTERNAL_ERROR,
                error_description: (e as Error).message,
            },
            e
        );
    }
}
