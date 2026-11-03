"""Deterministic research rules; immutable positions, reversible by retaining parent."""
from dataclasses import dataclass
import hashlib,random
O=((1,0),(-1,0),(0,1),(0,-1)); D=((1,1),(1,-1),(-1,1),(-1,-1)); K=O+D
VALUES={1:1000,2:5,3:4,4:3,5:1}
@dataclass(frozen=True)
class Config:
 name:str;n:int;magic:str;goal:str='capture';diamond:bool=False
CONFIGS=[Config('Ember Six',6,'swap'),Config('Rune Seven',7,'control'),Config('Grand Eight',8,'blink'),Config('Nexus Six',6,'control','hold'),Config('Astral Cross',7,'swap','escape',True)]
@dataclass(frozen=True)
class State:
 board:tuple;turn:int=1;charges:tuple=(2,2);quiet:int=0;ply:int=0;hold:tuple=(0,0)
def valid(c,x,y):return 0<=x<c.n and 0<=y<c.n and (not c.diamond or abs(x-c.n//2)+abs(y-c.n//2)<=c.n//2)
def initial(c):
 b=[0]*(c.n*c.n)
 if c.diamond:
  places=[(3,0,1),(2,1,2),(3,1,3),(4,1,4),(3,2,5)]
 else:
  places=[(x,0,t) for x,t in enumerate(([2,3,1,4,3,2] if c.n==6 else [2,3,4,1,4,3,2] if c.n==7 else [2,3,4,1,4,3,2,5]))]+[(x,1,5) for x in range(c.n)]
 for x,y,t in places:
  b[y*c.n+x]=t;b[(c.n-1-y)*c.n+(c.n-1-x)]=-t
 return State(tuple(b))
def centers(c):
 m=(c.n-1)/2
 return {y*c.n+x for y in range(c.n) for x in range(c.n) if abs(x-m)<=.5 and abs(y-m)<=.5}
def actions(c,s):
 out=[];b=s.board
 for i,p in enumerate(b):
  if p*s.turn<=0:continue
  t=abs(p);x=i%c.n;y=i//c.n
  dirs=K if t==1 else O if t==2 else D if t==3 else ((2,1),(2,-1),(-2,1),(-2,-1),(1,2),(1,-2),(-1,2),(-1,-2)) if t==4 else O
  for dx,dy in dirs:
   for r in range(1,(3 if t in (2,3) else 2)):
    xx=x+dx*r;yy=y+dy*r
    if not valid(c,xx,yy):break
    j=yy*c.n+xx
    if b[j]*s.turn>0:break
    out.append(('move',i,j))
    if b[j]:break
  if s.charges[0 if s.turn==1 else 1]>0 and (c.magic!='control' or i in centers(c)):
   for j,q in enumerate(b):
    dist=max(abs(x-j%c.n),abs(y-j//c.n))
    if c.magic=='swap' and q*s.turn>0 and j!=i and dist==1 and i<j:out.append(('swap',i,j))
    if c.magic=='blink' and t!=1 and q==0 and dist==2 and valid(c,j%c.n,j//c.n):out.append(('blink',i,j))
    if c.magic=='control' and i in centers(c) and q*s.turn>0 and j!=i and dist<=2:out.append(('swap',i,j))
 return out
def apply(c,s,a):
 kind,i,j=a;b=list(s.board);capt=b[j] if kind=='move' else 0
 if kind=='swap':b[i],b[j]=b[j],b[i]
 else:b[j],b[i]=b[i],0
 ch=list(s.charges);idx=0 if s.turn==1 else 1
 if kind!='move':ch[idx]-=1
 h=list(s.hold)
 if c.goal=='hold':h[idx]=h[idx]+1 if any(b[k]==s.turn for k in centers(c)) else 0
 return State(tuple(b),-s.turn,tuple(ch),0 if capt else s.quiet+1,s.ply+1,tuple(h))
def key(s):return (s.board,s.turn,s.charges,s.hold)
def digest(s):return hashlib.sha256(repr((key(s),s.quiet,s.ply)).encode()).hexdigest()
def terminal(c,s,history):
 if 1 not in s.board:return -1,'capture'
 if -1 not in s.board:return 1,'capture'
 if c.goal=='hold':
  for idx,p in enumerate((1,-1)):
   if s.hold[idx]>=3:return p,'hold'
 if c.goal=='escape':
  for p in (1,-1):
   i=s.board.index(p)
   if i//c.n==(c.n-1 if p==1 else 0):return p,'escape'
 if history.get(key(s),0)>=3:return 0,'repetition'
 if s.quiet>=60:return 0,'quiet'
 if s.ply>=180:return 0,'cap'
 if not actions(c,s):return -s.turn,'immobile'
 return None

def evaluate(c,s,p):
 score=0
 for i,t in enumerate(s.board):
  if t:
   sign=1 if t*p>0 else -1;x=i%c.n;y=i//c.n
   score+=sign*(VALUES[abs(t)]+.08*(c.n-abs(x-(c.n-1)/2)-abs(y-(c.n-1)/2)))
 return score+.15*(s.charges[0 if p==1 else 1]-s.charges[1 if p==1 else 0])
def choose(c,s,agent,rng):
 aa=actions(c,s)
 if agent=='random':return rng.choice(aa)
 if agent=='greedy':return max(aa,key=lambda a:(VALUES.get(abs(s.board[a[2]]),0) if a[0]=='move' else 0,rng.random()))
 def search(st,depth,alpha,beta):
  if 1 not in st.board or -1 not in st.board:return evaluate(c,st,st.turn)
  if not depth:return evaluate(c,st,st.turn)
  best=-1e9
  for a in sorted(actions(c,st),key=lambda a:abs(st.board[a[2]]),reverse=True):
   v=-search(apply(c,st,a),depth-1,-beta,-alpha);best=max(best,v);alpha=max(alpha,v)
   if alpha>=beta:break
  return best if best!=-1e9 else -10000
 depth={'positional':1,'tactical':2,'strong':3}[agent]
 best=-1e12;chosen=None
 for a in aa:
  v=-search(apply(c,s,a),depth-1,-1e9,1e9)
  if v>best or (v==best and rng.random()<.15):best=v;chosen=a
 return chosen
