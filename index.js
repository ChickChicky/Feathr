const fs = require('node:fs');
const util = require('node:util');
const crypto = require('node:crypto');
const path = require('node:path');

var quit = false;

const theme = {
    function: '\x1b[38;2;220;220;170m',
    name: '\x1b[38;2;156;220;254m',
    control_keyword: '\x1b[38;2;197;134;192m',
    keyword: '\x1b[38;2;86;156;214m',
    string: '\x1b[38;2;206;145;120m',
    class: '\x1b[38;2;78;201;176m',
    number: '\x1b[38;2;181;206;168m',
    number_radix: '\x1b[38;2;128;194;187m',
    operator: '\x1b[38;2;51;51;51m',
    comment: '\x1b[38;2;106;153;85m',
    const: '\x1b[38;2;79;193;255m',

    highlight: '\x1b[44m',

    markdown_bold:   '\x1b[38;2;86;156;214m\x1b[1m',
    markdown_italic: '\x1b[3m',

    background: '\x1b[48;2;31;31;31m'
}

function safeJSON(str) {
    try {
        return JSON.parse(str);
    } catch {
        return safeJSON.Error;
    }
}
safeJSON.Error = Symbol('JSON parsing error');

const ModuleSettingsSymbol = Symbol('Module Settings');
const ModulePathSymbol = Symbol('Module Path');

const modules = fs
    .readdirSync(path.resolve(__dirname,'extensions'))
    .map(p=>path.resolve(__dirname,'extensions',p))
    .filter(p=>fs.existsSync(path.join(p,'extension.json')))
    .map(p=>({[ModulePathSymbol]:p,[ModuleSettingsSymbol]:safeJSON(fs.readFileSync(path.resolve(p,'extension.json')))}))
    .filter(e=>e[ModuleSettingsSymbol] != safeJSON.Error)
    .map(e=>{
        try {
            if (e[ModuleSettingsSymbol].main) {
                let mod = require(path.resolve(e[ModulePathSymbol],e[ModuleSettingsSymbol].main));
                Object.assign(e,mod);
                return e;
            }
        } catch (e) { console.log(`Error while loading extension: \n`,e); return null }
    })
    .filter(e=>e!=null);

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
    bb_hash:  hash(''),
    langid: 'epu2-asm',
}

{ // loads a file if one has been provided
    let f = process.argv.slice(2).filter(a=>!a.startsWith('-'))[0];
    if (f && fs.existsSync(f)) {
        try { fs.accessSync(f,fs.constants.R_OK) ;
            b.buff = fs.readFileSync(f,'utf-8').replace(/\r\n/g,'\n');
            b.bb_hash = hash(b.buff);
            b.filename = path.basename(f);
            b.filepath = f;
            // makes sure the buffer is in Read-Only mode if the file cannot be written to
            try { fs.accessSync(f,fs.constants.W_OK); b._ro = false }
            catch { b._ro = true }
        } catch {}
    }
}

let b_hash  = () => hash(b.buff);

let alt_buffers = [
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
    },
    b
];

let getlines = ()=>b.buff.split(/\n/g);
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

/**
 * @param {string} p
 * @param {RegExp} pattern
 */
function globMatch(p, pattern) {
    p ??= '';
    pattern ??= '';
    let parts = pattern.split(/\*/g);
    let li = 0;
    for (let pt of parts) {
        let i = p.indexOf(pt,li);
        if (i == -1) return false;
        li = i + pt.length;
    }
    return li == p.length;
}

var rf = null;
function postLanguageUpdate() {
    rf = (modules.find(e=>{if (typeof e.render!='function') return false;
        let contrib = e[ModuleSettingsSymbol].contributes;
        if (!Array.isArray(contrib)) return false;
        return contrib.some(c=>c['lang-id']==b.langid);
    })??{}).render;
}

function languageUpdate() {
    let lang = (modules.map(m=>m[ModuleSettingsSymbol].contributes).filter(m=>Array.isArray(m)&&m.length).flat().find(m=>globMatch(b.filepath,m.matches)||globMatch(path.basename(b.filepath),m.matches))??{})['lang-id'];
    b.langid = lang ?? 'plain-text';
    postLanguageUpdate();
}

