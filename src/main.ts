import { main }  from './agent';

console.log(process.env.DEBUG);
main().catch(console.log);
