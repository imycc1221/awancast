"""
C5 / B2 — self-supervised pretraining on (unlabeled) Himawari frames, then transfer to the onset task.
Step 1: masked-patch reconstruction (MAE-style) pretrains the U-Net ENCODER on 4-frame input stacks from
the train days (no labels needed). Step 2: fine-tune the residual U-Net for onset, with the encoder
initialized from SSL vs random; compare onset MAE on held-out 06-04. Tests whether in-domain SSL helps.
NOT diffusion. Self-contained (no external downloads). Reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2
import torch, torch.nn as nn
from sklearn.metrics import mean_absolute_error
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
TRAIN=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425","20260510","20260525","20260601","20260602","20260603"]
TEST="20260604"; DEV="cuda" if torch.cuda.is_available() else "cpu"
def log(*a): print(*a,flush=True)
def frames(day):
    o={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1); o[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return o
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s=H):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),(gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
NORM=lambda x:(np.where(np.isfinite(x),x,300.)-180.)/130.
def pad8(a):
    h,w=a.shape[-2:]; ph=(8-h%8)%8; pw=(8-w%8)%8; return np.pad(a,[(0,0)]*(a.ndim-2)+[(0,ph),(0,pw)],mode="reflect"),(h,w)
def blk(i,o): return nn.Sequential(nn.Conv2d(i,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True),nn.Conv2d(o,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True))
class UNet(nn.Module):
    def __init__(s,ci=4,base=24,co=1):
        super().__init__()
        s.e1=blk(ci,base);s.e2=blk(base,base*2);s.e3=blk(base*2,base*4);s.bott=blk(base*4,base*8);s.pool=nn.MaxPool2d(2)
        s.u3=nn.ConvTranspose2d(base*8,base*4,2,2);s.d3=blk(base*8,base*4);s.u2=nn.ConvTranspose2d(base*4,base*2,2,2);s.d2=blk(base*4,base*2);s.u1=nn.ConvTranspose2d(base*2,base,2,2);s.d1=blk(base*2,base);s.out=nn.Conv2d(base,co,1)
    def enc(s,x): e1=s.e1(x);e2=s.e2(s.pool(e1));e3=s.e3(s.pool(e2));b=s.bott(s.pool(e3));return e1,e2,e3,b
    def forward(s,x):
        e1,e2,e3,b=s.enc(x); d=s.d3(torch.cat([s.u3(b),e3],1));d=s.d2(torch.cat([s.u2(d),e2],1));d=s.d1(torch.cat([s.u1(d),e1],1));return s.out(d)
def items(day,need_target=True):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):
        t=ts[i]
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP: continue
        p2,p1,c=fr[ts[i-2]],fr[ts[i-1]],fr[t]
        g=t+H*STEP; a=fr.get(g)
        if need_target and a is None: continue
        it.append((p2,p1,c,a,advect(p1,c)))
    return it
# ---- SSL data: 4ch input stacks (no target needed) ----
Xssl=[]
for d in TRAIN:
    for p2,p1,c,a,adv in items(d,need_target=False):
        Xssl.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32))
Xssl=np.stack(Xssl); Xssl,_=pad8(Xssl); xs=torch.tensor(Xssl); log(f"SSL frames={len(xs)} dev={DEV}")
def mask_patches(x,frac=0.5,ps=16):
    b,ch,h,w=x.shape; m=torch.ones(b,1,h//ps,w//ps,device=x.device)
    m=(torch.rand_like(m)>frac).float(); m=torch.nn.functional.interpolate(m,size=(h,w),mode="nearest")
    return x*m, (1-m)   # masked input, masked-region indicator
# ---- Step 1: SSL pretrain (reconstruct masked input) ----
ssl=UNet(ci=4,co=4).to(DEV); opt=torch.optim.Adam(ssl.parameters(),1e-3); scaler=torch.cuda.amp.GradScaler(); B=2;n=len(xs)
for ep in range(40):
    perm=torch.randperm(n); ssl.train()
    for i in range(0,n,B):
        xb=xs[perm[i:i+B]].to(DEV); xin,mm=mask_patches(xb); opt.zero_grad()
        with torch.cuda.amp.autocast(): rec=ssl(xin); loss=torch.sum(((rec-xb)*mm)**2)/(torch.sum(mm)+1)
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
    if ep%10==0 or ep==39: log(f"ssl ep {ep} loss {loss.item():.4f}")
log("SSL pretrain done")
# ---- Step 2: supervised onset task, SSL-init vs random-init ----
Xtr,Rtr=[],[]
for d in TRAIN:
    for p2,p1,c,a,adv in items(d,need_target=True): Xtr.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32)); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr); xt=torch.tensor(Xtr); rt=torch.tensor(Rtr); nt=len(xt)
te=items(TEST,True); Xte=np.stack([np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0) for p2,p1,c,a,adv in te]).astype(np.float32); Xtep,orig=pad8(Xte); h0,w0=orig
advte=np.stack([t[4] for t in te]); curte=np.stack([t[2] for t in te]); tgtte=np.stack([t[3] for t in te])
def train_eval(init_ssl):
    torch.manual_seed(0); m=UNet(ci=4,co=1).to(DEV)
    if init_ssl:
        for blkname in ["e1","e2","e3","bott"]: getattr(m,blkname).load_state_dict(getattr(ssl,blkname).state_dict())
    opt=torch.optim.Adam(m.parameters(),1e-3); sc=torch.cuda.amp.GradScaler()
    for ep in range(60):
        perm=torch.randperm(nt); m.train()
        for i in range(0,nt,B):
            idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
            with torch.cuda.amp.autocast(): loss=torch.mean(torch.abs(m(xb)-rb))
            sc.scale(loss).backward(); sc.step(opt); sc.update()
    m.eval()
    with torch.no_grad(), torch.cuda.amp.autocast():
        pr=[]; xe=torch.tensor(Xtep).to(DEV)
        for i in range(0,len(xe),B): pr.append(m(xe[i:i+B]).float().cpu().numpy())
    pr=np.concatenate(pr)[:,0,:h0,:w0]; pred=(NORM(advte)+pr)*130.+180.
    v=np.isfinite(tgtte)&np.isfinite(curte); y=tgtte[v]; pp=pred[v]; ons=np.abs(y-curte[v])>THR
    return round(float(mean_absolute_error(y[ons],pp[ons])),2), round(float(mean_absolute_error(y,pp)),2)
ssl_onset,ssl_all=train_eval(True); rnd_onset,rnd_all=train_eval(False)
res={"note":"C5/B2 self-supervised (masked-recon) pretrain -> onset task, held-out 06-04; NOT diffusion",
 "ssl_pretrain_frames":int(len(xs)),
 "random_init":{"onset_MAE":rnd_onset,"overall_MAE":rnd_all},
 "ssl_init":{"onset_MAE":ssl_onset,"overall_MAE":ssl_all},
 "ssl_minus_random_onset_K":round(ssl_onset-rnd_onset,2),
 "interpretation":"negative ssl_minus_random => SSL pretraining helped onset; ~0 => no transfer benefit on same-domain frames"}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_ssl_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
