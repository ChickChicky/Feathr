const fs = require('node:fs');
const util = require('node:util');
const crypto = require('node:crypto');

const hash = d => crypto.createHash('sha1').update(d).digest('hex');

const sout = process.stdout;
const sin  = process.stdin;

let buff = 'Hello';
let getlines = ()=>buff.split(/\r?\n/g);

let b_hash  = () => hash(buff);
let bb_hash = b_hash();

let vscroll = 0,
    hscroll = 0;

let cur0 = [0,0],
    cur1 = [0,0];

let ccurfn = (i) => {
    let sb = buff.slice(0,Math.max(0,i));
    let pl = sb.split('\n').slice(0,-1).reduce((acc,v)=>acc+v.length+1,0);
    return [Math.min(Math.max(0,i-pl),sb.split('\n').at(-1).length),(sb.match(/\n/g)??[]).length];
}
let icurfn = (cur) => {
    let l = getlines();
    let pl = l.slice(0,cur[1]);
    let cl = l[Math.max(0,Math.min(l.length-1,cur[1]))];
    return Math.max(Math.min(cl.length,cur[0]),0) + pl.reduce((acc,v)=>v.length+1+acc,0);
}
let icur0 = () => icurfn(cur0);
let icur1 = () => icurfn(cur1);

const noFile = Symbol('<new file>');
/** @type {string|Symbol} */
let filename = noFile;

/**
 * Returns the current position of the cursor
 */
