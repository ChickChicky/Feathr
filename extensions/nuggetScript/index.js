/**
 * Feathr library, its properties are assigned internally
 */
const feathr = {};

const {generateAST,Token} = require('./nugget_script.js');

/**
 * @param {string} buff 
 * @param {[number,number]} cur0 
 * @param {[number,number]} cur1 
 * @param {{cur0:[number,number],cur1:[number,number],vscroll:number,hscroll:number,buff:string,filename:string,filepath:string?,bb_hash:string,langid:string}} b
 * @returns {lines:string[],styles:any[]}
 */
function render(buff,cur0,cur1,b) {
    let styles = [];
    let ast = generateAST(buff);
    //console.log('\x1b[?1049l');
    /**
     * A function used to traverse a node in the AST in order to color it properly
     * it also isolates each scope in order to prevent having variables available where they shouldn't
     * @param {*} node 
     * @param {*} scopev 
     */
    let traverse = (node,scopev=[]) => {
        //console.log(node);
        if (node.type == 'block') {
            let newscope = [...scopev,{}];
            node.children.flat().forEach(c=>traverse(c,newscope));
        }
        if (node.type == 'fn') {
            styles.push({s:'keyword',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
            styles.push({s:'function',p0:[node.children[0].at(-2).__t.cn,node.children[0].at(-2).__t.ln],p1:[node.children[0].at(-2).__t.cn+node.children[0].at(-2).__t.length,node.children[0].at(-2).__t.ln]});
            scopev.at(-1)[node.children[0].at(-2).ref.toString()] = {type:'function'};
            traverse(node.children[0].at(-3),scopev);
            node.children[1].forEach(c=>traverse(c,scopev));
        }
        if (node.type == 'ref') {
            if (node.reftype == 'name') {
                let vars = scopev.reduce((acc,v)=>Object.assign(acc,v),{});
                let vr = vars[node.ref.toString()];
                if (vr) {
                    if (vr.type ==  'function')
                        styles.push({s:'function',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
                    else if (vr.type == 'type' || vr.type == 'class')
                        styles.push({s:'class',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
                    else
                        styles.push({s:'name',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
                }
            }
            if (node.reftype == 'string') {
                styles.push({s:'string',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
            }
        }
        if (node.type == 'call') {
            traverse(node.value,scopev);
            node.children.flat().forEach(c=>traverse(c,scopev));
        }
        if (node.type == 'assign') {
            traverse(node.name,scopev);
            node.children.flat().map(c=>traverse(c,scopev));
        }
        if (node.type == 'return') {
            styles.push({s:'control_keyword',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
            node.buffer.forEach(c=>traverse(c,scopev));
        }
        if (node.type == 'var') {
            styles.push({s:'keyword',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
            if ((node.buffer[0]??{}).ref instanceof Token) {
                scopev.at(-1)[node.buffer[0].ref.toString()] = {type:'any'};
                traverse(node.buffer[0],scopev);
            }
        }
        if (node.type == 'loop') {
            styles.push({s:'control_keyword',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
            let newscope = [...scopev,{}];
            node.children.flat().forEach(c=>traverse(c,newscope));
        }
        if (node.type == 'break') {
            styles.push({s:'control_keyword',p0:[node.__t.cn,node.__t.ln],p1:[node.__t.cn+node.__t.length,node.__t.ln]});
        }
    }
    traverse(ast,[{
        printf: {type:'function'},

        void: {type:'type'},
        string: {type:'type'},
        int: {type:'type'},
        float: {type:'type'},
        bool: {type:'type'},
        function: {type:'type'},
    }]);

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

    let c0 = icur0(),
        c1 = icur1();

    let cc0 = ccurfn(c0),
        cc1 = ccurfn(c1);

    // bracket pairs colorization
    if (c0 == c1 && '({['.includes(b.buff[c0])) {
        let matching = b.buff[c0];
        let i = c0;
        let c = 1;
        while (i < buff.length) {
            i++;
            if (b.buff[i] == matching) c++;
            else if (b.buff[i] == {'{':'}','[':']','(':')'}[matching]) c--;
            if (c == 0) {
                let cp = ccurfn(i);
                styles.push({s:'highlight',p0:[...cp],p1:[cp[0]+1,cp[1]]});        
                break;
            }
        }
        styles.push({s:'highlight',p0:[...cur0],p1:[cur0[0]+1,cur0[1]]});
    }

    else if (c0 == c1 && '({['.includes(b.buff[c0-1])) {
        let matching = b.buff[c0-1];
        let i = c0-1;
        let c = 1;
        while (i < buff.length) {
            i++;
            if (b.buff[i] == matching) c++;
            else if (b.buff[i] == {'{':'}','[':']','(':')'}[matching]) c--;
            if (c == 0) {
                let cp = ccurfn(i);
                styles.push({s:'highlight',p0:[cp[0],cp[1]],p1:[cp[0]+1,cp[1]]});        
                break;
            }
        }
        styles.push({s:'highlight',p0:[cc0[0]-1,cc0[1]],p1:[cc0[0],cc0[1]]});
    }

    else if (c0 == c1 &&  ')}]'.includes(b.buff[c0-1])) {
        let matching = b.buff[c0-1];
        let i = c0-1;
        let c = 1;
        while (i >= 0) {
            i--;
            if (b.buff[i] == matching) c++;
            else if (b.buff[i] == {'}':'{',']':'[',')':'('}[matching]) c--;
            if (c == 0) {
                let cp = ccurfn(i);
                styles.push({s:'highlight',p0:[...cp],p1:[cp[0]+1,cp[1]]});        
                break;
            }
        }
        styles.push({s:'highlight',p0:[cc0[0]-1,cc0[1]],p1:[cc0[0],cc0[1]]});
    }

    else if (c0 == c1 &&  ')}]'.includes(b.buff[c0])) {
        let matching = b.buff[c0];
        let i = c0;
        let c = 1;
        while (i >= 0) {
            i--;
            if (b.buff[i] == matching) c++;
            else if (b.buff[i] == {'}':'{',']':'[',')':'('}[matching]) c--;
            if (c == 0) {
                let cp = ccurfn(i);
                styles.push({s:'highlight',p0:[...cp],p1:[cp[0]+1,cp[1]]});        
                break;
            }
        }
        styles.push({s:'highlight',p0:[cc0[0],cc0[1]],p1:[cc0[0]+1,cc0[1]]});
    }

    //process.exit();
    return {lines:buff.split(/\n/g),styles};
}

module.exports = {render,feathr};