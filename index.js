const fs = require('node:fs');
const util = require('node:util');
const crypto = require('node:crypto');
const path = require('node:path');

const sout = process.stdout;
const sin = process.stdin;

const dlen = s => util.stripVTControlCharacters(s).length;

var quit = false;

class Window {
    constructor () { throw new Error(); }
    update (input) { throw new Error(); }
}

class BufferWindow extends Window {
    constructor ( fp ) {
        this.fp = fp;
    }
    update ( input ) {
        
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
    console.log(e);
    process.exit();
});
process.on('SIGABRT',processExitHandler);
process.on('SIGTERM',processExitHandler);
process.on('SIGINT',()=>{});
process.on('SIGUSR1',processExitHandler);
process.on('SIGUSR2',processExitHandler);

async function render(inbuff) {
    while (windows.selected != null && windows.selected > 0 && windows.selected >= windows.windows.length)
            windows.selected--;

        if (windows.selected < 0)
            windows.selected = null;

        var window = windows.windows[windows.selected];

        if (window) {

        } else {
            let msg = 'No active window.';
            process.stdout.write(Array(sout.rows).fill().map((_,i)=>`\x1b[${i+1}H${i==Math.floor(sout.rows/2)?`${' '.repeat(Math.floor(sout.columns/2-msg.length/2))}\x1b[90m${msg}\x1b[49m`:''}\x1b[K`).join(''));
        }
}

;(async()=>{

    sout.write('\x1b[?1049h\x1b[H\x1B[5 q'); // enters alternative screen buffer
    sout.write('\x1b]0;Feathr\x07'); // window title
    sin.setRawMode(true);

    await render('');

    process.stdout.on('resize',()=>render(''));

    while (!quit) {

        let inbuff = await getch();

        let i = 1;
        let matches = cc => {
            if (inbuff.slice(0,cc.length) != cc) return false;
            i = cc.length;
            return true;
        };

        if (0) {}
        else if (inbuff == '\x03')
            quit = true;

        await render(inbuff);

    }

})();
