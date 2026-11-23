"""Run from repository root (Playwright routes serve repository files in memory)."""
import os
import mimetypes
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
from scipy.io import wavfile

from playwright.sync_api import sync_playwright
from train import fixture, RATE

def separation_score(output, wanted, unwanted):
    coeff = np.linalg.lstsq(np.column_stack([wanted, unwanted]), output, rcond=None)[0]
    return 20*np.log10(abs(coeff[0]/coeff[1]))

with TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page()
    def serve(route):
        relative=route.request.url.split('8155/',1)[1].split('?')[0]
        path=Path(relative)
        if path.is_dir():
            path=path/'index.html'
        route.fulfill(path=path, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    page.route('http://localhost:8155/**',serve)
    page.goto('http://localhost:8155/singer-studio/')
    def click(id):
        page.locator('#'+id).click()
    model_requests=[]
    def serve_model(route):
        model_requests.append(1)
        if len(model_requests)==1:
            route.fulfill(status=503,body='')
        else:
            serve(route)
    page.route('**/velar-mask-v1.json',serve_model)
    if os.environ.get('LAME_JS'):
        page.route('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
                   lambda route: route.fulfill(path=os.environ['LAME_JS'],content_type='text/javascript'))
    for seed in [218,219,220]:
        v,a = fixture(seed)
        if seed==220:
            speech=subprocess.check_output(['ffmpeg','-loglevel','error','-f','lavfi','-i',
                'flite=text=Sing a little song with me today:voice=slt','-ar','44100','-f','f32le','-'])
            v=np.resize(np.frombuffer(speech,np.float32),len(a))
            v=v*.45/max(abs(v))
        path=Path(tmp)/'mix.wav'
        wavfile.write(path,RATE,((v+a)*32000).astype('int16'))
        page.locator('#source-file').set_input_files(path)
        click('split')
        if seed==218:
            page.wait_for_function("document.querySelector('#split-status').textContent.includes('Ошибка')")
            click('split')
            click('split-cancel')
            click('split')
        page.locator('#stems').wait_for(state='visible')
        for stem,w,u in [('vocals',v,a),('instrumental',a,v)]:
            page.select_option('#stem-choice',stem)
            click('stem-play')
            page.wait_for_function("document.querySelector('#stem-player').currentTime>0")
            click('stem-export')
            with page.expect_download() as download:
                click('stem-download')
            rate, result=wavfile.read(download.value.path())
            score=separation_score(result,w,u)
            print(seed,stem,round(score,1),'dB',flush=True)
            assert rate==RATE and len(result)==len(w) and score>0
    for fmt in ['mp3192','mp3320','flac16']:
        page.select_option('#stem-format',fmt)
        click('stem-export')
        with page.expect_download() as saved:
            click('stem-download')
        probe=subprocess.check_output(['ffprobe','-v','error','-select_streams','a:0',
            '-show_entries','stream=codec_name,bit_rate','-of','csv=p=0',saved.value.path()]).decode()
        assert ('flac' in probe if fmt=='flac16' else str(int(fmt[3:])*1000) in probe),probe
        print(fmt,probe.strip())
    assert len(model_requests)<=3
    click('stem-edit')
    page.locator('#pitch').fill('2')
    page.locator('#tempo').fill('85')
    click('render')
    click('listen-result')
    page.wait_for_function("document.querySelector('#player').currentTime>0")
    page.select_option('#format','flac16')
    click('save')
    with page.expect_download() as download:
        click('download')
    assert Path(download.value.path()).read_bytes()[:4]==b'fLaC'
    print('Editor playback and FLAC download passed')