async function DSR() {
    process.stdout.write(`\x1b[6n`);
    return Array.from((await getch('utf-8')).match(/\x1b\[(\d*);(\d*)R/)).slice(1).map(n=>+(n|'0'));
}
const getch = function(encoding='utf-8',stdin=process.stdin) {
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
        let ch = await getch('utf-8',()=>Key.ctrl.c,()=>Key.ctrl.d);
        let oc = cur;
        if (ch == '\r' || exitChars.includes(ch)) {
        } else if (ch == Key.backspace) {
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
            let v = stripVTCC(ch);
            val = val.slice(0,cur) + v + val.slice(cur);
            cur += v.length;
        }
        let prePrompt = (typeof x == 'number' && typeof x == typeof y) ? `\x1b[${y};${x}H` : `${(oc+(typeof prompt == 'function' ? prompt(val) : prompt).length)?`\x1b[${oc+(typeof prompt == 'function' ? prompt(val) : prompt).length}D`:''}`;
        let value  = ( typeof replace == 'function' ? await replace(val) : val );
            value += ( !val.length ? placeHolder||'' : value.length-stripVTCC(placeHolder).length>0 ? ' '.repeat(value.length-stripVTCC(placeHolder).length) : '' );
        let resetPos = `\x1b[${(await DSR()).join(';')}H`;
        await update(val,ch);
        process.stdout.write(resetPos + prePrompt + (typeof prompt == 'function' ? await prompt(val) : prompt) + value + ((ch == '\b' || ch == '\x1b[3~')?' ':'') + ((ch != '\r') ? `\x1b[${(stripVTCC(value).length-cur+(ch == '\b' || ch == '\x1b[3~'))?`\x1b[${stripVTCC(value).length-cur+(ch == '\b' || ch == '\x1b[3~')}D`:''}` : ''));
        if (ch == '\r') {
            process.stdout.write('\n');
            return val;
        }
        if (exitChars.includes(ch)) {
            return CancelChar;
        }
    }
}

function render() {
    let visibleLines = Array(process.stdout.rows-3).fill('');
    let lines = getlines();
    for (let i = 0; i < visibleLines.length; i++) {
        visibleLines[i] = lines[i+vscroll] ?? '\x1b[90m~\x1b[m';
    }
    let modified = b_hash() != bb_hash;
    let middle_txt = `${filename==noFile?`\x1b[36m${filename.description}\x1b[39m`:filename}${modified?'\x1b[33m*\x1b[39m':''}`;
    let curr = ccurfn(icur1());
    let cp = [
        curr[1]+2-vscroll,
        curr[0]+6-hscroll
    ];
    let buffer = 
        `\x1b[?25` + ((cp[0] < 2 || cp[0] > process.stdout.rows-2 || cp[1] < 0 || cp[1] > process.stdout.columns)?'l':'h') +
        `\x1b[H\x1b[K\x1b[40m` +
        `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n` + 
        visibleLines.map((l,li)=>`\x1b[K`+(li+vscroll<0?'':`${(li+vscroll+1).toString().padStart(4,' ')} ${Array.from(l).map((c,ci)=>(Math.min(cur1[0],cur0[0])==ci&&Math.min(cur1[1],cur0[1])==li?'\x1b[7m':'')+(Math.max(cur1[0],cur0[0])==ci&&Math.max(cur1[1],cur0[1])==li?'\x1b[27m':'')+c).join('')}`)).join('\n') + 
        `\n\x1b[40m\x1b[K\x1b[31m^X\x1b[39m Exit`+ 
        `\n\x1b[40m\x1b[K`+
        `\x1b[${cp.join(';')}H`
    ;
    sout.write(buffer);
    adjust_view();
}

function adjust_view() {
    let viewable_range = [vscroll,Math.min(process.stdout.rows+vscroll-2)];
    if (cur1[1] >= viewable_range[1]-2) {
        vscroll = cur1[1]+1;
    }
    if (cur1[1] < viewable_range[0]) {
        vscroll = cur1[1]-process.stdout.rows-2;
    }
}

/**
 * Writes to the the buffer at the cursor position
 * @param {string} v the character(s) to write
 * @param {bool}   s whether the cursor should stay in place
 */
function write(v,s=false) {
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
    buff = buff.slice(0,c0) + v + buff.slice(c1);
    if (!s) {
        cur1 = ccurfn(c0+v.length);
        cur0 = [...cur1];
    }
}

function backsp() {
    let c0 = Math.min(icur0(),icur1()),
        c1 = Math.max(icur0(),icur1());
    if (c0 != c1) {
        buff = buff.slice(0,c0  ) + buff.slice(c1);
    }
    else {
        buff = buff.slice(0,Math.max(0,c0-1)) + buff.slice(c1);
        cur1 = ccurfn(c0-1);
        cur0 = [...cur1];
    }
}

function move_cursor(dr,dc,shift) {
    if (shift) {

    } else {
        cur1 = [cur1[0]+dr,cur1[1]+dc];
        cur0 = [...cur1];
    }
}

let processExitHandler = () => {   
    sout.write('\x1b[?1049l\x1b[?25h'); // leaves alternative screen buffer
    process.exit();
}

process.on('exit',processExitHandler);
process.on('uncaughtException',processExitHandler);
process.on('SIGABRT',processExitHandler);
process.on('SIGTERM',processExitHandler);
process.on('SIGINT',()=>{});
process.on('SIGUSR1',processExitHandler);
process.on('SIGUSR2',processExitHandler);

{(async()=>{

    sout.write('\x1b[?1049h\x1b[H'); // enters alternative screen buffer
    sout.write('\x1b]0;Feathr\7'); // window title

    try {
        while (true) {
            render();
            let c = await getch();
            //console.log(util.inspect(c));
            if (c == '\r') write('\n');
            else if (c == '\b' || c == '\x7F') backsp();
            else if (c == '\x1b') null; // maybe menu key ?
            else if (c == '\x1b[A') move_cursor(0,-1);
            else if (c == '\x1b[B') move_cursor(0,1);
            else if (c == '\x1b[C') move_cursor(1,0);
            else if (c == '\x1b[D') move_cursor(-1,0);
            else if (c.charCodeAt() < 0x1A) {
                let k = String.fromCharCode(c.charCodeAt()+64);
                if (k == 'X') break;
            }
            else {
                let wv = util.stripVTControlCharacters(c);
                if (wv.length) write(wv);
            }
        }
    } catch (e) {
        sout.write('\x1b[?1049l');
        console.error(e);
    }

})();}