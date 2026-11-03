"""Exploratory shallow selfplay; spell budget varied symmetrically."""
from engine import *
import collections,json,time
start=time.time();rows=[]
for seals in (0,1,2,3):
 spells=0;plies=0;counts=collections.Counter();reasons=collections.Counter()
 for seed in range(40):
  rng=random.Random(600000+seed);c=CONFIGS[0];s=initial(c);s=State(s.board,charges=(seals,seals));h=collections.Counter({key(s):1})
  while not (t:=terminal(c,s,h)):
   a=choose(c,s,'positional',rng);spells+=a[0]!='move';s=apply(c,s,a);h[key(s)]+=1
  counts[t[0]]+=1;reasons[t[1]]+=1;plies+=s.ply
 rows.append(dict(seals=seals,games=40,first_wins=counts[1],second_wins=counts[-1],draws=counts[0],mean_plies=plies/40,casts_per_game=spells/40,reasons=dict(reasons)))
json.dump(dict(seconds=time.time()-start,rows=rows),open('results/ablation.json','w'),indent=2);print(rows)
