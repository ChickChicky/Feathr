const {
    parentPort,
    workerData
} = require('node:worker_threads');

const cp = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const util = require('node:util');

parentPort.postMessage({type:'register-mode',payload:'python'});

class Logger {

    static formatDate( d ) {
        return d.toLocaleString('en-GB',{hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }
    
    static now() {
        return Logger.formatDate(new Date());
    }

    constructor ( fp ) {
        this.fp = fp;
        this.lines = [];
        if (!fs.existsSync(path.dirname(this.fp))) {
            fs.mkdirSync(path.dirname(this.fp),{recursive:true});
        }
    }

    log( ...args ) {
        let t = Logger.now() + ' \x1b[36m[log]\x1b[39m ' + args.map( v => typeof v == 'string' ? v : util.inspect(v,{compact:false}) );
        fs.appendFileSync(this.fp,util.stripVTControlCharacters(t)+'\n',{encoding:'utf-8'});
        this.lines.push(t);
    }

    error( ...args ) {
        let t = Logger.now() + ' \x1b[31m[err]\x1b[39m ' + args.map( v => typeof v == 'string' ? v : util.inspect(v,{compact:false}) );
        fs.appendFileSync(this.fp,util.stripVTControlCharacters(t)+'\n',{encoding:'utf-8'});
        this.lines.push(t);
    }

}
const logger = new Logger( path.join(__dirname,'logs.log') );

var id   = '', 
    buff = '', 
    cx   = 0,
    cy   = 0
;

const port = 3878;

const serv = http.createServer(
    (req,res) => {
        let payload = '';
        req.on('data',data=>{payload+=data;});
        req.once('end',()=>{
            try {
                let data = JSON.parse(payload);
                if (data.type == 'fetch') {
                    res.statusCode = 200;
                    res.write(JSON.stringify({err:null,id,buff,cx,cy}));
                    res.end();
                } else if (data.type == 'update-style') {
                    if (id) parentPort.postMessage({type:'update-style',payload:Object.assign({id},data)});
                } else {
                    res.statusCode = 400;
                    res.end(JSON.stringify({err:'Invalid request type'}));
                }
            } catch (e) {
                if (e instanceof SyntaxError) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({err:'Malformed request payload'}));
                } else
                    throw e;
            }
        });
    }
).listen(port,'localhost');

const mod = cp.spawn('python3',[path.join(__dirname,'module.py'),port]);
mod.stdout.on('data',d=>logger.log(d.toString('utf-8')));
mod.stderr.on('data',d=>logger.log(d.toString('utf-8')));

parentPort.on('message',(msg)=>{
    if (typeof msg != 'object') return;

    if (msg.type == 'buffer-update') {
        id   = msg.payload.id;
        buff = msg.payload.buff;
        cx   = msg.payload.cx;
        cy   = msg.payload.cy;
    }
});