const fs = require('node:fs');
const util = require('node:util');
const crypto = require('node:crypto');
const path = require('node:path');

const VERSION = 'pre-2.0.0';

const sout = process.stdout;
const sin = process.stdin;

const dlen = s => util.stripVTControlCharacters(s).length;

const UpdateEvent = Object.freeze({
    Init   : 'init',
    Update : 'update',
    Resize : 'resize',
    Input  : 'input',
});

var quit = false;

class Window {
    constructor () {}
    update (input) {}
}

class BufferWindow extends Window {
    constructor ( fp ) {
        this.fp = fp;
    }
    update ( input ) {
        
    }
}

class OpenWindow extends Window {
    constructor () {
        super();
        this.p = path.resolve(process.cwd())+path.sep;//.split(RegExp(path.sep,'g'));
        this.f = [];
        this.o = 0;
        this.d = 1;
    }
    update ( input, evt ) {
        // Input handling
        if (input == '\x7f')
            this.p = this.p.slice(0,this.p.length-1);
        else if (!input.startsWith('\x1b'))
            this.p += Array.from(input).map(c=>c.codePointAt()).filter(c=>c > 16).map(c=>String.fromCharCode(c)).join('');
        // Rendering
        let w = Array(sout.rows).fill().map(()=>Array(sout.columns).fill().map(()=>' '));
        
        for (let x = 0; x < sout.columns; x++)
            w[0][x] = w[sout.rows-1][x] = '\u2550';
        for (let y = 0; y < sout.rows; y++)
            w[y][0] = w[y][sout.columns-1] = '\u2551';
        w[0][0] = '\u2554';
        w[0][sout.columns-1] = '\u2557';
        w[sout.rows-1][0] = '\u255A';
        w[sout.rows-1][sout.columns-1] = '\u255D';

        const msg = '\u2561Open a file\u255E';
        for (let i = 0; i < dlen(msg); i++)
            w[0][i+Math.floor(sout.columns/2-dlen(msg)/2)] = msg[i];
        
        const prevp = ' ⟫ ';
        const p = prevp+this.p;
        for (let i = 0; i < dlen(p); i++) 
            w[1][i+1] = p[i];
        w[1][dlen(prevp)] += '\x1b[36m';
        w[1][dlen(p)] += '\x1b[39m';

        if (evt == UpdateEvent.Input) {
            let pt = this.p.split(/\\|\//g);
            let pp = (path.sep+pt.slice(0,-1).join(path.sep)).replace(RegExp(path.sep+path.sep,'g'),path.sep);

            if (fs.existsSync(pp) && fs.statSync(pp).isDirectory())
                fs.promises.readdir(pp).then(
                    files => {
                        this.f = files.filter(f=>f.includes(pt.at(-1))).map(f=>({fn:f,s:fs.statSync(path.join(pp,f))}));
                    }
                );
        }

        for (let i = 0; i < sout.rows-5 && i < this.f.length; i++) {
            for (let j = 0; j < this.f[i].fn.length; j++)
                w[i+3][2+j] = this.f[i].fn[j];
            if (this.f[i].s.isDirectory()) {
                w[i+3][1] += '\x1b[34m';
                w[i+3][this.f[i].fn.length+1] += '\x1b[39m';
            }
        }
        
        sout.write('\x1b[H\x1b[39m'+w.map(l=>l.join('')).join('\n')+`\x1b[2;${this.p.length+5}H`);
    }
}

const windows = {
    windows : [

    ],
    selected : -1
}

const getch = function(encoding='utf-8',stdin=sin) {
    return new Promise(
        r => {
            if (stdin.ref) stdin.ref();
            
            stdin.once( 'data', (d) => {
                r(encoding?d.toString(encoding):d);
                if (stdin.unref && stdin.ref) stdin.unref();
            });

        }
    );
}

let processExitHandler = (x=false) => {   
    sin.setRawMode(false);
    sout.write('\x1b[?1049l\x1b[?25h\x1B[0 q'); // leaves alternative screen buffer
    if (!x) process.exit();
}

process.on('exit',processExitHandler);
process.on('uncaughtException',e=>{
    processExitHandler(true);
    sout.write('\x1b[?1049l\x1b[2J\x1b[G\x1B[0 q');
    console.error(e);
    process.exit();
});
process.on('SIGABRT',processExitHandler);
process.on('SIGTERM',processExitHandler);
process.on('SIGINT',()=>{});
process.on('SIGUSR1',processExitHandler);
process.on('SIGUSR2',processExitHandler);

async function _update(inbuff,evt) {
    sout.write(`\x1b]0;Feathr ${VERSION}\x07`); // window title

    while (windows.selected != null && windows.selected > 0 && windows.selected >= windows.windows.length)
        windows.selected--;

    if (windows.selected < 0)
        windows.selected = null;

    var window = windows.windows[windows.selected];

    if (window) {
        window.update(inbuff,evt);
    } else {
        let msg = 'No active window';
        let k = util.inspect(inbuff,{compact:true});
        process.stdout.write(Array(sout.rows).fill().map((_,i)=>`\x1b[${i+1}H${i==Math.floor(sout.rows/2)?`${' '.repeat(Math.floor(sout.columns/2-dlen(msg)/2))}\x1b[90m${msg}\x1b[39m`:''}${i==Math.floor(sout.rows/2)+1?`${' '.repeat(Math.floor(sout.columns/2-dlen(k)/2))}${k}`:''}\x1b[K`).join(''));
    }
}

var up = [];

function update(inbuff,evt) {
    let p = _update(inbuff,evt);
    p.finally(()=>up=up.filter(pp=>pp!=p));
    up.push(p);
    return p;
}

;(async()=>{

    sout.write('\x1b[?1049h\x1b[H\x1B[5 q'); // enters alternative screen buffe
    sin.setRawMode(true);

    await update('',UpdateEvent.Init);

    process.stdout.on('resize',()=>update('',UpdateEvent.Resize));

    const ui = setInterval(()=>update('',UpdateEvent.Update),100);

    while (!quit) {

        let inbuff = await getch();

        let i = 0;
        let matches = cc => {
            if (inbuff.slice(i,cc.length) != cc) return false;
            i = cc.length;
            return true;
        };

        if (0) {}
        else if (inbuff == '\x03')
            quit = true;
        else if (matches('\x0f')) {
            windows.selected = windows.windows.findIndex(w=>w instanceof OpenWindow);
            if (windows.selected == -1) {
                windows.windows.push(new OpenWindow());
                windows.selected = windows.windows.length-1;
            }
        }

        await update(inbuff.slice(i),UpdateEvent.Input);

    }
    
    clearInterval(ui);

    await Promise.allSettled(up);

})();
