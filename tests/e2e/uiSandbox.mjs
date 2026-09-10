import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

export default async function () {
  const root = path.resolve(import.meta.dirname, '../..')
  return {
    manifest: JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
    settingsWidgets: true,
    initialSettings: { profiles: [{ id: 'field-archive', name: 'Botanical archive', mappings: [{ source: '/fixture/source', destination: '/fixture/destination', exclude: [] }], trashPath: '/fixture/trash', logDirectory: '', masterLog: '' }], activeProfileId: 'field-archive' },
    hostSetup: "api.backend.call=async(name,value)=>name==='check'?{ok:false,issues:[{kind:'source-missing',message:'Fixture source is unavailable'}]}:({name,value});",
    entry: `import {register as registerPackage} from ${JSON.stringify(path.join(root, 'runtime/index.js'))};export function register(api){return registerPackage(api)}`,
    run: `
      let settingsFrame,panelFrame;
      for(let i=0;i<200;i++){for(const frame of win.webContents.mainFrame.framesInSubtree.filter(f=>f.url.endsWith('/surface.html'))){if(await frame.executeJavaScript('!!document.querySelector(".settings-list-row")'))settingsFrame=frame;if(await frame.executeJavaScript('!!document.querySelector(".backup-panel")'))panelFrame=frame}if(settingsFrame&&panelFrame)break;await wait(20)}
      if(!settingsFrame||!panelFrame)throw Error('Package settings/panel did not mount');
      await settingsFrame.executeJavaScript('document.querySelector(".settings-list-row").click()');
      const sourceInput='window.fixtureWidgets().flatMap(e=>[...e.shadowRoot.querySelectorAll("input")]).find(e=>e.getAttribute("aria-label")==="Source 1")';
      for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript('!!('+sourceInput+')'))break;await wait(20)}
      if(!await win.webContents.executeJavaScript('!!('+sourceInput+')'))throw Error('Missing source field: '+await win.webContents.executeJavaScript('window.fixtureWidgets().flatMap(e=>[...e.shadowRoot.querySelectorAll("input")]).map(e=>e.outerHTML).join(" | ")'));
      report.packageSource=await win.webContents.executeJavaScript('('+sourceInput+').value');
      await win.webContents.executeJavaScript('(()=>{const input='+sourceInput+';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"/fixture/updated-source");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new FocusEvent("focusout",{bubbles:true}));})()');
      for(let i=0;i<200;i++){report.packageSaved=await win.webContents.executeJavaScript('window.fixtureSettings.profiles[0].mappings[0].source');if(report.packageSaved==='/fixture/updated-source')break;await wait(20)}
      await panelFrame.executeJavaScript('document.querySelector(".backup-run").click()');
      for(let i=0;i<200;i++){report.packageFailure=await panelFrame.executeJavaScript('document.querySelector(".backup-alert")?.textContent');if(report.packageFailure)break;await wait(20)}
    `,
    verify(result) {
      assert.equal(result.packageSource, '/fixture/source')
      assert.equal(result.packageSaved, '/fixture/updated-source')
      assert.match(result.packageFailure, /Fixture source is unavailable/)
    }
  }
}
