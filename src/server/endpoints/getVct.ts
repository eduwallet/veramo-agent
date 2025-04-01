import { Request, Response, Router } from 'express'
import { VctConfiguration } from 'vct/Store';

export function getVct(router:Router, vct:VctConfiguration) {
    router!.get(vct.path, (request: Request, response: Response) => {
      return response.json(vct.document);
    })
}
