"""Local Chromium smoke test. Requires Python Playwright and system Chromium."""
import os
import tempfile
import shutil
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
temp = tempfile.TemporaryDirectory()
database = temp.name+'/test.sqlite'
with subprocess.Popen(['node', 'server/local.mjs'], cwd=root, env={**os.environ, 'PORT':'18787','APUKAVERI_DB':database}, stdout=subprocess.PIPE, text=True) as server:
    try:
        url = server.stdout.readline().strip()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.getenv('CHROMIUM') or shutil.which('chromium'), args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':390,'height':844})
            page.goto(url)
            for lang, heading in [('fi','Apua lähellä'),('ru','Помощь рядом'),('en','Help nearby')]:
                page.select_option('#lang', lang)
                assert heading in page.locator('h1').inner_text()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.fill('#pwd','synthetic test password')
            page.check("#acceptTerms")
            page.check("#ackPrivacy")
            page.click('[data-action="6"]')
            page.fill('#code',server.stdout.readline().split()[-1])
            page.click('[data-action="9"]')
            page.wait_for_timeout(100)
            page.click('[data-action="7"]')
            page.check('#available')
            page.click('[data-action="16"]')
            page.set_input_files('#photo',str(root/'icon192.png'))
            page.wait_for_function("document.querySelector('#avatar').getContext('2d').getImageData(24,24,1,1).data[3] > 0")
            page.reload()
            page.wait_for_function("document.querySelector('#avatar')?.getContext('2d').getImageData(24,24,1,1).data[3] > 0")
            page.click('[data-action="52"]')
            page.wait_for_function("document.querySelector('#avatar').getContext('2d').getImageData(24,24,1,1).data[3] === 0")
            page.locator('summary').click()
            page.fill('#date','2026-12-14')
            page.click('[data-action="55"]')
            page.click('[data-action="16"]')
            page.wait_for_function("fetch('/api/me').then(r=>r.json()).then(m=>JSON.parse(m.schedule).overrides['2026-12-14']?.length === 0)")
            page.click('[data-action="18"]')
            page.wait_for_selector('#orders li')
            assert '#1' in page.locator('#orders').inner_text()
            page.reload()
            assert page.is_checked('#available')
            assert page.locator('html').get_attribute('lang')=='en'
            for width in [768,1440]:
                page.set_viewport_size({'width':width,'height':900})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.goto(url.replace('sandbox.html','account.html'))
            page.set_input_files('#photo',str(root/'icon192.png'))
            page.wait_for_selector('.avatar img',state='attached')
            assert page.goto(url.replace('sandbox.html','admin')).status==403
            subprocess.run(['node','server/grant-owner.mjs',database,'demo-1@example.invalid'],cwd=root,check=True)
            assert page.reload().status==200
            page.wait_for_selector('#rate')
            page.fill('#rate','12')
            page.click('#policy')
            page.wait_for_function("document.querySelector('#status')?.textContent === 'Saved'")
            page.reload()
            assert page.input_value('#rate')=='12'
            page.set_viewport_size({'width':390,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            browser.close()
            print('PASS Chromium: three languages, 390/768/1440px, signup, verify, login, profile, order, reload and local photo')
    finally:
        server.terminate()
