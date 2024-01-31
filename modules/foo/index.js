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
                s: '\x1b[31m',
            }
        ]
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
        return [b.length-Math.max(0,b.lastIndexOf('\n')),(b.match(/\n/g)||[]).length];
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
        const style = Array.from(buffer.buff.matchAll(/foo/g)).map(m=>m.index).map(m=>{const [c,l] = buffer.getPosOf(m); return {s:['foo'],c0:c,c1:c+2,l0:l,l1:l}});
        parentPort.postMessage({type:'update-style',payload:{id,style}});
    }
});