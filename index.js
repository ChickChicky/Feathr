const fs = require('node:fs');
const util = require('node:util');
const path = require('node:path');

const lev = require('js-levenshtein');

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
    constructor ( buff ) {
        super();
        this.sx = 0;
        this.sy = 0;
        this.cx = 0;
        this.cy = 0;
        /** @type {string} */
        this.buff = buff||'';
        this.cr = (this.buff.match(/\r/g)||[]).length*1.5 >= (this.buff.match(/\n/g)||[]).length;
    }
    getLines() {
        return this.buff.split('\n');
    }
    getLinesCount() {
        return (this.buff.match(/\n/g)||[]).length+1;
    }
    getFixedCursor() {
        let cx = this.cx;
        let cy = this.cy;
        let l = this.getLines();
        cx = Math.max(0,Math.min((l[cy]||'').length,cx));
        return [cx,cy,l];
    }
    getCursorIndex() {
        let [cx,cy,l] = this.getFixedCursor();
        return l.slice(0,cy).map(l=>l.length+1).reduce((acc,l)=>acc+l,0)+cx;
    }
    update ( input, evt, catches ) {
        let w = Array(sout.rows).fill().map(()=>Array(sout.columns).fill().map(()=>' '));

        if (evt == UpdateEvent.Input) {
            let i = this.getCursorIndex();
            let fix = (nocur) => {
                if (!nocur) [this.cx,this.cy] = this.getFixedCursor();
                let [cx,cy] = this.getFixedCursor();
                while (cy-this.sy+2 > sout.rows-1)
                    this.sy++;
                while (cy-this.sy < 0)
                    this.sy--;
                while (cx-this.sx+6 > sout.columns)
                    this.sx++;
                while (cx-this.sx < 0)
                    this.sx--;
            }
            if (input == '\x7f') {
                this.buff = this.buff.slice(0,i-1) + this.buff.slice(i);
                this.cx--;
                if (this.cx < 0 && this.cy > 0) {
                    this.cx = Infinity;
                    this.cy--;
                }
                fix();
            }   
            else if (input == '\x1b')
                ;
            else if (input == '\x1b[A') {
                this.cy = Math.max(0,this.cy-1);
                fix(true);
            }
            else if (input == '\x1b[B') {
                this.cy = Math.min(this.getLinesCount()-1,this.cy+1);
                fix(true);
            }
            else if (input == '\x1b[C') {
                fix();
                this.cx++;
                fix();
            }
            else if (input == '\x1b[D') {
                fix();
                this.cx--;
                fix();
            }
            else if (input == '\x1b[1;5A')
                this.sy = Math.max(0,this.sy-1);
            else if (input == '\x1b[1;5B')
                this.sy++;
            else if (input == '\x1b[1;5D')
                this.sx = Math.max(0,this.sx-1);
            else if (input == '\x1b[1;5C')
                this.sx++;
            else if (input == '\x1b[H') {
                this.cx = 0;
                fix();
            }
            else if (input == '\x1b[F') {
                this.cx = Infinity;
                fix();
            }
            else if (input == '\r' || input == '\n') {
                this.buff = this.buff.slice(0,i) + '\n' + this.buff.slice(i);
                this.cy++
                this.cx = 0;
                fix();
            }
            else if (!input.startsWith('\x1b')) {
                let inp = Array.from(input).map(c=>c.codePointAt()).filter(c=>c > 31).map(c=>String.fromCharCode(c)).join('');
                this.buff = this.buff.slice(0,i) + inp + this.buff.slice(i);
                this.cx += inp.length;
                fix();
            }
        }

        let lines = this.buff.split('\n');

        for (let i = 0; i < sout.rows-2; i++) {
            let li = i+1;
            let ll = i+this.sy;
            let ln = (i+this.sy+1).toString().padStart(3,' ').slice(0,3)+' ';
            for (let j = 0; j < ln.length; j++)
                w[li][j] = ln[j];
            if (i+this.sy == this.cy) {
                w[li][0] = '\x1b[7m'+w[li][0];
                w[li][ln.length-2] += '\x1b[27m';
            }
            let l = lines[ll];
            if (l != undefined)
                for (let j = 0; j < l.length && j < sout.columns-ln.length; j++) {
                    let ci = j+this.sx;
                    if (j == 0 && ci != 0)
                        w[li][j+ln.length] = '\x1b[90m…\x1b[39m';
                    else
                        w[li][j+ln.length] = l[ci]||' ';
                }
            else
                w[li][ln.length+1] = '\x1b[90m~\x1b[39m';
        }

        w[sout.rows-1][0] = '\x1b[40m[';
        w[sout.rows-1][sout.columns-1] = ']\x1b[49m';

        if (catches)
            return w;
        else {
            w[0][0] = '[';
            w[0][sout.columns-1] = ']';
            {
                let msg = '<buffer>';
                for (let i = 0; i < msg.length; i++)
                    w[0][Math.floor(sout.columns/2-msg.length/2)+i] = msg[i];
            }
            {
                const msg = 'buffer';
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][i+2] = msg[i];
                w[sout.rows-1][1] += '\x1b[35m';
                w[sout.rows-1][1+dlen(msg)] += '\x1b[39m';
            }
            {
                const msg = (this.cy+1).toString().padStart(3,' ');
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][sout.columns-9+i] = msg[i];
            }
            {
                const msg = (this.cx+1).toString().padEnd(3,' ');
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][sout.columns-5+i] = msg[i];
            }
            w[sout.rows-1][sout.columns-6] = '\x1b[39m:\x1b[33m';
            w[sout.rows-1][sout.columns-3] += '\x1b[39m';
            w[sout.rows-1][sout.columns-10] += '\x1b[33m';
            let [cx,cy] = this.getFixedCursor();
            sout.write('\x1b[H\x1b[39m'+w.map(l=>l.join('')).join('\n')+`\x1b[${Math.max(1,Math.min(sout.rows-1,cy-this.sy+1))+1};${Math.max(0,Math.min(sout.columns-3,cx-this.sx))+5}H`);
        }
    }
}

