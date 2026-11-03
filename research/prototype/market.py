"""LMSR accounting stress test, not pricing calibration."""
import math,random,json
rng=random.Random(772);b=100.;q=[0.,0.,0.];cash=0.;maxerr=0.;balances=[1000.]*20;hold=[[0.]*3 for _ in balances]
def cost(q):
 m=max(q);return m+b*math.log(sum(math.exp((x-m)/b) for x in q))
for _ in range(10000):
 who=rng.randrange(20);k=rng.randrange(3);amount=rng.uniform(-min(hold[who][k],10),10);n=q.copy();n[k]+=amount;fee=abs(amount)*.01;pay=cost(n)-cost(q)+fee
 if pay>balances[who]:continue
 balances[who]-=pay;hold[who][k]+=amount;cash+=pay;q=n
 maxerr=max(maxerr,abs(sum(balances)+cash-20000))
liabilities=[q[k]-cash for k in range(3)];assert max(liabilities)<=b*math.log(3)+1e-8;assert min(balances)>=0;assert maxerr<1e-7
out=dict(seed=772,trades_attempted=10000,market_maker_worst_net_loss=max(liabilities),subsidy_bound=b*math.log(3),conservation_error=maxerr,min_cash=min(balances),calibration='NOT TESTED')
json.dump(out,open('results/markets.json','w'),indent=2);print(out)
