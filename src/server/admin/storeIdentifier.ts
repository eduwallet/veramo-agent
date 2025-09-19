import { Request, Response } from 'express'

export async function storeIdentifier(request: Request, response: Response) {
    try {
        const data:any[] = [];
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}