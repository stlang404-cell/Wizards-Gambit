import json,random,time,math,collections,argparse
from engine import *
def run(c,a,b,seed,log=False):
 rng=random.Random(seed);s=initial(c);hist=collections.Counter({key(s):1});moves=[];branch=[]
 while not (t:=terminal(c,s,hist)):
  branch.append(len(actions(c,s)));act=choose(c,s,a if s.turn==1 else b,rng);moves.append(act);s=apply(c,s,act);hist[key(s)]+=1
 return dict(winner=t[0],reason=t[1],plies=s.ply,branch=sum(branch)/len(branch),hash=digest(s),**({'moves':moves} if log else {}))
def wilson(w,n):
 z=1.96;d=1+z*z/n;m=(w/n+z*z/(2*n))/d;r=z*math.sqrt(w/n*(1-w/n)/n+z*z/(4*n*n))/d;return [m-r,m+r]
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--count',type=int,default=2000);p.add_argument('--out',default='results/candidates.json');args=p.parse_args();start=time.time();rows=[]
 for c in CONFIGS:
  games=[run(c,'random' if i%2==0 else 'greedy','greedy' if i%2==0 else 'random',100000+i) for i in range(args.count)]
  counts=collections.Counter(g['winner'] for g in games);greedy=sum(g['winner']==(-1 if i%2==0 else 1) for i,g in enumerate(games));row=dict(candidate=c.name,n=len(games),first_wins=counts[1],second_wins=counts[-1],draws=counts[0],first_win_ci=wilson(counts[1],len(games)),greedy_wins=greedy,greedy_win_ci=wilson(greedy,len(games)),mean_plies=sum(g['plies'] for g in games)/len(games),mean_branch=sum(g['branch'] for g in games)/len(games),reasons=dict(collections.Counter(g['reason'] for g in games)));rows.append(row);print(row,flush=True)
 json.dump(dict(seconds=time.time()-start,seed_base=100000,rows=rows),open(args.out,'w'),indent=2)
