import { main }  from './agent.js';

console.log(process.env.DEBUG);
main().catch(console.log);
