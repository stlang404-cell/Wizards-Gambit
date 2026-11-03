import json
from engine import *
def perft(c,s,d):
 return 1 if not d else sum(perft(c,apply(c,s,a),d-1) for a in actions(c,s))
if __name__=='__main__':
 rows={c.name:{str(d):perft(c,initial(c),d) for d in range(1,4)} for c in CONFIGS}
 json.dump(rows,open('results/perft.json','w'),indent=2);print(rows)