class FileWindow extends BufferWindow {
    constructor ( fp ) {
        let n = !fs.existsSync(fp);
        super(!n?fs.readFileSync(fp,'utf-8').replace(/\r\n/g,'\n'):'');
        this.fp = fp;
        this.new = n;
    }
    update ( input, evt ) {
        if (input == '\x13') // Ctrl+S
            ;
        else {
            let w = super.update(input,evt,true);
            w[0][0] = '[';
            w[0][sout.columns-1] = ']';
            let msg = path.basename(this.fp);
            for (let i = 0; i < msg.length; i++)
                w[0][Math.floor(sout.columns/2-msg.length/2)+i] = msg[i];
            {
                const msg = 'file';
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][i+2] = msg[i];
                w[sout.rows-1][1] += '\x1b[35m';
                w[sout.rows-1][1+dlen(msg)] += '\x1b[39m';
            }
            {
                const msg = (this.cy+1).toString().padStart(3,' ');
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][sout.columns-9+i] = msg[i];
            }
            {
                const msg = (this.cx+1).toString().padEnd(3,' ');
                for (let i = 0; i < msg.length; i++)
                    w[sout.rows-1][sout.columns-5+i] = msg[i];
            }
            w[sout.rows-1][sout.columns-6] = '\x1b[39m:\x1b[33m';
            w[sout.rows-1][sout.columns-3] += '\x1b[39m';
            w[sout.rows-1][sout.columns-10] += '\x1b[33m';
            let [cx,cy] = this.getFixedCursor();
            sout.write('\x1b[H\x1b[39m'+w.map(l=>l.join('')).join('\n')+`\x1b[${Math.max(1,Math.min(sout.rows-1,cy-this.sy+1))+1};${Math.max(0,Math.min(sout.columns-3,cx-this.sx))+5}H`);
        }
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
        else if (input == '\x1b')
            windows.windows = windows.windows.filter(w=>w!=this);
        else if (input == '\r' || input == '\n') {
            if (!fs.existsSync(this.f) || fs.statSync(this.f).isFile()) {
                windows.windows = windows.windows.filter(w=>w!=this);
                windows.windows.push(new FileWindow(this.p));
                windows.selected = windows.windows.length-1;
            }
        }
        else if (!input.startsWith('\x1b'))
            this.p += Array.from(input).map(c=>c.codePointAt()).filter(c=>c > 31).map(c=>String.fromCharCode(c)).join('');
        
        // Rendering
    
        let w = Array(sout.rows).fill().map(()=>Array(sout.columns).fill().map(()=>' '));

        w[0][0] = '\x1b[40m[';
        w[0][sout.columns-1] = ']\x1b[49m';
        const msg = 'Open a file';
        for (let i = 0; i < msg.length; i++)
            w[0][Math.floor(sout.columns/2-msg.length/2)+i] = msg[i];
        
        const prevp = '⟫ ';
        const p = prevp+this.p;
        for (let i = 0; i < dlen(p); i++) 
            w[1][i] = p[i];
        w[1][dlen(prevp)-1] += '\x1b[36m';
        w[1][dlen(p)] += '\x1b[39m';

        if (evt == UpdateEvent.Input) {
            let pt = this.p.split(/\\|\//g);
            let pp = (path.sep+pt.slice(0,-1).join(path.sep)).replace(RegExp(path.sep+path.sep,'g'),path.sep);

            if (fs.existsSync(pp) && fs.statSync(pp).isDirectory())
                fs.promises.readdir(pp).then(
                    files => {
                        this.f = files.map(f=>({fn:f,s:fs.statSync(path.join(pp,f))}));
                        let idx = this.f.map((f,i)=>[f,lev(f.fn,pt.at(-1))-f.fn.includes(pt.at(-1))*(pt.at(-1).length+1),i]).sort((a,b)=>a[1]-b[1]);
                        this.f = idx.map(([f,s,i])=>this.f[i]);
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
        
        sout.write('\x1b[H\x1b[39m'+w.map(l=>l.join('')).join('\n')+`\x1b[2;${dlen(p)+1}H`);
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
        else if (inbuff == '\x0e') {
            windows.windows.push(new BufferWindow());
            windows.selected = windows.windows.length-1;
        }
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
