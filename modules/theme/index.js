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
        'emptyline': {
            s: '\x1b[38;2;68;71;90m'
        },
        'back': {
            s: '\x1b[48;2;40;42;54m'
        },
        'back-current': {
            s: '\x1b[48;2;68;71;90m'
        },
        'back-menu': {
            s: '\x1b[48;2;15;17;29m'
        },
        'menutitle': {
            s: '\x1b[38;2;189;147;249m'
        },

        'keyword': {
            s: '\x1b[38;2;255;121;198m'
        },
        'function': {
            s: '\x1b[38;2;80;250;123m'
        },
        'const': {
            s: '\x1b[38;2;255;184;108m'
        },
        'numeric': {
            s: '\x1b[38;2;189;147;249m'
        },
        'string': {
            s: '\x1b[38;2;241;250;140m'
        }
    }
}});