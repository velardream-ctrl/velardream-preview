"""Check held-out mixtures with known original stems, using the shipped JS worker."""
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
from train import fixture
with TemporaryDirectory() as tmp:
    recordings=[]
    for seed in ([218,219,220,221] if len(sys.argv)>1 else [218,219,220]):
        v,a=fixture(seed)
        if seed==220:
            speech=subprocess.check_output(['ffmpeg','-loglevel','error','-f','lavfi','-i',
                'flite=text=Sing a little song with me today:voice=slt','-ar','44100','-f','f32le','-'])
            v=np.resize(np.frombuffer(speech,np.float32),len(a))
            v=v*.45/max(abs(v))
        if seed==221:
            clip=subprocess.check_output(['ffmpeg','-loglevel','error','-ss','8','-i',sys.argv[1],
                '-t','3','-ac','1','-ar','44100','-f','f32le','-'])
            v=np.frombuffer(clip,np.float32)
            v=v*.45/max(abs(v))
        path=Path(tmp)/str(seed)
        (v+a).astype('float32').tofile(path)
        recordings.append((path,v,a))
    subprocess.run(['node','tests/run218/worker-test.mjs',*[p for p,_,_ in recordings]],check=True)
    for p,v,a in recordings:
        for key,w,u in [('vocals',v,a),('instrumental',a,v)]:
            out=np.fromfile(str(p)+'.'+key,'float32')
            coeff=np.linalg.lstsq(np.column_stack([w,u]),out,rcond=None)[0]
            db=20*np.log10(abs(coeff[0]/coeff[1]))
            print(p.name,key,round(db,1),'dB')
            assert db>0
