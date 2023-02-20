let buff = 'Hello\nWorld';
let getlines = ()=>buff.split(/\r?\n/g);

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

console.log(ccurfn(1));

const stdout = process.stdout;

// Set the cursor style to underline
sout.write('\x1B[5 q');

// Wait for 2 seconds
setTimeout(() => {

  // Reset the cursor style
  stdout.write('\x1B[0 q');
}, 2000);