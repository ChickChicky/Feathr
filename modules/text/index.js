const {
    parentPort,
    workerData
} = require('node:worker_threads');

parentPort.postMessage({type:'register-mode',payload:'text'});

parentPort.on('message',(msg)=>{
    if (typeof msg != 'object') return;

    if (msg.type == 'buffer-update') {
        const { id, buff, cx, cy } = msg.payload;
        parentPort.postMessage({type:'update-style',payload:{id,style:[]}});
    }
});