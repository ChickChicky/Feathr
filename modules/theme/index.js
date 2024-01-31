const {
    parentPort,
    workerData
} = require('node:worker_threads');

parentPort.postMessage({type:'register-style',payload:{
    id: 'default',
    kind: 'theme',
    styles: {
        
        'bold': {
            s: '\x1b[1m',
        },
        'italic': {
            s: '\x1b[3m',
        },
        'faint': {
            s: '\x1b[2m',
        },
        'underline': {
            s: '\x1b[4m',
        },
        'underline-double': {
            s: '\x1b[21m',
        },
        'strike': {
            s: '\x1b[9m',
        },
        'invert': {
            s: '\x1b[7m',
        },

        'text': {
            s: '\x1b[38;2;248;248;242m',
        },
        'back': {
            s: '\x1b[48;2;40;42;54m'
        },

        'keyword': {
            s: '\x1b[38;2;255;121;198m'
        }
    }
}});