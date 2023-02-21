const {inspect} = require('node:util');
const sin = process.stdin;
let orm = sin.setRawMode(true);
sin.on('data',d=>{
    console.log(inspect(d.toString('utf-8')));
    if (d == '\x1b') process.exit();
});