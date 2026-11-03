import json,collections,sys
from engine import *
data=json.load(open(sys.argv[1]));c=CONFIGS[0];s=initial(c);hist=collections.Counter({key(s):1})
for raw in data['moves']:
 a=tuple(raw);assert terminal(c,s,hist) is None;assert a in actions(c,s);s=apply(c,s,a);hist[key(s)]+=1
assert digest(s)==data['hash'];assert terminal(c,s,hist)[0]==data['winner'];print('Replay verified:',len(data['moves']),'plies',data['hash'])
