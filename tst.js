const crypto = require('node:crypto');
const util = require('node:util');

const hash = d => crypto.createHash('sha1').update(d).digest('hex');

let b = {
  cur0: [0,0],
  cur1: [0,0],
  vscroll: 0,
  hscroll: 0,
  buff: Array(5000).fill('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').join('\n'),
  bb_hash: 0,
}

let b_hash = () => hash(b.buff);

let getlines = ()=>b.buff.split(/\r?\n/g);

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

const sout = process.stdout;

function r_ref() {
  console.time('(ref) a');
  let visibleLines = Array(process.stdout.rows-3).fill('');
  let lines = getlines();
  for (let i = 0; i < visibleLines.length; i++) {
      let rl = Array.from(lines[i+b.vscroll] ?? ['\x1b[90m~\x1b[39m']);
      visibleLines[i] = rl.slice(b.hscroll,b.hscroll+sout.columns-5);
  }
  console.timeEnd('(ref) a');
  console.time('(ref) b');
  let modified = b._ro ? false : (b_hash() != b.bb_hash);
  let middle_txt = `${b.filename}${modified?'\x1b[33m*\x1b[39m':''} ${b._ro?'\x1b[33m(read only)\x1b[39m':''}`;
  let curr = ccurfn(icur1());
  let cupmsg = `[${[curr[0]+1,curr[1]+1].join(':')}]`;
  let i0 = Math.min(icur0(),icur1());
  let i1 = Math.max(icur0(),icur1());
  let cp = [
      curr[1]+2-b.vscroll,
      curr[0]+6-b.hscroll
  ];
  console.timeEnd('(ref) b');
  console.time('(ref) 0');
  `\x1b[?25` + ((cp[0] < 2 || cp[0] > process.stdout.rows-2 || cp[1] < 0 || cp[1] > process.stdout.columns+1)?'l':'h')
  console.timeEnd('0');
  console.time('(ref) 1');
  `\x1b[H\x1b[K\x1b[40m`
  console.timeEnd('(ref) 1');
  console.time('(ref) 2');
  `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n`
  console.timeEnd('(ref) 2');
  console.time('(ref) 3');
  visibleLines.map((l,li)=>`\x1b[K`+(li+b.vscroll==curr[1]?'\x1b[7m':'')+(li+b.vscroll<0?'':`${(li+b.vscroll+1).toString().padStart(4,' ')}\x1b[27m ${l.map((c,ci)=>(icurfn([ci,li])>=i0?'\x1b[7m':'')+(icurfn([ci,li])>=i1?'\x1b[27m':'')+c+'\x1b[27m').join('')}`)).join('\n')
  console.timeEnd('(ref) 3');
  console.time('(ref) 4');
  `\n\x1b[40m\x1b[K\x1b[31m^X\x1b[39m Exit  \x1b[31m^G\x1b[39m Goto\x1b[${sout.columns-cupmsg.length}G${cupmsg}`
  console.timeEnd('(ref) 4');
  console.time('(ref) 5');
  `\n\x1b[40m\x1b[K\x1b[31m^C\x1b[39m Menu  \x1b[31m^B\x1b[39m Buffers`
  console.timeEnd('(ref) 5');
  console.time('(ref) 6');
  `\x1b[${cp.join(';')}H`
  console.timeEnd('(ref) 6');
}

