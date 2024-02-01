import sys
import requests
import json
import ast

port  = int(sys.argv[1])
state = None

class State:
    def __init__(self,id_:str,buff:str,cx:int,ci:int):
        self.id = id_
        self.buff = buff
        self.cx = cx
        self.ci = ci
        
class Style:
    def __init__(self):
        self.s = []
    def addStyle(self,s:list[str],c0:int,l0:int,c1:int,l1:int):
        self.s.append({
            's':  s,
            'c0': c0,
            'l0': l0,
            'c1': c1,
            'l1': l1,
        })

def fetch():
    res = json.loads(requests.post('http://localhost:%d/'%(port,),data='{"type":"fetch"}').text)
    if type(res) == dict and not res.get('err'):
        return State(res.get('id'),res.get('buff'),res.get('cx'),res.get('cy'))
    return None

def sendStyle(style):
    requests.post('http://localhost:%d/'%(port,),data=json.dumps({'type':'update-style','style':style.s}))

while 1:
    state = fetch() or state
    style = Style()
    def explore(node):
        pass
    style.addStyle(s=['keyword'],c0=0,l0=0,c1=3,l1=0)
    sendStyle(style)