"""Phase 4 — generate publication figures from result JSONs into paper/figures/."""
import json, os
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
E=os.path.dirname(__file__); FIG=os.path.join(E,"..","paper","figures"); os.makedirs(FIG,exist_ok=True)
def load(n): return json.load(open(os.path.join(E,n)))
plt.rcParams.update({"font.size":11,"axes.spomine" if False else "axes.grid":True,"grid.alpha":0.3})

# Fig 1: onset MAE by method, seasonal-panel CIs (deep clears the bar)
dp=load("deep_nowcast_panel_results.json")["onset_MAE_K"]
order=[("persist","Persistence"),("of","Optical flow"),("tab","Tabular (bar)"),("unet","Deep U-Net")]
vals=[dp[k]["value"] for k,_ in order]; lo=[dp[k]["value"]-dp[k]["ci95"][0] for k,_ in order]; hi=[dp[k]["ci95"][1]-dp[k]["value"] for k,_ in order]
plt.figure(figsize=(6,4))
bars=plt.bar([l for _,l in order],vals,yerr=[lo,hi],capsize=5,color=["#bbb","#88a","#5a7","#27a"])
plt.ylabel("Onset-subset MAE (K)  [lower=better]"); plt.title("Storm-onset error by method (seasonal hold-out, 95% CI)")
for b,v in zip(bars,vals): plt.text(b.get_x()+b.get_width()/2,v+0.4,f"{v}",ha="center",fontsize=9)
plt.tight_layout(); plt.savefig(os.path.join(FIG,"fig1_onset_by_method.png"),dpi=140); plt.close()

# Fig 2: gate cost/benefit curve — tabular vs deep
tg=load("end_to_end_gate_results.json")["operational_gate"]; dg=load("deep_gate_results.json")["operational_gate"]
def pts(d):
    xs=[d[k]["expensive_frac"]*100 for k in d]; ys=[d[k]["benefit_captured_pct"] for k in d]
    o=np.argsort(xs); return np.array(xs)[o],np.array(ys)[o]
tx,ty=pts(tg); dx,dy=pts(dg)
plt.figure(figsize=(6,4))
plt.plot(tx,ty,"o-",label="Tabular model (weak)",color="#5a7")
plt.plot(dx,dy,"s-",label="Deep U-Net (strong)",color="#27a")
plt.xlabel("% pixels using the expensive model"); plt.ylabel("% of oracle-gate benefit captured")
plt.title("Gate cost vs benefit (held-out day)"); plt.legend(); plt.ylim(0,100)
plt.tight_layout(); plt.savefig(os.path.join(FIG,"fig2_gate_cost_benefit.png"),dpi=140); plt.close()

# Fig 3: multi-region high-change skill with CIs
mr=load("multiregion_results.json")["by_region"]
regs=list(mr); v=[mr[r]["highchange_skill"] for r in regs]
lo=[mr[r]["highchange_skill"]-mr[r]["ci95"][0] for r in regs]; hi=[mr[r]["ci95"][1]-mr[r]["highchange_skill"] for r in regs]
plt.figure(figsize=(6,4))
plt.bar(regs,v,yerr=[lo,hi],capsize=5,color=["#c97","#5a7","#27a"])
plt.axhline(0,color="k",lw=0.8); plt.ylabel("Optical-flow skill on evolving cloud")
plt.title("Regime-selective signal by region (95% CI)")
plt.tight_layout(); plt.savefig(os.path.join(FIG,"fig3_multiregion.png"),dpi=140); plt.close()

# Fig 4: gate policy MAE (deep) — always-deep best, gate near it
g=load("deep_gate_results.json")
labels=["Persistence","Always-deep","Oracle gate","Op-gate @0.5"]
vals=[g["persistence_MAE"],g["always_deep_MAE"],g["oracle_gate_MAE"],g["operational_gate"]["thr_0.5"]["MAE"]]
plt.figure(figsize=(6,4))
b=plt.bar(labels,vals,color=["#bbb","#27a","#5a7","#7ac"])
plt.ylabel("MAE (K)  [lower=better]"); plt.title("Deep model in the gate (held-out day)")
for bar,vv in zip(b,vals): plt.text(bar.get_x()+bar.get_width()/2,vv+0.05,f"{vv}",ha="center",fontsize=9)
plt.xticks(rotation=15); plt.tight_layout(); plt.savefig(os.path.join(FIG,"fig4_deep_gate.png"),dpi=140); plt.close()
print("WROTE figures to",FIG, os.listdir(FIG))
