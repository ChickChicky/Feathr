const fs = require('node:fs');
const util = require('node:util');
const crypto = require('node:crypto');
const path = require('node:path');

const hash =   d   => crypto.createHash('sha1').update(d).digest('hex');
const mod  = (a,b) => ((a%b)+b)%b;

const sout = process.stdout;
const sin  = process.stdin;

let cb = 0;
let b = {
    cur0: [0,0],
    cur1: [0,0],
    vscroll: 0,
    hscroll: 0,
    buff: '',
    filename: 'new buffer',
    filepath: null,
    bb_hash:  hash('')
}

{
    let f = process.argv.slice(2).filter(a=>!a.startsWith('-'))[0];
    if (f && fs.existsSync(f)) {
        b.buff = fs.readFileSync(f,'utf-8');
        b.bb_hash = hash(b.buff);
        b.filename = path.basename(f);
        b.filepath = f;
    }
}

let b_hash  = () => hash(b.buff);

let alt_buffers = [
    b,
    {
        _ro :      true,
        _internal: true,
        
        filename: 'yank',
        filepath: null,
        cur0: [0,0],
        cur1: [0,0],
        vscroll: 0,
        hscroll: 0,
        buff: '',
        bb_hash: 0
    }
];

let getlines = ()=>b.buff.split(/\r?\n/g);
let current_buffer = ()=>alt_buffers[cb];
let yank_buff = ()=>alt_buffers.find(b=>b._internal&&b.filename=='yank');

let ccurfn = (i) => {
    let sb = b.buff.slice(0,Math.max(0,i));
    let pl = sb.split('\n').slice(0,-1).reduce((acc,v)=>acc+v.length+1,0);
    return [Math.min(Math.max(0,i-pl),sb.split('\n').at(-1).length),(sb.match(/\n/g)??[]).length];
}
let icurfn = (cur) => {
    let l = getlines();
    let pl = l.slice(0,cur[1]);
    let cl = l[Math.max(0,Math.min(l.length-1,cur[1]))];
    return Math.max(Math.min(cl.length,cur[0]),0) + pl.reduce((acc,v)=>v.length+1+acc,0);
}
let icur0 = () => icurfn(b.cur0);
let icur1 = () => icurfn(b.cur1);

/**
 * Returns the current position of the cursor
 */
