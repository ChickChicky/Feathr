const {
    parentPort,
    workerData
} = require('node:worker_threads');

parentPort.postMessage({type:'register-mode',payload:'foo-lang'});
parentPort.postMessage({type:'register-style',payload:{
    id: 'foo-style',
    kind: 'applicable',
    styles: {
        'foo': [
            'keyword',
            {
                s: '\x1b[35m',
            }
        ],
        'bar': [
            'function',
            {
                s: '\x1b[32m',
            }
        ],
        'baz': [
            'const',
            {
                s: '\x1b[33m',
            }
        ],
    }
}});

class FooBuffer {
    constructor ( buff ) {
        /** @type {string} */
        this.buff = buff;
        this.cx = 0;
        this.cy = 0;
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
    getPosOf(i) {
        let b = this.buff.slice(0,i);
        return [b.length-Math.max(-1,b.lastIndexOf('\n'))-1,(b.match(/\n/g)||[]).length];
    }
}

const buffer = new FooBuffer();

parentPort.on('message',(msg)=>{
    if (typeof msg != 'object') return;

    if (msg.type == 'buffer-update') {
        const { id, buff, cx, cy } = msg.payload;
        buffer.buff = buff;
        buffer.cx = cx;
        buffer.cy = cy;
        const style = [];
        style.push(...Array.from(buffer.buff.matchAll(/foo/gi)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['foo'],c0:c,c1:c+2,l0:l,l1:l}}));
        style.push(...Array.from(buffer.buff.matchAll(/bar/gi)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['bar'],c0:c,c1:c+2,l0:l,l1:l}}));
        style.push(...Array.from(buffer.buff.matchAll(/baz/gi)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['baz'],c0:c,c1:c+2,l0:l,l1:l}}));
        style.push(...Array.from(buffer.buff.matchAll(/hello/gi)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['underline-double'],c0:c,c1:c+4,l0:l,l1:l}}));
        style.push(...Array.from(buffer.buff.matchAll(/world/gi)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['italic'],c0:c,c1:c+4,l0:l,l1:l}}));
        parentPort.postMessage({type:'update-style',payload:{id,style}});
    }
});