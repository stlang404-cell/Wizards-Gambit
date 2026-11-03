import json,time,collections
from engine import *
from experiment import run,wilson
start=time.time();rows=[]
for a,b,n in [('greedy','random',100),('positional','greedy',100),('tactical','positional',60),('strong','tactical',12)]:
 games=[run(CONFIGS[0],a if i%2==0 else b,b if i%2==0 else a,900000+i) for i in range(n)]
 w=sum(g['winner']==(1 if i%2==0 else -1) for i,g in enumerate(games));d=sum(g['winner']==0 for g in games)
 row=dict(a=a,b=b,n=n,wins=w,draws=d,losses=n-w-d,win_ci=wilson(w,n));rows.append(row);print(row,flush=True)
json.dump(dict(seconds=time.time()-start,rows=rows),open('results/ladder.json','w'),indent=2)
json.dump(run(CONFIGS[0],'tactical','greedy',12345,True),open('results/replay.json','w'),indent=2)