async function DSR() {
    process.stdout.write(`\x1b[6n`);
    let c;
    while (!c) c = (await getch('utf-8')).match(/\x1b\[(\d*);(\d*)R/);
    return Array.from(c).slice(1).map(n=>+(n|'0'));
}
const getch = function(encoding='utf-8',stdin=sin) {
    return new Promise(
        r => {

            let rawmode;
            
            if (stdin.setRawMode) rawmode = stdin.setRawMode(true);
            if (stdin.ref)        stdin.ref();
            
            stdin.once( 'data', (d) => {
                r(encoding?d.toString(encoding):d);
                if (stdin.setRawMode)         stdin.setRawMode(rawmode);
                if (stdin.unref && stdin.ref) stdin.unref();
            });

        }
    );
}

const Key = {
    // bindings for ctrl+KEY
    ctrl: {
        a: '\x01', b: '\x02', c: '\x03', d: '\x04', e: '\x05', f: '\x06', g: '\x07', h: '\x08', i: '\x09', j: '\x0a', k: '\x0b', l: '\x0c', n: '\x0e', o: '\x0f', p: '\x10', q: '\x11', r: '\x12', s: '\x13',  t: '\x14', u: '\x15', v: '\x16', w: '\x17',  x: '\x18', y: '\x19', z: '\x1a',

        '@':  '\x00', '`': '\x00', '[': '\x1b', '{': '\x1b', 
        '\\': '\x1c', '|': '\x1c', ']': '\x1d', '}': '\x1d',
        '^':  '\x1e', '~': '\x1e', '_': '\x1f', '?': '\x7f',

        'up': '\x1b[1;5A',    'down': '\x1b[1;5B',
        'right': '\x1b[1;5C', 'left': '\x1b[1;5D',

        'home': '\x1b[1;5~',   'end': '\x1b[4;5~',
        'pageup': '\x1b[5;5~', 'pagedown': '\x1b[6;5~',
        'insert': '\x1b[2;5~', 'delete': '\x1b[3;5~',
    },

    // bindings for shift+KEY
    shift: {
        'up': '\x1b[1;2A',    'down': '\x1b[1;2B',
        'right': '\x1b[1;2C', 'left': '\x1b[1;2D',

        'home':   '\x1b[1;2~', 'end':      '\x1b[4;2~',
        'pageup': '\x1b[5;2~', 'pagedown': '\x1b[6;2~',
        'insert': '\x1b[2;2~', 'delete':   '\x1b[3;2~',
    },

    // bindings for ctrl+shift+KEY
    ctrl_shift: {
        'up':    '\x1b[1;6A', 'down': '\x1b[1;6B',
        'right': '\x1b[1;6C', 'left': '\x1b[1;6D',

        'home':   '\x1b[1;6~', 'end':      '\x1b[4;6~',
        'pageup': '\x1b[5;6~', 'pagedown': '\x1b[6;6~',
        'insert': '\x1b[2;6~', 'delete':   '\x1b[3;6~',
    },

    a: 'a', b: 'b', c: 'c', d: 'd', e: 'e',
    f: 'f', g: 'g', h: 'h', i: 'i', j: 'j',
    k: 'k', l: 'l', m: 'm', n: 'n', o: 'o',
    p: 'p', q: 'q', r: 'r', s: 's', t: 't',
    u: 'u', v: 'v', w: 'w', x: 'x', y: 'y',
    z: 'z',

    A: 'A', B: 'B', C: 'C', D: 'D', E: 'E',
    F: 'F', G: 'G', H: 'H', I: 'I', J: 'J',
    K: 'K', L: 'L', M: 'M', N: 'N', O: 'O',
    P: 'P', Q: 'Q', R: 'R', S: 'S', T: 'T',
    U: 'U', V: 'V', W: 'W', X: 'X', Y: 'Y',
    Z: 'Z',

    // Ctrl+S
    save: '\x13',
    // Ctrl+V
    paste: '\x16',
    // Ctrl+X
    cut: '\x18',
    // Ctrl+C
    copy: '\x03',

    backspace: '\x08',
    delete: '\x1b[3~', del: '\x1b[3~',
    up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C',
    home: '\x1b[1~', end: '\x1b[4~',
    enter: '\r', escape: '\x1b',
}

/**
 * @param {string} prompt the prompt to show before the text
 * @param {number?} x the X position of the text
 * @param {number?} y the Y position of the text
 * @param {((string)=>string)?} replace a function that gets called with the current text and that should return what to display instead
 * @param {string?} defaultValue the defalt value 
 * @param {string?} placeHolder text to display when nothing is written
 * @param {((string)=>void)?} update a function called whenever the value is modified
 */
async function input(prompt,x,y,replace,defaultValue,placeHolder='',exitChars='',update=()=>undefined) {
    let val = defaultValue || '', // the text being written
        cur = (defaultValue || '').length; // the cursor position
    {
        let prePrompt = (typeof x == 'number' && typeof x == typeof y) ? `\x1b[${y};${x}H` : ``;
        let value = typeof replace == 'function' ? replace(val) : val;
        process.stdout.write(prePrompt  + (typeof prompt == 'function' ? prompt(value) : prompt) + value);
    }
    while (true) {
        let ch = await getch('utf-8');
        let oc = cur;
        if (ch == '\r' || exitChars.includes(ch)) {
        } else if (ch == '\b' || ch == '\x7F') {
            val = val.slice(0,cur-1) + val.slice(cur);
            cur = Math.max(0, cur-1);
        } else if (ch == Key.left) {
            cur = Math.max(0, cur-1);
        } else if (ch == Key.right) {
            cur = Math.min(val.length, cur+1);
        } else if (ch == Key.home) {
            cur = 0;
        } else if (ch == Key.end) {
            cur = val.length;
        } else if (ch == Key.delete) {
            val = val.slice(0,cur) + val.slice(cur+1);
        } else if (Object.values(Key.shift).concat(Object.values(Key.ctrl),Object.values(Key.ctrl_shift)).includes(ch)) {
        } else {
            let v = util.stripVTControlCharacters(ch);
            val = val.slice(0,cur) + v + val.slice(cur);
            cur += v.length;
        }
        let prePrompt = (typeof x == 'number' && typeof x == typeof y) ? `\x1b[${y};${x}H` : `${(oc+(typeof prompt == 'function' ? prompt(val) : prompt).length)?`\x1b[${oc+(typeof prompt == 'function' ? prompt(val) : prompt).length}D`:''}`;
        let value  = ( typeof replace == 'function' ? await replace(val) : val );
            value += ( !val.length ? placeHolder||'' : value.length-util.stripVTControlCharacters(placeHolder).length>0 ? ' '.repeat(util.stripVTControlCharacters(value).length-util.stripVTControlCharacters(placeHolder).length) : '' );
        let resetPos = `\x1b[${(await DSR()).join(';')}H`;
        await update(val,ch);
        process.stdout.write(resetPos + prePrompt + (typeof prompt == 'function' ? await prompt(val) : prompt) + value + ((ch == '\b' || ch == '\x7F' || ch == '\x1b[3~')?' ':'') + ((ch != '\r') ? `\x1b[${(util.stripVTControlCharacters(value).length-cur+(ch == '\b' || ch == '\x7F' || ch == '\x1b[3~'))?`\x1b[${util.stripVTControlCharacters(value).length-cur+(ch == '\b' || ch == '\x7F' || ch == '\x1b[3~')}D`:''}` : ''));
        if (ch == '\r') {
            process.stdout.write('\n');
            return val;
        }
        if (exitChars.includes(ch)) {
            return input.cancel;
        }
    }
}
input.cancel = Symbol('CANCEL');

function render() {
    let visibleLines = Array(process.stdout.rows-3).fill('');
    let lines = getlines();
    for (let i = 0; i < visibleLines.length; i++) {
        let rl = Array.from(lines[i+b.vscroll] ?? ['\x1b[90m~\x1b[39m']);
        visibleLines[i] = rl.slice(b.hscroll,b.hscroll+sout.columns-5);
    }
    let ri0 = icur0();
        ri1 = icur1();
    let modified = b._ro ? false : (b_hash() != b.bb_hash);
    let middle_txt = `${b.filename}${modified?'\x1b[33m*\x1b[39m':''} ${b._ro?'\x1b[33m(read only)\x1b[39m':''}`;
    let curr = ccurfn(ri1);
    let cupmsg = `[${[curr[0]+1,curr[1]+1].join(':')}]`;
    let i0 = Math.min(ri0,ri1);
    let i1 = Math.max(ri0,ri1);
    let cp = [
        curr[1]+2-b.vscroll,
        curr[0]+6-b.hscroll
    ];
    let c0 = i0 == ri0 ? b.cur0 : b.cur1,
        c1 = i1 == ri1 ? b.cur1 : b.cur0;
    let buffer = 
        `\x1b[?25` + ((cp[0] < 2 || cp[0] > process.stdout.rows-2 || cp[1] < 0 || cp[1] > process.stdout.columns+1)?'l':'h') +
        `\x1b[H\x1b[K\x1b[40m` +
        `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n` +
        visibleLines.map((l,li)=>`\x1b[K`+(li+b.vscroll==curr[1]?'\x1b[7m':'')+(li+b.vscroll<0?'':`${(li+b.vscroll+1).toString().padStart(4,' ')}\x1b[27m ${l.map((c,ci)=>((c0[1]>=li&&c1[1]<=li&&(c1[1]!=li||c1[0]>ci)&&(c0[1]!=li||c0[0]<=ci))?'\x1b[7m':'')+c+'\x1b[27m').join('')}`)).join('\n') +
        `\n\x1b[40m\x1b[K\x1b[31m^X\x1b[39m Exit  \x1b[31m^G\x1b[39m Goto\x1b[${sout.columns-cupmsg.length}G${cupmsg}`+ 
        `\n\x1b[40m\x1b[K\x1b[31m^C\x1b[39m Menu  \x1b[31m^B\x1b[39m Buffers`+
        `\x1b[${cp.join(';')}H`
    ;
    sout.write(buffer);
}

function adjust_view() {
    // Y adjust
    while (b.cur1[1] >= Math.min(process.stdout.rows+b.vscroll-2)-1) {
        b.vscroll++;
    }
    while (b.cur1[1] < b.vscroll) {
        b.vscroll--;
    }

    // X adjust
    while (b.cur1[0] >= Math.min(process.stdout.columns+b.hscroll-3)-1) {
        b.hscroll++;
    }
    while (b.cur1[0] < b.hscroll) {
        b.hscroll--;
    }
}

/**
 * Writes to the the buffer at the cursor position
 * @param {string} v the character(s) to write
 * @param {bool}   s whether the cursor should stay in place
 */
function write(v,s=false) {
    if (b._ro) return;
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
        b.buff = b.buff.slice(0,c0) + v + b.buff.slice(c1);
    if (!s) {
        b.cur1 = ccurfn(c0+v.length);
        b.cur0 = [...b.cur1];
    }
    adjust_view();
}

function backsp() {
    if (b._ro) return;
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
    if (c0 != c1) {
        b.buff = b.buff.slice(0,c0) + b.buff.slice(c1);
        b.cur1 = ccurfn(Math.min(c0,c1));
        b.cur0 = [...b.cur1];
    }
    else {
        b.buff = b.buff.slice(0,Math.max(0,c0-1)) + b.buff.slice(c1);
        b.cur1 = ccurfn(c0-1);
        b.cur0 = [...b.cur1];
    }
    adjust_view();
}

function del() {
    if (b._ro) return;
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
    if (c0 != c1) {
        b.buff = b.buff.slice(0,c0) + b.buff.slice(c1);
        b.cur1 = ccurfn(Math.min(c0,c1));
        b.cur0 = [...b.cur1];
    }
    else {
        b.buff = b.buff.slice(0,c1) + b.buff.slice(Math.max(0,c1+1));
    }
    adjust_view();
}

function move_cursor(dc,dr,mod) {
    let indent = Array.from(getlines()[ccurfn(icur1())[1]].match(/^\s*/))[0].length;
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
    if (mod == 1) { // shift
        if (dc) {
            if (dc == Infinity)
                b.cur1[0] = getlines()[b.cur1[1]].length;
            else if (dc == -Infinity)
                b.cur1[0] = b.cur1[0] == indent ? 0 : indent;
            else
                b.cur1 = ccurfn(icur1()+dc);
        }
        if (dr) {
            b.cur1 = [b.cur1[0],Math.min(getlines().length,Math.max(0,b.cur1[1]+dr))];
        }
        adjust_view();
    } else if (mod == 2) { // ctrl
        b.vscroll += dr;
        b.hscroll += dc;
    } else {
        if (dc) {
            if (c0 != c1) {
                if (dc < 0) {
                    b.cur1 = ccurfn(c0);
                } else {
                    b.cur1 = ccurfn(c1);
                }
                b.cur0 = [...b.cur1];
            } else {
                if (dc == Infinity)
                    b.cur1[0] = getlines()[b.cur1[1]].length;
                else if (dc == -Infinity)
                    b.cur1[0] = b.cur1[0] == indent ? 0 : indent;
                else
                    b.cur1 = ccurfn(icur1()+dc);
                b.cur0 = [...b.cur1];
            }
        }
        if (dr) {
            b.cur1 = [b.cur1[0],Math.min(getlines().length,Math.max(0,b.cur1[1]+dr))];
            b.cur0 = [...b.cur1];
        }
        adjust_view();
    }
}

async function openMenu(pre='') {
    let width = sout.columns-10;
    let org = [Math.floor(sout.rows/2-3/2)+1,Math.floor(sout.columns/2-width/2)]; // [r,c] so it's easier for VT/ANSI escape sequences
    sout.write(`\x1b[${org.join(';')}H${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}`);
    let cmd = await input('',org[1]+1,org[0]+1,
        /**
         * @param {string} s
         */
        s => {
            if (s.startsWith('g')) {
                let m = 0;
                return '\x1b[40m\x1b[35mg\x1b[39m'+s.slice(1).replace(/(\w+|:|.+?)/g,
                    v => 
                        (v.match(/^\d+$/) ? 
                            m < 2 ?
                                '\x1b[33m':
                                '\x1b[31m':
                            v == ':' ? 
                                m++ ==0  ? 
                                    '\x1b[90m':
                                    '\x1b[31m':
                                '\x1b[31m') +
                        v+'\x1b[39m'   
                );
            }
            if (s.match(/^c(c?)(\$?)(.+?)?$/)) {
                return '\x1b[40m\x1b[35mc\x1b[39m' + Object.entries(s.match(/c(?<l>c?)(?<a>\$?)(?<_>(?:.+)?)/).groups).map(
                    m =>
                        (
                              m[0] == 'l' ?
                                '\x1b[35m'
                            : m[0] == 'a' ?
                                '\x1b[36m'
                            :
                                '\x1b[31m'
                        ) + m[1] + '\x1b[39m'
                            
                ).join('');
            }
            if (s.match(/^x(x?)(\$?)(.+?)?$/)) {
                return '\x1b[40m\x1b[35mx\x1b[39m' + Object.entries(s.match(/x(?<l>x?)(?<a>\$?)(?<_>(?:.+)?)/).groups).map(
                    m =>
                        (
                              m[0] == 'l' ?
                                '\x1b[35m'
                            : m[0] == 'a' ?
                                '\x1b[36m'
                            :
                                '\x1b[31m'
                        ) + m[1] + '\x1b[39m'
                            
                ).join('');
            }
            if (s == 'p') return '\x1b[40m\x1b[35mp\x1b[39m';
            return '\x1b[37;40m'+s;
        },
    pre,'','\x1B\x18 ');
    if (cmd == input.cancel) return;
    if (cmd.match(/^g(\d+)(?::(\d+))?$/)) {
        let [,l,c] = cmd.match(/^g(\d+)(?::(\d+))?$/);
        b.cur1 = ccurfn(icurfn([+(c??b.cur1[0]-1)-1,+l-1]));
        b.cur0 = [...b.cur1];
    }
    if (cmd.match(/^c(c?)(\$?)$/)) {
        let [,l,a] = cmd.match(/^c(c?)(\$?)$/);
        let c0 = Math.min(icur0(),icur1()),
            c1 = Math.max(icur0(),icur1());
        yank_buff().buff = (a ? yank_buff().buff+'\n' : '') + (l ? getlines()[b.cur1[1]] : b.buff.slice(c0,c1));
    }
    if (cmd.match(/^x(x?)(\$?)$/)) {
        let [,l,a] = cmd.match(/^x(x?)(\$?)$/);
        let c0 = Math.min(icur0(),icur1()),
            c1 = Math.max(icur0(),icur1());
        yank_buff().buff = (a ? yank_buff().buff+'\n' : '') + (l ? getlines()[b.cur1[1]] : b.buff.slice(c0,c1));
        if (l) {
            let a0 = icurfn([0,b.cur1[1]]),
                a1 = icurfn([Infinity,b.cur1[1]]);
            if (!b._ro) b.buff = b.buff.slice(0,a0) + b.buff.slice(a1);
        } else {
            if (!b._ro) b.buff = b.buff.slice(0,c0) + b.buff.slice(c1);
            b.cur1 = ccurfn(Math.min(c0,c1));
            b.cur0 = [...b.cur1];
        }
    }
    if (cmd == 'p') {
        write(yank_buff().buff);
    }
    if (cmd == 'e') {
        yank_buff().buff += 'E';
    }
}

async function bufferMenu() {
    let avail_buffers = alt_buffers.filter(b=>b);
    let cur = avail_buffers.indexOf(b);
    function render() {
        let l = Array(process.stdout.rows-3).fill().map(
            (_,i) => {
                let b = avail_buffers[i];
                return b ? `${b._internal?'\x1b[33m':''}${b.filename}\x1b[39m` : '';
            }
        );
        let middle_txt = `Buffer Selection`;
        let buffer = 
            `\x1b[H\x1b[K\x1b[40m` +
            `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n` +
            l.map((ll,i)=>`\x1b[K${i==cur?'\x1b[7m':''}${ll}\x1b[27m`).join('\n') +
            `\n\x1b[40m\x1b[K\x1b[31m^X\x1b[39m Close`+ 
            `\n\x1b[40m\x1b[K`
        ;
        sout.write(buffer);
    }
    sout.on('resize',render);
    while (true) {
        render();
        let c = await getch();
        if (c == '\r') {
            b = avail_buffers[cur];
            break;
        }
        if (c == '\x1b[A') {
            cur = mod(cur-1,avail_buffers.length);
        }
        if (c == '\x1b[B') {
            cur = mod(cur+1,avail_buffers.length);
        }
        if (c == '\x1b' || c == '\x02' || c == '\x18') break;
    }
    sout.off('resize',render);
}

async function saveFile() {
    if (b._internal || b._ro) return;
    if (!b.filepath) {
        let width = sout.columns-10;
        let org = [Math.floor(sout.rows/2-3/2)+1,Math.floor(sout.columns/2-width/2)]; // [r,c] so it's easier for VT/ANSI escape sequences
        sout.write(`\x1b[${org.join(';')}H${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}`);
        let fp = await input('',org[1]+1,org[0]+1);
        if (fp == input.cancel) return;
        if (fs.existsSync(path.dirname(fp))) {
            b.filepath = path.resolve(fp);
            b.filename = path.basename(fp);
        }
    }
    fs.writeFileSync(b.filepath,b.buff);
    b.bb_hash = b_hash();
}

let processExitHandler = () => {   
    sout.write('\x1b[?1049l\x1b[?25h\x1B[0 q'); // leaves alternative screen buffer
    process.exit();
}

process.on('exit',processExitHandler);
process.on('uncaughtException',e=>{
    sout.write('\x1b[?1049l\x1b[2J\x1b[G\x1B[0 q');
    console.log(e);
});
process.on('SIGABRT',processExitHandler);
process.on('SIGTERM',processExitHandler);
process.on('SIGINT',()=>{});
process.on('SIGUSR1',processExitHandler);
process.on('SIGUSR2',processExitHandler);

sout.on('resize',render);

{(async()=>{


    sout.write('\x1b[?1049h\x1b[H\x1B[5 q'); // enters alternative screen buffer
    sout.write('\x1b]0;Feathr\7'); // window title

    try {
        while (true) {
            render();
            let c = await getch();
            //console.log(util.inspect(c));
            if (c == '\r') {
                let i = Array.from(getlines()[ccurfn(icur1())[1]].match(/^\s*/))[0].length;
                write('\n'+' '.repeat(i));
            }
            else if (c == '\t') {
                write(' '.repeat(4));
            }
            else if (c == '\x1b') {
                b.cur0 = [...b.cur1];
            }
            else if (c == '\b' || c == '\x7F') backsp();
            else if (c == '\x1b[A') move_cursor( 0,-1);
            else if (c == '\x1b[B') move_cursor( 0, 1);
            else if (c == '\x1b[C') move_cursor( 1, 0);
            else if (c == '\x1b[D') move_cursor(-1, 0);
            else if (c == '\x1b[1;2A') move_cursor( 0,-1,1);
            else if (c == '\x1b[1;2B') move_cursor( 0, 1,1);
            else if (c == '\x1b[1;2C') move_cursor( 1, 0,1);
            else if (c == '\x1b[1;2D') move_cursor(-1, 0,1); 
            else if (c == '\x1b[3~') del();
            else if (c == '\x1b[1~' || c == '\x1b[H') move_cursor(-Infinity,0);
            else if (c == '\x1b[4~' || c == '\x1b[F') move_cursor( Infinity,0);
            else if (c == '\x1b[1;2~') move_cursor(-Infinity,0,1);
            else if (c == '\x1b[4;2~') move_cursor( Infinity,0,1);
            else if (c.charCodeAt() < 0x1A) { // Ctrl+[key]
                let k = String.fromCharCode(c.charCodeAt()+64);
                if (k == 'X') break;
                if (k == 'A') {
                    b.cur1 = ccurfn(Infinity);
                    b.cur0 = [0,0];
                }
                if (k == 'C') await openMenu();
                if (k == 'G') await openMenu('g');
                if (k == 'B') await bufferMenu();
                if (k == 'S') await saveFile();
            }
            else {
                let wv = util.stripVTControlCharacters(c).replace(/\x1B/g,'');
                if (wv.length) write(wv);
            }
        }
    } catch (e) {
        sout.write('\x1b[?1049l');
        console.error(e);
    }

})();}
