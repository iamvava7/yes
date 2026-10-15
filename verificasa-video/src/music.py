# Calm modern electronic bed, 35s, 92 BPM. Pure numpy synthesis -> 48kHz stereo WAV.
import numpy as np, wave, sys
SR=48000; DUR=36.0; BPM=92; beat=60/BPM
n=int(SR*DUR); t=np.arange(n)/SR
L=np.zeros(n); R=np.zeros(n)
def note(m): return 440*2**((m-69)/12)
def env(length, a, r):
    k=np.arange(length)/SR; e=np.minimum(1,k/a)*np.exp(-k/r); return e
def add(sig,start,pan=0.0,gain=1.0):
    i=int(start*SR)
    if i>=n: return
    j=min(n,i+len(sig)); s=sig[:j-i]*gain
    L[i:j]+=s*(1-pan)/1.0*0.5*2**0.5*0.7; R[i:j]+=s*(1+pan)*0.5*2**0.5*0.7
# chords: Fmaj7 - Am7 - Dm9 - Bbmaj7 (2 bars each = 8 beats)
chords=[[53,57,60,64],[57,60,64,67],[50,57,60,64,65],[46,53,57,62]]
bar=beat*4
c=0; st=0.0
while st<DUR:
    ch=chords[c%4]; length=int(bar*2*SR)+SR
    k=np.arange(length)/SR
    pad=np.zeros(length)
    for m in ch:
        f=note(m)
        for d in (-0.07,0.07):
            ph=2*np.pi*f*(1+d/100)*k
            pad+=np.sin(ph)+0.25*np.sin(2*ph)+0.1*np.sin(3*ph)
    e=np.minimum(1,k/1.2)*np.minimum(1,np.maximum(0,(bar*2+1-k))/1.2)
    add(pad*e/len(ch),st,pan=0.0,gain=0.16)
    # bass
    b=note(ch[0]-12); bl=int(bar*2*SR)
    kb=np.arange(bl)/SR
    add(np.sin(2*np.pi*b*kb)*np.minimum(1,kb/0.05)*np.minimum(1,(bar*2-kb)/0.3),st,gain=0.22)
    # arp: soft plucks on 8ths
    for i in range(16):
        m=ch[[0,2,1,3,2,1,3,2][i%8]%len(ch)]+12
        pl=int(0.9*SR); kp=np.arange(pl)/SR
        sig=(np.sin(2*np.pi*note(m)*kp)+0.3*np.sin(4*np.pi*note(m)*kp))*env(pl,0.004,0.18)
        add(sig, st+i*beat/2, pan=0.5*np.sin(i), gain=0.07 if st>3 else 0.07*st/3)
    c+=1; st+=bar*2
# soft kick + shaker from 3s
kl=int(0.4*SR); kk=np.arange(kl)/SR
kick=np.sin(2*np.pi*(50+70*np.exp(-kk*30))*kk)*np.exp(-kk*9)
rng=np.random.default_rng(1)
hl=int(0.08*SR); hat=rng.standard_normal(hl)*np.exp(-np.arange(hl)/SR*60)
hat=np.diff(np.concatenate([[0],hat]))
x=3.9
while x<32.5:
    add(kick,x,gain=0.35); add(hat,x+beat/2,pan=0.3,gain=0.05); x+=beat
# simple stereo delay/reverb
def verb(s):
    out=s.copy()
    for d,g in ((0.137,0.35),(0.229,0.28),(0.311,0.22),(0.453,0.15)):
        k=int(d*SR); out[k:]+=s[:-k]*g
    return out
L=verb(L); R=verb(np.roll(R,int(0.011*SR)))
fade=np.ones(n); fo=int(3.5*SR); fade[-fo-int(1*SR):-int(1*SR)]=np.linspace(1,0,fo); fade[-int(1*SR):]=0
fade[:int(1.5*SR)]=np.linspace(0,1,int(1.5*SR))
L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L/=m*1.12; R/=m*1.12
data=(np.stack([L,R],1)*32767).astype(np.int16)
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes()); w.close()