function render() {
  console.time('a');
  let visibleLines = Array(process.stdout.rows-3).fill('');
  let lines = getlines();
  for (let i = 0; i < visibleLines.length; i++) {
      let rl = Array.from(lines[i+b.vscroll] ?? ['\x1b[90m~\x1b[39m']);
      visibleLines[i] = rl.slice(b.hscroll,b.hscroll+sout.columns-5);
  }
  console.timeEnd('a');
  console.time('b');
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
  console.timeEnd('b');
  console.time('0');
  `\x1b[?25` + ((cp[0] < 2 || cp[0] > process.stdout.rows-2 || cp[1] < 0 || cp[1] > process.stdout.columns+1)?'l':'h')
  console.timeEnd('0');
  console.time('1');
  `\x1b[H\x1b[K\x1b[40m`
  console.timeEnd('1');
  console.time('2');
  `[${' '.repeat(Math.floor(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2)-1)}${middle_txt}\x1b[39;40m${' '.repeat(Math.ceil(sout.columns/2-util.stripVTControlCharacters(middle_txt).length/2-1))}]\x1b[m\n`
  console.timeEnd('2');
  console.time('3');
  visibleLines.map((l,li)=>`\x1b[K`+(li+b.vscroll==curr[1]?'\x1b[7m':'')+(li+b.vscroll<0?'':`${(li+b.vscroll+1).toString().padStart(4,' ')}\x1b[27m ${l.map((c,ci)=>((c0[1]>=li&&c1[1]<=li&&(c1[1]!=li||c1[0]>ci)&&(c0[1]!=li||c0[0]<=ci))?'\x1b[7m':'')+c+'\x1b[27m').join('')}`)).join('\n')
  console.timeEnd('3');
  console.time('4');
  `\n\x1b[40m\x1b[K\x1b[31m^X\x1b[39m Exit  \x1b[31m^G\x1b[39m Goto\x1b[${sout.columns-cupmsg.length}G${cupmsg}`
  console.timeEnd('4');
  console.time('5');
  `\n\x1b[40m\x1b[K\x1b[31m^C\x1b[39m Menu  \x1b[31m^B\x1b[39m Buffers`
  console.timeEnd('5');
  console.time('6');
  `\x1b[${cp.join(';')}H`
  console.timeEnd('6');
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

function move_cursor(dc,dr,mod) {
  console.time('a');
  let i0 = icur0(),
      i1 = icur1(),
      l  = getlines();
  console.timeEnd('a');
  console.time('b');
  let indent = Array.from(l[b.cur1[1]].match(/^\s*/))[0].length;
  console.timeEnd('b');
  console.time('c');
  let c0 = Math.min(i0,i1),
      c1 = Math.max(i0,i1);
  console.timeEnd('c');
  console.time('d');
  if (mod == 1) { // shift
      if (dc) {
          if (dc == Infinity)
              b.cur1[0] = l[b.cur1[1]].length;
          else if (dc == -Infinity)
              b.cur1[0] = b.cur1[0] == indent ? 0 : indent;
          else
              b.cur1 = ccurfn(icur1()+dc);
      }
      if (dr) {
          b.cur1 = [b.cur1[0],Math.min(l.length,Math.max(0,b.cur1[1]+dr))];
      }
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
                  b.cur1[0] = l[b.cur1[1]].length;
              else if (dc == -Infinity)
                  b.cur1[0] = b.cur1[0] == indent ? 0 : indent;
              else
                  b.cur1 = ccurfn(icur1()+dc);
              b.cur0 = [...b.cur1];
          }
      }
      if (dr) {
          b.cur1 = [b.cur1[0],Math.min(l.length,Math.max(0,b.cur1[1]+dr))];
          b.cur0 = [...b.cur1];
      }
  }
  adjust_view();
  console.timeEnd('d');
}

function mc_ref(dc,dr,mod) {
  console.time('(ref) b');
  console.time('(ref) a');
  let indent = Array.from(getlines()[ccurfn(icur1())[1]].match(/^\s*/))[0].length;
  let c0 = Math.min(icur0(),icur1()),
      c1 = Math.max(icur0(),icur1());
  console.timeEnd('(ref) a');
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
  console.timeEnd('(ref) b');
}


console.log('CURSOR MOVEMENT\n')

console.time('total');
move_cursor(1,0);
console.timeEnd('total');
console.time('(ref) total');
mc_ref(1,0);
console.timeEnd('(ref) total');


console.log('\n\nRENDERING\n');

console.time('total');
render();
console.timeEnd('total');
console.time('(ref) total');
r_ref();
console.timeEnd('(ref) total');