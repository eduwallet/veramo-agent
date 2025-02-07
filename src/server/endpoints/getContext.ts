import { ContextConfiguration } from 'contexts/Store'
import { Request, Response, Router } from 'express'

export function getContext(router:Router, context:ContextConfiguration) {
    router!.get(context.basePath, (request: Request, response: Response) => {
      return response.json({"@context": context['document']['@context']});
    })
}