function render() {
    let visibleLines = Array(process.stdout.rows-3).fill('');
    let lines;
    let styles = [];
    //let rf = (modules.find(e=>e[ModuleSettingsSymbol]['lang-id'] == b.langid && typeof e.render == 'function') ?? {}).render;
    if (rf) ({lines,styles} = rf(b.buff,[...b.cur0],[...b.cur1],b));
    else    lines = getlines();
    for (let i = 0; i < visibleLines.length; i++) {
        let rl = Array.from(lines[i+b.vscroll] ?? ['\x1b[90m~\x1b[39m']);
        visibleLines[i] = rl.slice(b.hscroll,b.hscroll+sout.columns-5);
    }
    let ri0 = icur0();
        ri1 = icur1();
    let modified = b._ro ? false : (b_hash() != b.bb_hash);
    let middle_txt = `${b.filename}${modified?'\x1b[33m*\x1b[39m':''} ${b._ro?'\x1b[33m(read only)\x1b[39m':''}`;
    let curr = ccurfn(ri1);
    let cupmsg = `[${[curr[1]+1,curr[0]+1].join(':')}]`;
    let i0 = Math.min(ri0,ri1);
    let i1 = Math.max(ri0,ri1);
    let cp = [
        curr[1]+2-b.vscroll,
        curr[0]+6-b.hscroll
    ];
    let inrange = (li,ci,rs,re) => (rs[1]<=li+b.vscroll&&re[1]>=li+b.vscroll&&(re[1]!=li+b.vscroll||re[0]>ci+b.hscroll)&&(rs[1]!=li+b.vscroll||rs[0]<=ci+b.hscroll));
    let c0 = i0 == ri0 ? b.cur0 : b.cur1,
        c1 = i1 == ri1 ? b.cur1 : b.cur0;
    let buffer = 
        `\x1b[?25l` +
        `\x1b[H\x1b[K\x1b[40m` +
        `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n` +
        visibleLines.map((l,li)=>`\x1b[G${theme.background}`+(li+b.vscroll==curr[1]?'\x1b[7m':'')+(li+b.vscroll<0?'':`${(li+b.vscroll+1).toString().padStart(4,' ')}\x1b[27m ${l.map((c,ci)=>theme.background+(styles.filter(s=>inrange(li,ci,s.p0,s.p1)).map(s=>s.s.map(ss=>theme[ss]).join('')).join(''))+(inrange(li,ci,c0,c1)/*(c0[1]<=li+b.vscroll&&c1[1]>=li+b.vscroll&&(c1[1]!=li+b.vscroll||c1[0]>ci+b.hscroll)&&(c0[1]!=li+b.vscroll||c0[0]<=ci+b.hscroll))*/?'\x1b[7m':'')+c+'\x1b[m').join('')}${theme.background}\x1b[K`)).join('\n') +
        `\n\x1b[40m\x1b[K         \x1b[31m^G\x1b[39m Goto    \x1b[31m^C\x1b[39m Copy\x1b[${sout.columns-cupmsg.length}G${cupmsg}`+ 
        `\n\x1b[40m\x1b[K\x1b[31m^ \x1b[39m Menu  \x1b[31m^B\x1b[39m Buffers \x1b[31m^X\x1b[39m Cut \x1b[${sout.columns-util.stripVTControlCharacters(b.langid??'\x1b[33m<none>\x1b[39m').length}G${b.langid??'\x1b[33m<none>\x1b[39m'}`+
        `\x1b[${cp.join(';')}H` +
        `\x1b[?25` + ((cp[0] < 2 || cp[0] > process.stdout.rows-2 || cp[1] < 0 || cp[1] > process.stdout.columns+1)?'l':'h');
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

// async function openMenu(pre='') {
//     let width = sout.columns-10;
//     let org = [Math.floor(sout.rows/2-3/2)+1,Math.floor(sout.columns/2-width/2)]; // [r,c] so it's easier for VT/ANSI escape sequences
//     sout.write(`\x1b[${org.join(';')}H${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}`);
//     let res = await input('',org[1]+1,org[0]+1,
//         /**
//          * @param {string} s
//          */
//         ss => {
//             let [,r,i,s] = ss.match(/^((?:\d+)?)((?:\s*)?)((?:.+?)?)$/);
//             let pre = `\x1b[90m`+r+'\x1b[38m'+i;
//             if (s.startsWith('g')) {
//                 let m = 0;
//                 return pre+'\x1b[40m\x1b[35mg\x1b[39m'+s.slice(1).replace(/(\w+|:|.+?)/g,
//                     v => 
//                         (v.match(/^\d+$/) ? 
//                             m < 2 ?
//                                 '\x1b[33m':
//                                 '\x1b[31m':
//                             v == ':' ? 
//                                 m++ ==0  ? 
//                                     '\x1b[90m':
//                                     '\x1b[31m':
//                                 '\x1b[31m') +
//                         v+'\x1b[39m'   
//                 );
//             }
//             if (s.match(/^c(c?)(\$?)(\$?)(.+?)?$/)) {
//                 return pre+'\x1b[40m\x1b[35mc\x1b[39m' + Object.entries(s.match(/c(?<l>c?)(?<a>\$?)(?<aa>\$?)(?<_>(?:.+)?)/).groups).map(
//                     m =>
//                         (
//                               m[0] == 'l' ?
//                                 '\x1b[35m'
//                             : m[0] == 'a' ?
//                                 '\x1b[36m'
//                             : m[0] == 'aa' ?
//                                 '\x1b[36m'
//                             :
//                                 '\x1b[31m'
//                         ) + m[1] + '\x1b[39m'
                            
//                 ).join('');
//             }
//             if (s.match(/^x(x?)(\$?)(\$?)(.+?)?$/)) {
//                 return pre+'\x1b[40m\x1b[35mx\x1b[39m' + Object.entries(s.match(/x(?<l>x?)(?<a>\$?)(?<aa>\$?)(?<_>(?:.+)?)/).groups).map(
//                     m =>
//                         (
//                               m[0] == 'l' ?
//                                 '\x1b[35m'
//                             : m[0] == 'a' ?
//                                 '\x1b[36m'
//                             : m[0] == 'aa' ?
//                                 '\x1b[36m'
//                             :
//                                 '\x1b[31m'
//                         ) + m[1] + '\x1b[39m'
                            
//                 ).join('');
//             }
//             if (s.match(/^\/(?:(?:(.*?)(\/))?)(.+)$/)) {
//                 let [,f,sp,searchTerm] = s.match(/^\/(?:(?:(.*?)(\/))?)(.+)$/); f??=''; sp??=''; searchTerm??='';
//                 return pre+'\x1b[40m\x1b[35m/\x1b[36m' + f + '\x1b[35m' + sp + '\x1b[32m' + searchTerm + '\x1b[39m';
//             }
//             if (s == 'p') return '\x1b[40m\x1b[35mp\x1b[39m';
//             if (s == 'q') return '\x1b[40m\x1b[35mq\x1b[39m';
//             return pre+'\x1b[37;40m'+s;
//         },
//     pre,'','\x1B\x18');
//     if (res == input.cancel || typeof res == 'symbol' /*to make VSCode happy :)*/) return;
//     let [,rep,cmd] = res.match(/^((?:\d+)?)\s*((?:.+?)?)$/); rep = +rep;
//     for (let i = 0; i < Math.max(1,rep); i++) {
//         if (cmd.match(/^g(\d+)(?::(\d+))?$/)) {
//             let [,l,c] = cmd.match(/^g(\d+)(?::(\d+))?$/);
//             b.cur1 = ccurfn(icurfn([+(c??b.cur1[0]-1)-1,+l-1]));
//             b.cur0 = [...b.cur1];
//         }
//         if (cmd.match(/^c(c?)(\$?)(\$?)$/)) {
//             let [,l,a,aa] = cmd.match(/^c(c?)(\$?)(\$?)$/);
//             let c0 = Math.min(icur0(),icur1()),
//                 c1 = Math.max(icur0(),icur1());
//             yank_buff().buff = (a ? yank_buff().buff+(!aa?'\n':'') : '') + (l ? getlines()[b.cur1[1]] : b.buff.slice(c0,c1));
//         }
//         if (cmd.match(/^x(x?)(\$?)(\$?)$/)) {
//             let [,l,a,aa] = cmd.match(/^x(x?)(\$?)(\$?)$/);
//             let c0 = Math.min(icur0(),icur1()),
//                 c1 = Math.max(icur0(),icur1());
//             yank_buff().buff = (a ? yank_buff().buff+(!aa?'\n':'') : '') + (l ? getlines()[b.cur1[1]] : b.buff.slice(c0,c1));
//             if (l) {
//                 let a0 = icurfn([0,b.cur1[1]]),
//                     a1 = icurfn([Infinity,b.cur1[1]]);
//                 if (!b._ro) b.buff = b.buff.slice(0,a0-1) + b.buff.slice(a1);
//                 b.cur1[1]--;
//                 b.cur0 = [...b.cur1];
//             } else {
//                 if (!b._ro) b.buff = b.buff.slice(0,c0) + b.buff.slice(c1);
//                 b.cur1 = ccurfn(Math.min(c0,c1));
//                 b.cur0 = [...b.cur1];
//             }
//         }
//         if (cmd.match(/^\/(?:(?:(.*?)\/)?)(.+)$/)) {
//             let [,f,searchTerm] = cmd.match(/^\/(?:(?:(.*?)\/)?)(.+)$/); f ??= '';
//             let i1 = icur1();
//             let f1 = (f.includes('i')?b.buff.toLowerCase():b.buff).slice(i1).search(f.includes('i')?searchTerm.toLowerCase():searchTerm);
//             if (f1 == 0) i1++;
//             f1 = (f.includes('i')?b.buff.toLowerCase():b.buff).slice(i1).search(f.includes('i')?searchTerm.toLowerCase():searchTerm);
//             if (f1 != -1) {
//                 b.cur1 = ccurfn(i1+f1);
//                 b.cur0 = ccurfn(i1+f1+searchTerm.length);
//             }
//         }
//         if (cmd == 'p') {
//             write(yank_buff().buff);
//         }
//         if (cmd == 'q') {
//             quit = true;
//         }
//     }
// }

async function openMenu(pre='') {
    let width = sout.columns-10;
    let org = [Math.floor(sout.rows/2-3/2)+1,Math.floor(sout.columns/2-width/2)]; // [r,c] so it's easier for VT/ANSI escape sequences
    sout.write(`\x1b[${org.join(';')}H${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}`);

    let commands = [
        {
            fmt : /^(q)$/,
            ren : () => ['35'],
            run : () => {
                quit = true;
            }
        },
        {
            fmt : /^(:)(?<l>\d+)(?:(:)(?<c>\d+))?$/,
            ren : () => ['35','33','35','33'],
            /** @type {(m:RegExpMatchArray)=>void} */
            run : (m) => {
                let l = +m.groups.l;
                let c = m.groups.c ? +m.groups.c : undefined;
                b.cur1 = ccurfn(icurfn([+(c??b.cur1[0]-1)-1,+l-1]));
                b.cur0 = [...b.cur1];
            },
        },
        {
            fmt : /^(b)(?<idx>\d+)?$/,
            ren : () => ['35','33'],
            run : async (m) => { 
                if (m.groups.idx == undefined) {
                    await bufferMenu();
                } else {
                    let avail_buffers = alt_buffers.filter(b=>b);
                    b = avail_buffers[+m.groups.idx];
                }
            }
        }
    ];

    let res = await input('',org[1]+1,org[0]+1,
        /**
         * @param {string} s
         */
        s => {
            for (let cmd of commands) if (cmd && cmd.fmt instanceof RegExp) {
                let m = s.match(cmd.fmt);
                if (!m) continue;
                try {
                    let ren = typeof cmd.ren == 'function' ? cmd.ren(m) : [];
                    return m.slice(1).map(
                        (v,i) => {
                            if (v == undefined) return undefined;
                            if (ren[i] == null) return undefined;
                            if (ren[i] == undefined) return v;
                            if (Array.isArray(ren[i])) return `${ren[i].map(rr=>`\x1b[${rr}m`).join('')}${v}\x1b[40;39m`;
                            return `\x1b[${ren[i]}m${v}\x1b[40;39m`;
                        }
                    ).filter(v=>v!=undefined).join('');
                } catch {}
            }
            return s;
        },
    pre,'','\x1B\x18');

    if (res == input.cancel || typeof res == 'symbol' /*to make VSCode happy :)*/) return;
    
    for (let cmd of commands) if (cmd && cmd.fmt instanceof RegExp) {
        let m = res.match(cmd.fmt);
        if (!m) continue;
        try { await cmd.run(m,res); } catch { };
        break;
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
            `\n\x1b[40m\x1b[K\x1b[31m^ \x1b[39m Close`+ 
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
    if (b.filepath) {
        try { fs.accessSync(b.filepath,fs.constants.W_OK); delete b['_ro']; }
        catch (e) { b._ro = true }
    }
    if (b._ro) return;
    if (!b.filepath) {
        let width = sout.columns-10;
        let org = [Math.floor(sout.rows/2-3/2)+1,Math.floor(sout.columns/2-width/2)]; // [r,c] so it's easier for VT/ANSI escape sequences
        sout.write(`\x1b[${org.join(';')}H${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}\x1b[B\x1b[${org[1]}G${' '.repeat(width)}`);
        let fp = await input('',org[1]+1,org[0]+1,undefined,undefined,undefined,'\x1B\x18');
        if (fp == input.cancel) return;
        if (fs.existsSync(path.dirname(fp))) {
            b.filepath = path.resolve(fp);
            b.filename = path.basename(fp);
        }
    }
    fs.writeFileSync(b.filepath,b.buff);
    b.bb_hash = b_hash();
}

function yankWrite(str) {
    yank_buff().buff = str;
    sout.write(`\x1b]52;;${btoa(yank_buff().buff)}\x07`);
}

function yankAppend(str) {
    yankWrite(yank_buff().buff+str);
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
    
    languageUpdate();

    sout.write('\x1b[?1049h\x1b[H\x1B[5 q'); // enters alternative screen buffer
    sout.write('\x1b]0;Feathr\x07'); // window title


    let inbuff = '';

    try {
        while (!quit) {
            render();
            //inbuff += Array.from(await getch()).reverse().join('');
            inbuff = await getch() + inbuff;
            //write(util.inspect(inbuff));
            while (inbuff.length) {
                let c = inbuff.slice(0,1);
                //console.log(util.inspect(c));
                let i = 1;
                let matches = cc => {
                    if (inbuff.slice(0,cc.length) != cc) return false;
                    i = cc.length;
                    return true;
                };
                if (false) {}
                else if (matches('\x1b[A'))    move_cursor(  0, -1    );
                else if (matches('\x1b[B'))    move_cursor(  0,  1    );
                else if (matches('\x1b[C'))    move_cursor(  1,  0    );
                else if (matches('\x1b[D'))    move_cursor( -1,  0    );
                else if (matches('\x1b[1;2A')) move_cursor(  0, -1,  1);
                else if (matches('\x1b[1;2B')) move_cursor(  0,  1,  1);
                else if (matches('\x1b[1;2C')) move_cursor(  1,  0,  1);
                else if (matches('\x1b[1;2D')) move_cursor( -1,  0,  1); 
                else if (matches('\x1b[3~')) del();
                else if (matches('\x1b[1~') || matches('\x1b[H')) move_cursor(-Infinity,0);
                else if (matches('\x1b[4~') || matches('\x1b[F')) move_cursor( Infinity,0);
                else if (matches('\x1b[1;2~') || matches('\x1b[1;2H')) move_cursor(-Infinity,0,1);
                else if (matches('\x1b[4;2~') || matches('\x1b[1;2F')) move_cursor( Infinity,0,1);
                else if (c == '\r') {
                    let i = Array.from(getlines()[ccurfn(icur1())[1]].match(/^\s*/))[0].length;
                    write('\n'+' '.repeat(i));
                }
                else if (c == '\t') {
                    write(' '.repeat(4));
                }
                else if (c == '\b' || c == '\x7F') backsp();
                else if (c == '\x1b') await openMenu();
                else if (c.charCodeAt() < 0x1A) { // Ctrl+[key]
                    let k = String.fromCharCode(c.charCodeAt()+64);

                    if (k == 'X' || k == 'C') { // copy / cut
                        let c0 = Math.min(icur0(),icur1()),
                            c1 = Math.max(icur0(),icur1());
                        let c = b.buff.slice(c0,c1);
                        if (c0 == c1) c = b.buff.slice(icurfn([0,b.cur0[1]]),icurfn([getlines()[b.cur0[1]].length,b.cur0[1]]));
                        yankWrite(c);
                        if (k == 'X') {
                            if (!b._ro) b.buff = b.buff.slice(0,c0) + b.buff.slice(c1);
                            b.cur1 = ccurfn(Math.min(c0,c1));
                            b.cur0 = [...b.cur1];
                        }
                    }

                    if (k == 'A') { // select all
                        b.cur1 = ccurfn(Infinity);
                        b.cur0 = [0,0];
                    }
                    
                    if (k == 'G') await openMenu(':');
                    if (k == 'B') await bufferMenu();
                    if (k == 'S') await saveFile();
                }
                else if (inbuff.match(/\x1b\[.+$/g)) {
                    i = inbuff.match(/\x1b\[.+$/g)[0].length;
                }
                else {
                    let wv = util.toUSVString(util.stripVTControlCharacters(c.replace(/[\x1B\0]/g,'').replace(/\r\n/g,'\n')));
                    if (wv.length) write(wv);
                }
                inbuff = inbuff.slice(i);
            }
        }
    } catch (e) {
        sout.write('\x1b[?1049l');
        console.error(e);
    }

})();}
