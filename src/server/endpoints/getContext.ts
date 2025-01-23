import { ContextConfiguration } from 'contexts/Store'
import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer'

export function getContext(router:Router, context:ContextConfiguration) {
    router!.get(context.path, (request: Request, response: Response) => {
      return response.json({"@context": context['@context']});
    })
}
