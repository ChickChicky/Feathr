/**
 * Feathr library, its properties are assigned internally
 */
const feathr = {};

/**
 * Represents any token
 */
class Token extends String {

    /**
     * @param {string|*} value the value of the token (most likely a string)
     * @param {number} ln the line the token is located at
     * @param {number} cn the column the character is located at
     * @param {string} fn the name of the file containing the token
     * @param {string} l the whole line of the token
     */
    constructor ( value, ln,cn,fn,l ) {
        super ( value );

        /** @type {number} the line the token was created at */
        this.ln = ln;
        /** @type {string} the file the token was created at */
        this.fn = fn;
        /** @type {number} the column the token was created at */
        this.cn = cn;

        /** @type {string} the whole line containing the token */
        this.l = l;
    }

    static from( v,t ) {
        return new this( v, t.ln,t.cn,t.fn,t.l );
    }

}

/**
 * Creates tokens from the provided piece of code
 * @param {string} code the code to tokenize
 * @returns {Token[]}
 */
function tokenize(code,fn) {
    code = code.replace(/\r/g,'');
    let tokens = [];

    let tk = '';
    let s = 0;
    for (let c of code) {
        if (s) s--;
        if (c == '\\')
            s = 2;
        tk += c;
        if (!tk.startsWith('`') && '`!:;.,()[]{}|*/-+=<>%$^#& \\'.includes(c)) {
            let l = tokens.at(-1)+tk;
            if (['**','\\*'].includes(l)) {
                tokens = tokens.slice(0,-1);
                tokens.push(l);
                tk = '';
            } 
            else if (tokens.slice(-5).join('')+tk == '<!--') {
                tokens = tokens.slice(0,-5);
                tokens.push('<!--');
                tk = '';
            } 
            else if (tokens.slice(-3).join('')+tk == '-->') {
                tokens = tokens.slice(0,-3);
                tokens.push('-->');
                tk = '';
            } 
            else {
                tokens.push(tk.slice(0,-1));
                tokens.push(c);
                tk = '';
            }
        }
        if (c == '\n') {
            tokens.push(tk.slice(0,-1));
            tokens.push(c);
            tk = '';
        }
        if (c == ' ' && !tk.startsWith('`') && !tk.startsWith('\'')) {
            tokens.push(tk);
            tk = '';
        }
        if (!s) if (c == '`' && tk.charAt(0) == '`' && tk.length>1) {
            tokens.push(tk);
            tk = '';
        }
        if (!s) if (c == '\'' && tk.charAt(0) == '\'' && tk.length>1) {
            tokens.push(tk);
            tk = '';
        }
    }
    if (tk) tokens.push(tk);

    let cn = 0;
    let ln = 0;

    let lines = [''];
    for (let t of tokens) {
        if (t == '\n') lines.push('');
        else lines[lines.length-1] += t;
    }

    tokens = tokens.map(
        t => [
            new Token( t, ln,cn, fn, lines[ln] ),
            ( t == '\n' ? [cn=0,ln++] : (cn+=t.length) )
        ][0]
    );

    {   // post-processes the tokens for easier parsing
        let ntokens = [];

        for (let t of tokens) {
            if (t == '\n') {
                ntokens.push(t);
            }
            else if (t.match(/^ +$/g)) {
                if (!(ntokens.at(-1)??'').match(/^ +$/g))
                    ntokens.push('');
                ntokens[ntokens.length-1] = Token.from(ntokens[ntokens.length-1] + t, t);
            } else 
                if (t.length) ntokens.push(t);
        }

        tokens = ntokens;
    }

    return tokens;
}

/**
 * @param {string} buff 
 * @param {[number,number]} cur0 
 * @param {[number,number]} cur1 
 * @param {{cur0:[number,number],cur1:[number,number],vscroll:number,hscroll:number,buff:string,filename:string,filepath:string?,bb_hash:string,langid:string}} b
 * @returns {lines:string[],styles:any[]}
 */
function render(buff,cur0,cur1,b) {
    let styles = [];

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

    let tokens = tokenize(buff);

    let li   = [-1,-1],
        lb   = [-1,-1],
        cb   = [-1,-1],
                        //                 [Text](Link)
        la00 = [-1,-1], // link anchor A 1 [
        la01 = [-1,-1], // link anchor A 2      ]
        la10 = [-1,-1], // link anchor B 1       (
        la11 = [-1,-1]; // link anchor B 2            )
    let i = 0;
    for (let tk of tokens) {
        // headers
        if (tk.toString() == '#') {
            styles.push({s:'markdown_bold',p0:[tk.cn,tk.ln],p1:[Infinity,tk.ln]});
        }
        // list bullet
        if (
            ( tk.toString() == '*' ||
              tk.toString() == '-'    ) && (
                ((tokens[i-1]??'\n').toString() == '\n') || 
                ((tokens[i-2]??'').toString()   == '\n'  && (tokens[i-1]??'').match(/^\s+$/))
            )
        ) {
            styles.push({s:'keyword',p0:[tk.cn,tk.ln],p1:[tk.cn+1,tk.ln]});
        }
        // italic
        else if (tk.toString() == '*') {
            if (li[0] == li[1] && li[0] == -1) {
                li = [tk.cn,tk.ln];
            } else {
                styles.push({s:'markdown_italic',p0:li,p1:[tk.cn+1,tk.ln]});
                li = [-1,-1];
            }
        }
        // bold
        if (tk.toString() == '**') {
            if (lb[0] == lb[1] && lb[0] == -1) {
                lb = [tk.cn,tk.ln];
            } else {
                styles.push({s:'markdown_bold',p0:lb,p1:[tk.cn+2,tk.ln]});
                lb = [-1,-1];
            }
        }

        // comment

        if (tk.toString() == '<!--') {
            cb = [tk.cn,tk.ln];
        }
        if (tk.toString() == '-->') {
            styles.push({s:'comment',p0:cb,p1:[tk.cn+3,tk.ln]});
        }

        // pre-font text

        if (tk.match(/^`.+?`$/)) {
            styles.push({s:'string',p0:[tk.cn,tk.ln],p1:ccurfn(icurfn([tk.cn,tk.ln])+tk.length)});
        }

        // links

        if (tk.toString() == '[') {
            la00 = [tk.cn,tk.ln];
        }
        if (tk.toString() == ']') {
            if (la00[0] != -1 && la00[1] != -1) la01 = [tk.cn,tk.ln];
        }
        if (tk.toString() == '(') {
            if (la01[0] != -1 && la01[1] != -1 && (tokens[i-1]??'').toString() == ']') la10 = [tk.cn,tk.ln];
        }
        if (tk.toString() == ')') {
            if (la10[0] != -1 && la10[1] != -1) {
                la11 = [tk.cn,tk.ln];

                styles.push({s:'string',p0:[la00[0]+1,la00[1]],p1:[la01[0],la01[1]]});
                //

                la00 = [-1,-1];
                la01 = [-1,-1];
                la10 = [-1,-1];
                la11 = [-1,-1];
            }
        }
        i++;
    }

    return {lines:buff.split(/\n/g),styles};
}

module.exports = {render,feathr};