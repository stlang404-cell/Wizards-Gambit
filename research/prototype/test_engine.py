import unittest,random,collections
from engine import *
class Rules(unittest.TestCase):
 def test_capture_rules_do_not_change_hold(self):
  c=CONFIGS[0];b=[0]*36;b[14]=1;b[35]=-1;s=State(tuple(b))
  self.assertEqual(apply(c,s,('move',14,15)).hold,(0,0))
 def test_seals_distinguish_repetition(self):
  s=initial(CONFIGS[0]);self.assertNotEqual(key(s),key(State(s.board,charges=(1,2))))
 def test_swap_atomic_and_nonrenewable(self):
  c=CONFIGS[0];s=initial(c);a=next(a for a in actions(c,s) if a[0]=='swap');t=apply(c,s,a)
  self.assertEqual(sorted(s.board),sorted(t.board));self.assertEqual(t.board[a[1]],s.board[a[2]])
  z=State(s.board,charges=(0,0));self.assertTrue(all(a[0]=='move' for a in actions(c,z)))
 def test_terminal_priority(self):
  c=CONFIGS[0];b=list(initial(c).board);b[b.index(-1)]=0;s=State(tuple(b),quiet=60,ply=180)
  self.assertEqual(terminal(c,s,{key(s):3}),(1,'capture'))
 def test_hold_objective(self):
  c=CONFIGS[3];b=[0]*36;b[14]=1;b[35]=-1;s=State(tuple(b),hold=(2,0))
  t=apply(c,s,('move',14,15));self.assertEqual(terminal(c,t,{}),(1,'hold'))
 def test_initial_symmetry(self):
  for c in CONFIGS:
   s=initial(c);self.assertEqual(s.board,tuple(-p for p in reversed(s.board)));self.assertEqual(s.board.count(1),1)
 def test_walk_properties_replay_undo(self):
  for c in CONFIGS:
   rng=random.Random(42);s=initial(c);root=s;log=[];parents=[]
   for _ in range(100):
    aa=actions(c,s)
    if not aa:break
    self.assertEqual(len(aa),len(set(aa)))
    a=rng.choice(aa);parents.append(s);log.append(a);old=sum(bool(x) for x in s.board);s=apply(c,s,a)
    self.assertIn(sum(bool(x) for x in s.board),(old,old-1));self.assertEqual(s.turn,-parents[-1].turn);self.assertTrue(all(x>=0 for x in s.charges))
    for i,p in enumerate(s.board):
     if p:self.assertTrue(valid(c,i%c.n,i//c.n))
   replay=root
   for a in log:replay=apply(c,replay,a)
   self.assertEqual(digest(s),digest(replay))
   while parents:s=parents.pop()
   self.assertEqual(s,root)
 def test_draws(self):
  c=CONFIGS[0];s=initial(c);self.assertEqual(terminal(c,s,{key(s):3}),(0,'repetition'));self.assertEqual(terminal(c,State(s.board,quiet=60),{}),(0,'quiet'))
 def test_spell_spends(self):
  for c in CONFIGS:
   s=initial(c)
   for a in actions(c,s):
    if a[0]!='move':self.assertEqual(apply(c,s,a).charges,(1,2))
 def test_royal_capture(self):
  c=CONFIGS[0];b=[0]*36;b[0]=1;b[1]=-1;s=State(tuple(b));self.assertIn(('move',0,1),actions(c,s));self.assertEqual(terminal(c,apply(c,s,('move',0,1)),{}),(1,'capture'))
 def test_ray_block(self):
  c=CONFIGS[0];b=[0]*36;b[0]=2;b[1]=5;s=State(tuple(b));self.assertNotIn(('move',0,2),actions(c,s))
 def test_blink_no_capture(self):
  c=CONFIGS[2];s=initial(c)
  for a in actions(c,s):
   if a[0]=='blink':self.assertEqual(s.board[a[2]],0)
if __name__=='__main__':unittest.main()
