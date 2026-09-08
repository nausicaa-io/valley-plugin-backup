var Ne="valley";var Da=`.${Ne}`,La=`app.${Ne}`;var $=`.${Ne}`,sa="plugins",je=`${$}/${sa}`,ia="external",za=`${je}/${ia}`,Ba=`${je}/data`;var Ma=`${je}/plugin.json`,rt=`${$}/state`,pe=`${$}/settings`,Te=`${$}/app`,_e=`${$}/accounts`,ja=`${_e}/providers`,Va=`${_e}/providers.lock.json`,Ua=`${$}/blueprints`,Fa=`${$}/trash`,se=`${$}/assistant`,Ha=`${se}/providers`,Ga=`${se}/providers.lock.json`,qa=`${se}/harness`,Wa=`${se}/harness-settings.json`,Ka=`${se}/harness-runs`,Ce=`${$}/cache`,Za=`${Ce}/accounts`,ca=`${Ce}/assistant`,Ja=`${ca}/harness`,ua=`${Ce}/search`,Xa=`${Ce}/providers`;var Ya=`${Te}/logs`,Qa=`${Te}/whats-new`,er=`${Te}/setup.json`,tr=`${ua}/index.jsonl`,ar=`${rt}/journal`,rr=`${rt}/txjournal`;var Pe="design";var or={app:`${Te}/app.json`,appearance:`${$}/${Pe}/appearance.json`,pallette:`${$}/${Pe}/pallette.json`,group:`${$}/${Pe}/group.json`,metadata:`${pe}/metadata.json`,notification:`${pe}/notification.json`,preferences:`${pe}/preferences.json`,markdown:`${pe}/markdown.json`,files:`${pe}/files.json`,search:`${pe}/search.json`,design:`${$}/${Pe}/appearance.json`,accounts:`${_e}/accounts.json`,provider:`${se}/assistant.json`},nr=`${_e}/secrets.json`,sr=`${se}/provider-secrets.json`;var ur=[`${$}/assistant`,`${$}/assistant/secrets.json`,`${$}/**/secrets.json`,".git","node_modules","**/.env","**/.env.*"];function P(e,a,n,t,h,S,v,C,i="owner"){return Object.freeze({id:e,kind:a,version:n,cardinality:t,validate:h,identities:S,identityScope:i,serviceCalls:v,serviceMetadata:C})}var g=e=>!!e&&typeof e=="object"&&!Array.isArray(e),E=(e,a)=>typeof e[a]=="function",ie=e=>e===void 0,fe=e=>typeof e=="boolean",b=e=>typeof e=="string",B=e=>e===void 0||b(e),la=e=>e===void 0||typeof e=="number",pa=e=>e===void 0||typeof e=="boolean",w=(e,a)=>e.length===a.length&&a.every((n,t)=>n(e[t])),O=e=>g(e)&&typeof e.ok=="boolean"&&(e.error===void 0||typeof e.error=="string"),ot=e=>g(e),fa=e=>g(e)&&b(e.id)&&b(e.title)&&b(e.date)&&(e.documentRef===void 0||g(e.documentRef)&&b(e.documentRef.pluginId)&&b(e.documentRef.sourceId)&&b(e.documentRef.itemId)),ba=e=>g(e)&&b(e.date)&&B(e.startTime)&&B(e.endTime)&&B(e.sourceId)&&B(e.itemId),ga=e=>g(e)&&b(e.url)&&B(e.title)&&pa(e.newTab),ma=e=>g(e)&&b(e.query),st=e=>g(e)&&b(e.name)&&B(e.context)&&Number.isFinite(e.lng)&&Number.isFinite(e.lat),ha=e=>Array.isArray(e)&&e.every(st),ka=e=>e===null||st(e),ya=e=>e===void 0||g(e)&&B(e.approvalToken)&&(e.cancellation===void 0||g(e.cancellation)),va=e=>typeof e=="string"||g(e)&&typeof e.text=="string",wa=e=>g(e)&&typeof e.name=="string"&&e.name.trim().length>0&&typeof e.description=="string"&&g(e.parameters)&&(e.sideEffect==="read"||e.sideEffect==="write")&&B(e.commandId)&&(e.commandDispatch===void 0||e.commandDispatch==="dynamic")&&(e.timeoutMs===void 0||Number.isSafeInteger(e.timeoutMs)&&Number(e.timeoutMs)>0&&Number(e.timeoutMs)<=3e5),it=e=>g(e)&&b(e.id)&&b(e.label)&&B(e.labelKey)&&B(e.description)&&(e.danger===void 0||typeof e.danger=="boolean")&&(e.enabled===void 0||typeof e.enabled=="boolean")&&(e.submenu===void 0||Array.isArray(e.submenu)&&e.submenu.every(it)),xa={list:{args:e=>e.length===0,result:e=>Array.isArray(e)&&e.every(fa)},create:{args:e=>w(e,[b,ot]),result:fe},update:{args:e=>w(e,[b,ot]),result:fe},remove:{args:e=>w(e,[b]),result:fe},open:{args:e=>w(e,[b]),result:ie},configure:{args:e=>e.length===0,result:ie},actions:{args:e=>w(e,[b]),result:e=>Array.isArray(e)&&e.every(it)},runAction:{args:e=>w(e,[b,b]),result:fe}},Sa=e=>g(e)&&b(e.name)&&b(e.version)&&B(e.description)&&B(e.author)&&(e.localized===void 0||g(e.localized)&&Object.values(e.localized).every(a=>g(a)&&b(a.name)&&B(a.description))),Sr=P("calendar.itemSource","service","1.3.0","many",e=>g(e)&&E(e,"list")&&(e.integration===void 0||Sa(e.integration)),void 0,xa,e=>e.integration),Ar=P("calendar.itemSourceRevision","state","1.0.0","many",e=>typeof e=="number"&&Number.isSafeInteger(e)&&e>=0),Ir=P("calendar.navigator","service","1.0.0","one",e=>g(e)&&E(e,"openDate"),void 0,{openDate:{args:e=>w(e,[ba]),result:ie}}),Rr=P("calendar.panelSelection","state","1.0.0","one",e=>g(e)&&(e.selectedDate===null||typeof e.selectedDate=="string")&&(e.rangeStart===null||typeof e.rangeStart=="string")&&(e.rangeEnd===null||typeof e.rangeEnd=="string")),Er=P("web.activeContext","state","1.0.0","one",e=>g(e)&&typeof e.instanceId=="string"&&typeof e.url=="string"&&typeof e.title=="string");function nt(e){return g(e)&&typeof e.id=="string"&&typeof e.displayName=="string"&&(e.avatarUrl===void 0||typeof e.avatarUrl=="string")&&Array.isArray(e.emails)&&e.emails.every(a=>g(a)&&typeof a.address=="string"&&(a.label===void 0||typeof a.label=="string"))}var Nr=P("contacts.directory","service","1.0.0","one",e=>g(e)&&["search","resolveEmails","open"].every(a=>E(e,a)),void 0,{search:{args:e=>e.length===2&&typeof e[0]=="string"&&e[0].length<=1e3&&Number.isInteger(e[1])&&Number(e[1])>0&&Number(e[1])<=50,result:e=>Array.isArray(e)&&e.length<=50&&e.every(nt)},resolveEmails:{args:e=>e.length===1&&Array.isArray(e[0])&&e[0].length<=200&&e[0].every(a=>typeof a=="string"&&a.length<=1e3),result:e=>Array.isArray(e)&&e.every(a=>g(a)&&typeof a.address=="string"&&Array.isArray(a.contacts)&&a.contacts.every(nt))},open:{args:e=>e.length>=1&&e.length<=2&&typeof e[0]=="string"&&(e[1]===void 0||g(e[1])&&(e[1].newTab===void 0||typeof e[1].newTab=="boolean")),result:ie}}),Pr=P("contacts.directoryRevision","state","1.0.0","one",e=>Number.isSafeInteger(e)&&Number(e)>=0),Tr=P("web.navigator","service","1.0.0","one",e=>g(e)&&E(e,"open"),void 0,{open:{args:e=>w(e,[ga]),result:ie}}),_r=P("selection.textAction","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&typeof e.label=="string"&&Array.isArray(e.surfaces)&&E(e,"run"),e=>[e.id]),Cr=P("geo.navigator","service","1.0.0","one",e=>g(e)&&E(e,"open"),void 0,{open:{args:e=>w(e,[ma]),result:ie}}),Dr=P("geo.search","service","1.0.0","one",e=>g(e)&&E(e,"search")&&E(e,"reverse"),void 0,{search:{args:e=>w(e,[b]),result:ha},reverse:{args:e=>w(e,[a=>Number.isFinite(a),a=>Number.isFinite(a)]),result:ka}}),Lr=P("agent.toolProvider","service","1.0.0","many",e=>g(e)&&Array.isArray(e.tools)&&e.tools.every(wa)&&E(e,"execute"),e=>e.tools.map(a=>a.name),{execute:{args:e=>w(e,[b,g,ya]),result:va}},e=>({tools:e.tools}),"global"),$r=P("guard.runtime","service","1.0.0","one",e=>g(e)&&["resolve","requestApproval","consumeToken","audit"].every(a=>E(e,a)),void 0,{resolve:{args:e=>w(e,[g]),result:g},requestApproval:{args:e=>w(e,[g]),result:fe},consumeToken:{args:e=>e.length>=1&&e.length<=2&&b(e[0])&&B(e[1]),result:fe},audit:{args:e=>w(e,[g]),result:ie}}),Or=P("browser.automation","service","1.0.0","one",e=>g(e)&&["list","open","switch","close","snapshot","readText","readHtml","screenshot","navigate","back","forward","reload","click","type","select","scroll","pressKey"].every(a=>E(e,a)),void 0,{list:{args:e=>e.length===0,result:O},open:{args:e=>w(e,[b]),result:O},switch:{args:e=>w(e,[b]),result:O},close:{args:e=>w(e,[b]),result:O},snapshot:{args:e=>w(e,[b]),result:O},readText:{args:e=>e.length>=1&&e.length<=2&&b(e[0])&&la(e[1]),result:O},readHtml:{args:e=>w(e,[b]),result:O},screenshot:{args:e=>w(e,[b]),result:O},click:{args:e=>w(e,[b,a=>typeof a=="number"]),result:O},type:{args:e=>e.length>=3&&e.length<=4&&b(e[0])&&typeof e[1]=="number"&&b(e[2])&&(e[3]===void 0||typeof e[3]=="boolean"),result:O},select:{args:e=>w(e,[b,a=>typeof a=="number",b]),result:O},scroll:{args:e=>w(e,[b,a=>typeof a=="number",a=>typeof a=="number"]),result:O},pressKey:{args:e=>w(e,[b,b]),result:O},navigate:{args:e=>w(e,[b,b]),result:O},back:{args:e=>w(e,[b]),result:O},forward:{args:e=>w(e,[b]),result:O},reload:{args:e=>w(e,[b]),result:O}}),zr=P("fileTree.contextItem","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.label=="string"&&B(e.labelKey)&&E(e,"run"),e=>[e.id]),Br=P("newTab.entry","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"run"),e=>[e.id]),Mr=P("search.resultCard","extension","1.0.0","many",e=>g(e)&&typeof e.cardKind=="string"&&E(e,"render")&&E(e,"open"),e=>[e.cardKind]),jr=P("metadataPanel.segment","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"render"),e=>[e.id]),ct=P("workspace.surface","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&["left_sidebar","right_sidebar","main_workspace","footer"].includes(String(e.surface))&&E(e,"getSnapshot")&&E(e,"subscribe")&&E(e,"restore"),e=>[e.id]),Vr=P("metadata.plugin","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"facts"),e=>[e.id]),Ur=P("workspace.viewState","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&["left_sidebar","right_sidebar","main_workspace"].includes(String(e.surface))&&E(e,"capture")&&E(e,"restore")&&E(e,"subscribe"),e=>[e.id]);var Ve={en:{"auto.0894fe6b352a":"e.g. the folder you want backed up","auto.0943b157227c":"\u2014 {{p0}} failure(s)","auto.09fef5d8d9a3":"Failed","auto.0c2cf66ed63c":"Removed {{p0}} old archive(s), kept {{p1}}","auto.101101ea16da":"Set up backup\u2026","auto.112053b66c92":"Open Backup settings","auto.11e10c8f488b":"Log folder","auto.197e112d07bd":"Clean up\u2026","auto.19adc47be34b":"Folders","auto.1bd661da498a":"\u201C{{p0}}\u201D will be removed from the backup settings.","auto.1c36bd34ec77":"Computing restore preview\u2026","auto.1d164664f6ed":"Done \u2014 {{p0}} archived in {{p1}}s","auto.1df120c8de5c":"T7 Drive","auto.237d0a57fc14":"Mirror configured folders with Valley's native backup engine, streaming progress live. Runs in the main process via the backup driver.","auto.2700ef39cb59":"Cleanup failed","auto.362a1984d15b":"Remove profile","auto.3ad30e772903":"Master log file","auto.3ef11aabc275":"Backup runs","auto.414f279b51ef":"Scanning {{p0}}\u2026","auto.432e860f10ff":"Backup settings","auto.4fe8252005e3":"Folder {{p0}}","auto.54a694543dfe":"Restore\u2026","auto.5d5dba0742de":"Backup now","auto.5f88ae056e7b":"This profile has no folders yet.","auto.62f3dd5a9d1f":"Files that changed or were deleted are kept beside each destination under a timestamp.","auto.668c5fffd24d":"Configured","auto.695e28140cb3":"e.g. a folder on your backup drive","auto.6da13addb000":"Source","auto.6f6c3dd91f16":"Apply restore","auto.6f902038d03f":"Folder for run logs (optional).","auto.77574766df8d":"Profile name","auto.77dfd2135f4d":"Cancel","auto.787035ed6c6d":"No output yet.","auto.7e3112f57746":"Live log","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archived","auto.80f1eaf78461":"Each profile's source/destination mappings, trash path and log locations.","auto.819ad5a4465c":"Trash folder","auto.82a68202d381":"Estimated ~{{p0}}","auto.82f841dac7be":"No backup profile yet. Add a folder and a destination on your drive to start mirroring.","auto.8911ca48fa04":"Remove {{p0}} old archive(s), keep {{p1}}?","auto.8b35536332aa":"{{p0}} error(s)","auto.90c0c2eb98de":"Reveal","auto.97bc98400c87":"Id of the profile the panel and the scheduled run use.","auto.9952bdb5d01a":"Backup profile","auto.9f5cd8a2e880":"Retry","auto.a0498c8d2c44":"Restore would add {{p0}}, update {{p1}}, remove {{p2}} file(s) \u2014 removed/overwritten files are escrowed. Apply?","auto.a50710e773e1":"Archives","auto.a584451ceaf9":"Recent backups","auto.a6df420d2c59":"Failed \u2014 {{p0}} error(s)","auto.a94ac9e3ecd0":"Manage profiles\u2026","auto.a95e286913bf":"working\u2026","auto.adeeae4a8510":"Deleted/changed files are archived here under a timestamp before being overwritten.","auto.b2b841a7fc71":"Checking archives\u2026","auto.bae7d5be7082":"Status","auto.beb2ea0a45a6":"Backup could not be started.","auto.bfc7470c583a":"Set up backup","auto.c0d31d3b9d31":"+ Add folder pair","auto.c848a612ec9b":"Restore failed","auto.caa8c9ee85cb":"Backup profiles","auto.cc1ebdd04e76":"Idle","auto.cc54e62c3e08":"Nothing to remove \u2014 {{p0}} archive(s) within retention","auto.cc687f43b582":"Can't back up \u201C{{p0}}\u201D","auto.d42713493ca8":"Destination","auto.d74340399e2a":"Active profile","auto.d7f2768ca570":"Preview failed","auto.d7fd3fcb4bb5":"{{p0}} archived","auto.dba2fb67adfe":"~{{p0}} left","auto.dd96994d01e7":"Backup","auto.df34924ef17e":"Restoring from backup\u2026","auto.dfdc3dc9aa44":"Restored {{p0}} file(s) \u2014 replaced/removed files escrowed beside the archives","auto.e5f58095ac29":"Starting\u2026","auto.e8642ee5ad7e":"Estimating\u2026","auto.e963907dac5c":"Remove","auto.e97ecd4af356":"Backup cannot run right now.","auto.ef04290fc628":"+ Add profile","auto.f4c16b17ee40":"Exclude","auto.f6005584e229":"Backing up\u2026","auto.f73992337e2d":"Backing up {{p0}}","auto.f7aa648b33ac":"No backups yet \u2014 every run you start shows up here.","auto.f7b023b83c72":"Removing old archives\u2026","auto.f9dcc3004855":"A one-line summary is appended here after each run.","auto.ff61c7ba16aa":"Remove?"},de:{"auto.0894fe6b352a":"z.B. den Ordner, den Sie sichern m\xF6chten","auto.0943b157227c":"\u2014 {{p0}} Fehler(e)","auto.09fef5d8d9a3":"Fehlgeschlagen","auto.0c2cf66ed63c":"{{p0}} alte(s) Archiv(e) entfernt, {{p1}} behalten","auto.101101ea16da":"Backup einrichten\u2026","auto.112053b66c92":"\xD6ffnen Sie die Backup-Einstellungen","auto.11e10c8f488b":"Protokollordner","auto.197e112d07bd":"Aufr\xE4umen\u2026","auto.19adc47be34b":"Ordner","auto.1bd661da498a":"\u201E{{p0}}\u201C wird aus den Sicherungseinstellungen entfernt.","auto.1c36bd34ec77":"Computing-Wiederherstellungsvorschau\u2026","auto.1d164664f6ed":"Fertig \u2013 {{p0}} archiviert in {{p1}}s","auto.1df120c8de5c":"T7-Laufwerk","auto.237d0a57fc14":"Spiegeln Sie konfigurierte Ordner mit der nativen Backup-Engine von Valley und streamen Sie den Fortschritt live. L\xE4uft im Hauptprozess \xFCber den Backup-Treiber.","auto.2700ef39cb59":"Die Bereinigung ist fehlgeschlagen","auto.362a1984d15b":"Profil entfernen","auto.3ad30e772903":"Master-Logdatei","auto.3ef11aabc275":"Backup l\xE4uft","auto.414f279b51ef":"Scannen von {{p0}}\u2026","auto.432e860f10ff":"Backup-Einstellungen","auto.4fe8252005e3":"Ordner {{p0}}","auto.54a694543dfe":"Wiederherstellen\u2026","auto.5d5dba0742de":"Jetzt sichern","auto.5f88ae056e7b":"Dieses Profil hat noch keine Ordner.","auto.62f3dd5a9d1f":"Ge\xE4nderte oder gel\xF6schte Dateien werden mit einem Zeitstempel neben jedem Ziel gespeichert.","auto.668c5fffd24d":"Konfiguriert","auto.695e28140cb3":"z.B. einen Ordner auf Ihrem Sicherungslaufwerk","auto.6da13addb000":"Quelle","auto.6f6c3dd91f16":"Wenden Sie die Wiederherstellung an","auto.6f902038d03f":"Ordner f\xFCr Laufprotokolle (optional).","auto.77574766df8d":"Profilname","auto.77dfd2135f4d":"Abbrechen","auto.787035ed6c6d":"Noch keine Ausgabe.","auto.7e3112f57746":"Live-Protokoll","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archiviert","auto.80f1eaf78461":"Die Quell-/Zielzuordnungen, der Papierkorbpfad und die Protokollspeicherorte jedes Profils.","auto.819ad5a4465c":"Papierkorbordner","auto.82a68202d381":"Gesch\xE4tzte ~{{p0}}","auto.82f841dac7be":"Noch kein Backup-Profil. F\xFCgen Sie einen Ordner und ein Ziel auf Ihrem Laufwerk hinzu, um mit der Spiegelung zu beginnen.","auto.8911ca48fa04":"{{p0}} alte(s) Archiv(e) entfernen, {{p1}} behalten?","auto.8b35536332aa":"{{p0}} Fehler(e)","auto.90c0c2eb98de":"Aufdeckung","auto.97bc98400c87":"ID des Profils, das das Panel und die geplante Ausf\xFChrung verwenden.","auto.9952bdb5d01a":"Backup-Profil","auto.9f5cd8a2e880":"Wiederholen","auto.a0498c8d2c44":"Die Wiederherstellung w\xFCrde {{p0}} hinzuf\xFCgen, {{p1}} aktualisieren und {{p2}} Datei(en) entfernen \u2013 entfernte/\xFCberschriebene Dateien werden treuh\xE4nderisch verwahrt. Anwenden?","auto.a50710e773e1":"Archiv","auto.a584451ceaf9":"Aktuelle Backups","auto.a6df420d2c59":"Fehlgeschlagen \u2013 {{p0}} Fehler","auto.a94ac9e3ecd0":"Profile verwalten\u2026","auto.a95e286913bf":"l\xE4uft\u2026","auto.adeeae4a8510":"Gel\xF6schte/ge\xE4nderte Dateien werden hier mit einem Zeitstempel archiviert, bevor sie \xFCberschrieben werden.","auto.b2b841a7fc71":"Archive werden \xFCberpr\xFCft\u2026","auto.bae7d5be7082":"Status","auto.beb2ea0a45a6":"Die Sicherung konnte nicht gestartet werden.","auto.bfc7470c583a":"Backup einrichten","auto.c0d31d3b9d31":"+ Ordnerpaar hinzuf\xFCgen","auto.c848a612ec9b":"Wiederherstellung fehlgeschlagen","auto.caa8c9ee85cb":"Backup Profile","auto.cc1ebdd04e76":"Leerlauf","auto.cc54e62c3e08":"Nichts zu entfernen \u2013 {{p0}} Archiv(e) innerhalb der Aufbewahrung","auto.cc687f43b582":"\u201E{{p0}}\u201C kann nicht gesichert werden","auto.d42713493ca8":"Ziel","auto.d74340399e2a":"Aktives Profil","auto.d7f2768ca570":"Vorschau fehlgeschlagen","auto.d7fd3fcb4bb5":"{{p0}} archiviert","auto.dba2fb67adfe":"~{{p0}} \xFCbrig","auto.dd96994d01e7":"Sicherung","auto.df34924ef17e":"Wiederherstellung aus Backup\u2026","auto.dfdc3dc9aa44":"Wiederhergestellte {{p0}} Datei(en) \u2013 ersetzte/entfernte Dateien, die neben den Archiven hinterlegt sind","auto.e5f58095ac29":"Beginnend mit \u2026","auto.e8642ee5ad7e":"Sch\xE4tzung\u2026","auto.e963907dac5c":"Entfernen","auto.e97ecd4af356":"Die Sicherung kann derzeit nicht ausgef\xFChrt werden.","auto.ef04290fc628":"+ Profil hinzuf\xFCgen","auto.f4c16b17ee40":"Ausschlie\xDFen","auto.f6005584e229":"Sichern\u2026","auto.f73992337e2d":"Sichern von {{p0}}","auto.f7aa648b33ac":"Noch keine Backups \u2013 jeder Durchlauf erscheint hier.","auto.f7b023b83c72":"Alte Archive entfernen\u2026","auto.f9dcc3004855":"Nach jedem Lauf wird hier eine einzeilige Zusammenfassung angeh\xE4ngt.","auto.ff61c7ba16aa":"Entfernen?"},es:{"auto.0894fe6b352a":"p.ej. la carpeta de la que desea hacer una copia de seguridad","auto.0943b157227c":"\u2014 {{p0}} fracaso(s)","auto.09fef5d8d9a3":"Fallido","auto.0c2cf66ed63c":"Se eliminaron {{p0}} archivos antiguos y se conservaron {{p1}}","auto.101101ea16da":"Configurar copia de seguridad\u2026","auto.112053b66c92":"Abrir configuraci\xF3n de copia de seguridad","auto.11e10c8f488b":"Carpeta de registro","auto.197e112d07bd":"Limpiar\u2026","auto.19adc47be34b":"Carpetas","auto.1bd661da498a":"\u201C{{p0}}\u201D se eliminar\xE1 de la configuraci\xF3n de copia de seguridad.","auto.1c36bd34ec77":"Vista previa de restauraci\xF3n inform\xE1tica\u2026","auto.1d164664f6ed":"Listo: {{p0}} archivado en {{p1}} s","auto.1df120c8de5c":"Unidad T7","auto.237d0a57fc14":"Refleje las carpetas configuradas con el motor de respaldo nativo de Valley y transmita el progreso en vivo. Se ejecuta en el proceso principal a trav\xE9s del controlador de respaldo.","auto.2700ef39cb59":"Error de limpieza","auto.362a1984d15b":"Eliminar perfil","auto.3ad30e772903":"Archivo de registro maestro","auto.3ef11aabc275":"Backup corre","auto.414f279b51ef":"Escaneando {{p0}}\u2026","auto.432e860f10ff":"Configuraci\xF3n de copia de seguridad","auto.4fe8252005e3":"Carpeta {{p0}}","auto.54a694543dfe":"Restaurar\u2026","auto.5d5dba0742de":"Copia de seguridad ahora","auto.5f88ae056e7b":"Este perfil a\xFAn no tiene carpetas.","auto.62f3dd5a9d1f":"Los archivos que cambiaron o fueron eliminados se guardan al lado de cada destino bajo una marca de tiempo.","auto.668c5fffd24d":"Configurado","auto.695e28140cb3":"p.ej. una carpeta en su unidad de respaldo","auto.6da13addb000":"Fuente","auto.6f6c3dd91f16":"Aplicar restauraci\xF3n","auto.6f902038d03f":"Carpeta para registros de ejecuci\xF3n (opcional).","auto.77574766df8d":"Nombre del perfil","auto.77dfd2135f4d":"Cancelar","auto.787035ed6c6d":"A\xFAn no hay resultados.","auto.7e3112f57746":"Registro en vivo","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archivado","auto.80f1eaf78461":"Las asignaciones de origen/destino, la ruta de la papelera y las ubicaciones de los registros de cada perfil.","auto.819ad5a4465c":"carpeta de basura","auto.82a68202d381":"Estimado ~{{p0}}","auto.82f841dac7be":"A\xFAn no hay perfil de respaldo. Agregue una carpeta y un destino en su disco para comenzar a duplicar.","auto.8911ca48fa04":"\xBFEliminar {{p0}} archivos antiguos y conservar {{p1}}?","auto.8b35536332aa":"{{p0}} errores","auto.90c0c2eb98de":"Revelar","auto.97bc98400c87":"Id. del perfil que utilizan el panel y la ejecuci\xF3n programada.","auto.9952bdb5d01a":"Perfil de respaldo","auto.9f5cd8a2e880":"Reintentar","auto.a0498c8d2c44":"Restaurar agregar\xEDa {{p0}}, actualizar\xEDa {{p1}}, eliminar\xEDa {{p2}} archivo(s); los archivos eliminados/sobrescritos est\xE1n en custodia. \xBFAplicar?","auto.a50710e773e1":"Archivos","auto.a584451ceaf9":"Copias de seguridad recientes","auto.a6df420d2c59":"Error: {{p0}} errores","auto.a94ac9e3ecd0":"Administrar perfiles\u2026","auto.a95e286913bf":"en curso\u2026","auto.adeeae4a8510":"Los archivos eliminados/modificados se archivan aqu\xED con una marca de tiempo antes de sobrescribirse.","auto.b2b841a7fc71":"Comprobando archivos\u2026","auto.bae7d5be7082":"Estado","auto.beb2ea0a45a6":"No se pudo iniciar la copia de seguridad.","auto.bfc7470c583a":"Configurar copia de seguridad","auto.c0d31d3b9d31":"+ Agregar par de carpetas","auto.c848a612ec9b":"Restauraci\xF3n fallida","auto.caa8c9ee85cb":"Backup perfiles","auto.cc1ebdd04e76":"Inactivo","auto.cc54e62c3e08":"No hay nada que eliminar: {{p0}} archivo(s) dentro de la retenci\xF3n","auto.cc687f43b582":'No se puede hacer una copia de seguridad de "{{p0}}"',"auto.d42713493ca8":"Destino","auto.d74340399e2a":"Perfil activo","auto.d7f2768ca570":"Error en la vista previa","auto.d7fd3fcb4bb5":"{{p0}} archivado","auto.dba2fb67adfe":"~{{p0}} izquierda","auto.dd96994d01e7":"Copia de seguridad","auto.df34924ef17e":"Restaurando desde la copia de seguridad\u2026","auto.dfdc3dc9aa44":"Archivo(s) {{p0}} restaurado: archivos reemplazados/eliminados almacenados en custodia junto a los archivos","auto.e5f58095ac29":"A partir de\u2026","auto.e8642ee5ad7e":"Estimando\u2026","auto.e963907dac5c":"Quitar","auto.e97ecd4af356":"La copia de seguridad no se puede ejecutar en este momento.","auto.ef04290fc628":"+ Agregar perfil","auto.f4c16b17ee40":"Excluir","auto.f6005584e229":"Copia de seguridad\u2026","auto.f73992337e2d":"Copia de seguridad {{p0}}","auto.f7aa648b33ac":"A\xFAn no hay copias de seguridad: cada ejecuci\xF3n que inicies aparecer\xE1 aqu\xED.","auto.f7b023b83c72":"Eliminando archivos antiguos\u2026","auto.f9dcc3004855":"Se adjunta aqu\xED un resumen de una l\xEDnea despu\xE9s de cada ejecuci\xF3n.","auto.ff61c7ba16aa":"\xBFEliminar?"},fr:{"auto.0894fe6b352a":"par ex. le dossier que vous souhaitez sauvegarder","auto.0943b157227c":"\u2014 {{p0}} \xE9chec(s)","auto.09fef5d8d9a3":"\xC9chou\xE9","auto.0c2cf66ed63c":"Suppression de {{p0}} anciennes archives, conservation de {{p1}}","auto.101101ea16da":"Configurer la sauvegarde\u2026","auto.112053b66c92":"Ouvrir les param\xE8tres de sauvegarde","auto.11e10c8f488b":"Dossier de journal","auto.197e112d07bd":"Nettoyer\u2026","auto.19adc47be34b":"Dossiers","auto.1bd661da498a":"\xAB {{p0}} \xBB sera supprim\xE9 des param\xE8tres de sauvegarde.","auto.1c36bd34ec77":"Aper\xE7u de la restauration informatique\u2026","auto.1d164664f6ed":"Termin\xE9 \u2014 {{p0}} archiv\xE9 dans {{p1}}s","auto.1df120c8de5c":"Lecteur T7","auto.237d0a57fc14":"Mettez en miroir les dossiers configur\xE9s avec le moteur de sauvegarde natif de Valley et diffusez la progression en direct. S'ex\xE9cute dans le processus principal via le pilote de sauvegarde.","auto.2700ef39cb59":"\xC9chec du nettoyage","auto.362a1984d15b":"Supprimer le profil","auto.3ad30e772903":"Fichier journal principal","auto.3ef11aabc275":"Backup fonctionne","auto.414f279b51ef":"Num\xE9risation {{p0}}\u2026","auto.432e860f10ff":"Param\xE8tres de sauvegarde","auto.4fe8252005e3":"Dossier {{p0}}","auto.54a694543dfe":"Restaurer\u2026","auto.5d5dba0742de":"Sauvegarder maintenant","auto.5f88ae056e7b":"Ce profil n'a pas encore de dossiers.","auto.62f3dd5a9d1f":"Les fichiers modifi\xE9s ou supprim\xE9s sont conserv\xE9s \xE0 c\xF4t\xE9 de chaque destination sous un horodatage.","auto.668c5fffd24d":"Configur\xE9","auto.695e28140cb3":"par ex. un dossier sur votre lecteur de sauvegarde","auto.6da13addb000":"Source","auto.6f6c3dd91f16":"Appliquer la restauration","auto.6f902038d03f":"Dossier pour les journaux d'ex\xE9cution (facultatif).","auto.77574766df8d":"Nom du profil","auto.77dfd2135f4d":"Annuler","auto.787035ed6c6d":"Aucune sortie pour l'instant.","auto.7e3112f57746":"Journal en direct","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archiv\xE9s","auto.80f1eaf78461":"Mappages source/destination, chemin de la corbeille et emplacements des journaux de chaque profil.","auto.819ad5a4465c":"Dossier Corbeille","auto.82a68202d381":"Estimation ~{{p0}}","auto.82f841dac7be":"Pas encore de profil de sauvegarde. Ajoutez un dossier et une destination sur votre lecteur pour d\xE9marrer la mise en miroir.","auto.8911ca48fa04":"Supprimer {{p0}} anciennes(s) archive(s), conserver {{p1}} ?","auto.8b35536332aa":"{{p0}} erreur(s)","auto.90c0c2eb98de":"R\xE9v\xE8le","auto.97bc98400c87":"Identifiant du profil utilis\xE9 par le panneau et l'ex\xE9cution planifi\xE9e.","auto.9952bdb5d01a":"Profil de sauvegarde","auto.9f5cd8a2e880":"R\xE9essayer","auto.a0498c8d2c44":"La restauration ajouterait {{p0}}, mettrait \xE0 jour {{p1}}, supprimerait {{p2}} fichier(s) \u2014 les fichiers supprim\xE9s/\xE9cras\xE9s sont d\xE9pos\xE9s. Appliquer?","auto.a50710e773e1":"Archives","auto.a584451ceaf9":"Sauvegardes r\xE9centes","auto.a6df420d2c59":"\xC9chec \u2013 {{p0}} erreur(s)","auto.a94ac9e3ecd0":"G\xE9rer les profils\u2026","auto.a95e286913bf":"en cours\u2026","auto.adeeae4a8510":"Les fichiers supprim\xE9s/modifi\xE9s sont archiv\xE9s ici sous un horodatage avant d'\xEAtre \xE9cras\xE9s.","auto.b2b841a7fc71":"V\xE9rification des archives\u2026","auto.bae7d5be7082":"Statut","auto.beb2ea0a45a6":"La sauvegarde n'a pas pu d\xE9marrer.","auto.bfc7470c583a":"Configurer la sauvegarde","auto.c0d31d3b9d31":"+ Ajouter une paire de dossiers","auto.c848a612ec9b":"La restauration a \xE9chou\xE9","auto.caa8c9ee85cb":"Backup profils","auto.cc1ebdd04e76":"Inactif","auto.cc54e62c3e08":"Rien \xE0 supprimer \u2013 {{p0}} archive(s) conserv\xE9e(s)","auto.cc687f43b582":'Impossible de sauvegarder "{{p0}}"',"auto.d42713493ca8":"Destination","auto.d74340399e2a":"Profil actif","auto.d7f2768ca570":"\xC9chec de l'aper\xE7u","auto.d7fd3fcb4bb5":"{{p0}} archiv\xE9","auto.dba2fb67adfe":"~{{p0}} reste","auto.dd96994d01e7":"Sauvegarde","auto.df34924ef17e":"Restauration \xE0 partir d'une sauvegarde\u2026","auto.dfdc3dc9aa44":"{{p0}} fichier(s) restaur\xE9(s) \u2013 fichiers remplac\xE9s/supprim\xE9s d\xE9pos\xE9s \xE0 c\xF4t\xE9 des archives","auto.e5f58095ac29":"D\xE9part\u2026","auto.e8642ee5ad7e":"Estimation\u2026","auto.e963907dac5c":"Supprimer","auto.e97ecd4af356":"La sauvegarde ne peut pas s'ex\xE9cuter pour le moment.","auto.ef04290fc628":"+ Ajouter un profil","auto.f4c16b17ee40":"Exclure","auto.f6005584e229":"Sauvegarde\u2026","auto.f73992337e2d":"Sauvegarde {{p0}}","auto.f7aa648b33ac":"Aucune sauvegarde pour l'instant : chaque ex\xE9cution que vous d\xE9marrez appara\xEEt ici.","auto.f7b023b83c72":"Suppression des anciennes archives\u2026","auto.f9dcc3004855":"Un r\xE9sum\xE9 d\u2019une ligne est annex\xE9 ici apr\xE8s chaque ex\xE9cution.","auto.ff61c7ba16aa":"Supprimer ?"},"zh-CN":{"auto.0894fe6b352a":"\u4F8B\u5982\u60A8\u8981\u5907\u4EFD\u7684\u6587\u4EF6\u5939","auto.0943b157227c":"\u2014 {{p0}} \u6B21\u5931\u8D25","auto.09fef5d8d9a3":"\u5931\u8D25\u7684","auto.0c2cf66ed63c":"\u5220\u9664\u4E86 {{p0}} \u4E2A\u65E7\u5B58\u6863\uFF0C\u4FDD\u7559\u4E86 {{p1}}","auto.101101ea16da":"\u8BBE\u7F6E\u5907\u4EFD\u2026","auto.112053b66c92":"\u6253\u5F00\u5907\u4EFD\u8BBE\u7F6E","auto.11e10c8f488b":"\u65E5\u5FD7\u6587\u4EF6\u5939","auto.197e112d07bd":"\u6E05\u7406\u2026","auto.19adc47be34b":"\u6587\u4EF6\u5939","auto.1bd661da498a":"\u201C{{p0}}\u201D\u5C06\u4ECE\u5907\u4EFD\u8BBE\u7F6E\u4E2D\u5220\u9664\u3002","auto.1c36bd34ec77":"\u8BA1\u7B97\u6062\u590D\u9884\u89C8\u2026","auto.1d164664f6ed":"\u5B8C\u6210 \u2014 {{p0}} \u5DF2\u5728 {{p1}} \u79D2\u5185\u5B58\u6863","auto.1df120c8de5c":"T7 \u9A71\u52A8\u5668","auto.237d0a57fc14":"\u4F7F\u7528 Valley \u7684\u672C\u673A\u5907\u4EFD\u5F15\u64CE\u955C\u50CF\u914D\u7F6E\u7684\u6587\u4EF6\u5939\uFF0C\u5B9E\u65F6\u4F20\u8F93\u8FDB\u5EA6\u3002\u901A\u8FC7\u5907\u4EFD\u9A71\u52A8\u7A0B\u5E8F\u5728\u4E3B\u8FDB\u7A0B\u4E2D\u8FD0\u884C\u3002","auto.2700ef39cb59":"\u6E05\u7406\u5931\u8D25","auto.362a1984d15b":"\u5220\u9664\u914D\u7F6E\u6587\u4EF6","auto.3ad30e772903":"\u4E3B\u65E5\u5FD7\u6587\u4EF6","auto.3ef11aabc275":"Backup \u8FD0\u884C","auto.414f279b51ef":"\u6B63\u5728\u626B\u63CF{{p0}}\u2026","auto.432e860f10ff":"\u5907\u4EFD\u8BBE\u7F6E","auto.4fe8252005e3":"\u6587\u4EF6\u5939 {{p0}}","auto.54a694543dfe":"\u6062\u590D\u2026","auto.5d5dba0742de":"\u7ACB\u5373\u5907\u4EFD","auto.5f88ae056e7b":"\u8BE5\u914D\u7F6E\u6587\u4EF6\u8FD8\u6CA1\u6709\u6587\u4EF6\u5939\u3002","auto.62f3dd5a9d1f":"\u66F4\u6539\u6216\u5220\u9664\u7684\u6587\u4EF6\u4FDD\u5B58\u5728\u6BCF\u4E2A\u76EE\u6807\u65C1\u8FB9\u7684\u65F6\u95F4\u6233\u4E0B\u3002","auto.668c5fffd24d":"\u5DF2\u914D\u7F6E","auto.695e28140cb3":"\u4F8B\u5982\u5907\u4EFD\u9A71\u52A8\u5668\u4E0A\u7684\u6587\u4EF6\u5939","auto.6da13addb000":"\u6765\u6E90","auto.6f6c3dd91f16":"\u5E94\u7528\u6062\u590D","auto.6f902038d03f":"\u8FD0\u884C\u65E5\u5FD7\u7684\u6587\u4EF6\u5939\uFF08\u53EF\u9009\uFF09\u3002","auto.77574766df8d":"\u4E2A\u4EBA\u8D44\u6599\u540D\u79F0","auto.77dfd2135f4d":"\u53D6\u6D88","auto.787035ed6c6d":"\u8FD8\u6CA1\u6709\u8F93\u51FA\u3002","auto.7e3112f57746":"\u5B9E\u65F6\u65E5\u5FD7","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} \u5DF2\u5B58\u6863","auto.80f1eaf78461":"\u6BCF\u4E2A\u914D\u7F6E\u6587\u4EF6\u7684\u6E90/\u76EE\u6807\u6620\u5C04\u3001\u5783\u573E\u8DEF\u5F84\u548C\u65E5\u5FD7\u4F4D\u7F6E\u3002","auto.819ad5a4465c":"\u5783\u573E\u6587\u4EF6\u5939","auto.82a68202d381":"\u4F30\u8BA1~{{p0}}","auto.82f841dac7be":"\u8FD8\u6CA1\u6709\u5907\u4EFD\u914D\u7F6E\u6587\u4EF6\u3002\u5728\u9A71\u52A8\u5668\u4E0A\u6DFB\u52A0\u6587\u4EF6\u5939\u548C\u76EE\u6807\u4EE5\u5F00\u59CB\u955C\u50CF\u3002","auto.8911ca48fa04":"\u5220\u9664 {{p0}} \u65E7\u5B58\u6863\uFF0C\u4FDD\u7559 {{p1}}\uFF1F","auto.8b35536332aa":"{{p0}} \u9519\u8BEF","auto.90c0c2eb98de":"\u542F\u793A","auto.97bc98400c87":"\u9762\u677F\u548C\u8BA1\u5212\u8FD0\u884C\u4F7F\u7528\u7684\u914D\u7F6E\u6587\u4EF6\u7684 ID\u3002","auto.9952bdb5d01a":"\u5907\u4EFD\u914D\u7F6E\u6587\u4EF6","auto.9f5cd8a2e880":"\u91CD\u8BD5","auto.a0498c8d2c44":"\u6062\u590D\u5C06\u6DFB\u52A0 {{p0}}\u3001\u66F4\u65B0 {{p1}}\u3001\u5220\u9664 {{p2}} \u6587\u4EF6 - \u5220\u9664/\u8986\u76D6\u7684\u6587\u4EF6\u5C06\u88AB\u6258\u7BA1\u3002\u7533\u8BF7\uFF1F","auto.a50710e773e1":"\u6863\u6848","auto.a584451ceaf9":"\u6700\u8FD1\u7684\u5907\u4EFD","auto.a6df420d2c59":"\u5931\u8D25 - {{p0}} \u4E2A\u9519\u8BEF","auto.a94ac9e3ecd0":"\u7BA1\u7406\u914D\u7F6E\u6587\u4EF6\u2026","auto.a95e286913bf":"\u8FDB\u884C\u4E2D\u2026","auto.adeeae4a8510":"\u5220\u9664/\u66F4\u6539\u7684\u6587\u4EF6\u5728\u88AB\u8986\u76D6\u4E4B\u524D\u4F1A\u5728\u65F6\u95F4\u6233\u4E0B\u5B58\u6863\u5728\u8FD9\u91CC\u3002","auto.b2b841a7fc71":"\u68C0\u67E5\u6863\u6848\u2026","auto.bae7d5be7082":"\u72B6\u6001","auto.beb2ea0a45a6":"\u65E0\u6CD5\u5F00\u59CB\u5907\u4EFD\u3002","auto.bfc7470c583a":"\u8BBE\u7F6E\u5907\u4EFD","auto.c0d31d3b9d31":"+ \u6DFB\u52A0\u6587\u4EF6\u5939\u5BF9","auto.c848a612ec9b":"\u6062\u590D\u5931\u8D25","auto.caa8c9ee85cb":"Backup\u4E2A\u4EBA\u8D44\u6599","auto.cc1ebdd04e76":"\u95F2\u7F6E\u7684","auto.cc54e62c3e08":"\u6CA1\u6709\u53EF\u5220\u9664\u7684\u5185\u5BB9 \u2014 \u4FDD\u7559\u8303\u56F4\u5185\u7684 {{p0}} \u4E2A\u5B58\u6863","auto.cc687f43b582":"\u65E0\u6CD5\u5907\u4EFD\u201C{{p0}}\u201D","auto.d42713493ca8":"\u76EE\u7684\u5730","auto.d74340399e2a":"\u6D3B\u52A8\u6863\u6848","auto.d7f2768ca570":"\u9884\u89C8\u5931\u8D25","auto.d7fd3fcb4bb5":"{{p0}} \u5DF2\u5B58\u6863","auto.dba2fb67adfe":"\u8FD8\u5269\u4E0B~{{p0}}","auto.dd96994d01e7":"\u5907\u4EFD","auto.df34924ef17e":"\u4ECE\u5907\u4EFD\u6062\u590D\u2026","auto.dfdc3dc9aa44":"\u5DF2\u6062\u590D\u7684 {{p0}} \u6587\u4EF6 \u2014 \u66FF\u6362/\u5220\u9664\u7684\u6587\u4EF6\u6258\u7BA1\u5728\u5B58\u6863\u65C1\u8FB9","auto.e5f58095ac29":"\u5F00\u59CB\u2026","auto.e8642ee5ad7e":"\u4F30\u8BA1\u2026","auto.e963907dac5c":"\u5220\u9664","auto.e97ecd4af356":"\u5907\u4EFD\u73B0\u5728\u65E0\u6CD5\u8FD0\u884C\u3002","auto.ef04290fc628":"+ \u6DFB\u52A0\u4E2A\u4EBA\u8D44\u6599","auto.f4c16b17ee40":"\u6392\u9664","auto.f6005584e229":"\u6B63\u5728\u5907\u4EFD\u2026","auto.f73992337e2d":"\u6B63\u5728\u5907\u4EFD {{p0}}","auto.f7aa648b33ac":"\u8FD8\u6CA1\u6709\u5907\u4EFD - \u60A8\u5F00\u59CB\u7684\u6BCF\u6B21\u8FD0\u884C\u90FD\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002","auto.f7b023b83c72":"\u5220\u9664\u65E7\u6863\u6848\u2026","auto.f9dcc3004855":"\u6BCF\u6B21\u8FD0\u884C\u540E\u90FD\u4F1A\u5728\u6B64\u5904\u9644\u52A0\u4E00\u884C\u6458\u8981\u3002","auto.ff61c7ba16aa":"\u79FB\u9664\uFF1F"}};var ut={en:{"backup.surface.status":"Backup progress","backup.surface.profiles":"List backup profiles","backup.surface.profile-read":"Read backup profile","backup.surface.profile-create":"Create backup profile","backup.surface.profile-update":"Update backup profile","backup.surface.profile-delete":"Delete backup profile","backup.surface.check":"Check backup profile","backup.surface.history":"Read backup history","backup.surface.prune-preview":"Preview backup retention","backup.surface.prune":"Apply backup retention","backup.surface.restore-preview":"Preview backup restore","backup.surface.restore":"Restore backup mapping","backup.surface.id":"Profile ID","backup.surface.name":"Name","backup.surface.mappings":"Folder pairs","backup.surface.trashPath":"Trash folder","backup.surface.logDirectory":"Log folder","backup.surface.masterLog":"Master log file","backup.surface.profileCount":"Profiles","backup.properties.saveError":"Could not save your changes. Your edits are kept; try again."},de:{"backup.surface.status":"Sicherungsfortschritt","backup.surface.profiles":"Sicherungsprofile auflisten","backup.surface.profile-read":"Sicherungsprofil lesen","backup.surface.profile-create":"Sicherungsprofil erstellen","backup.surface.profile-update":"Sicherungsprofil bearbeiten","backup.surface.profile-delete":"Sicherungsprofil l\xF6schen","backup.surface.check":"Sicherungsprofil pr\xFCfen","backup.surface.history":"Sicherungsverlauf lesen","backup.surface.prune-preview":"Aufbewahrungsvorschau anzeigen","backup.surface.prune":"Aufbewahrungsregeln anwenden","backup.surface.restore-preview":"Wiederherstellungsvorschau anzeigen","backup.surface.restore":"Sicherung wiederherstellen","backup.surface.id":"Profil-ID","backup.surface.name":"Name","backup.surface.mappings":"Ordnerpaare","backup.surface.trashPath":"Papierkorbordner","backup.surface.logDirectory":"Protokollordner","backup.surface.masterLog":"Hauptprotokolldatei","backup.surface.profileCount":"Profile","backup.properties.saveError":"Deine \xC4nderungen konnten nicht gespeichert werden. Sie bleiben erhalten; versuche es erneut."},es:{"backup.surface.status":"Progreso de copia","backup.surface.profiles":"Listar perfiles de copia","backup.surface.profile-read":"Leer perfil de copia","backup.surface.profile-create":"Crear perfil de copia","backup.surface.profile-update":"Editar perfil de copia","backup.surface.profile-delete":"Eliminar perfil de copia","backup.surface.check":"Comprobar perfil de copia","backup.surface.history":"Leer historial de copias","backup.surface.prune-preview":"Vista previa de retenci\xF3n","backup.surface.prune":"Aplicar retenci\xF3n","backup.surface.restore-preview":"Vista previa de restauraci\xF3n","backup.surface.restore":"Restaurar copia","backup.surface.id":"ID del perfil","backup.surface.name":"Nombre","backup.surface.mappings":"Pares de carpetas","backup.surface.trashPath":"Carpeta de papelera","backup.surface.logDirectory":"Carpeta de registros","backup.surface.masterLog":"Archivo de registro principal","backup.surface.profileCount":"Perfiles","backup.properties.saveError":"No se pudieron guardar los cambios. Se conservan; int\xE9ntalo de nuevo."},fr:{"backup.surface.status":"Progression de la sauvegarde","backup.surface.profiles":"Lister les profils de sauvegarde","backup.surface.profile-read":"Lire le profil de sauvegarde","backup.surface.profile-create":"Cr\xE9er un profil de sauvegarde","backup.surface.profile-update":"Modifier le profil de sauvegarde","backup.surface.profile-delete":"Supprimer le profil de sauvegarde","backup.surface.check":"V\xE9rifier le profil de sauvegarde","backup.surface.history":"Lire l\u2019historique des sauvegardes","backup.surface.prune-preview":"Aper\xE7u de la r\xE9tention","backup.surface.prune":"Appliquer la r\xE9tention","backup.surface.restore-preview":"Aper\xE7u de la restauration","backup.surface.restore":"Restaurer la sauvegarde","backup.surface.id":"Identifiant du profil","backup.surface.name":"Nom","backup.surface.mappings":"Paires de dossiers","backup.surface.trashPath":"Dossier de corbeille","backup.surface.logDirectory":"Dossier des journaux","backup.surface.masterLog":"Fichier journal principal","backup.surface.profileCount":"Profils","backup.properties.saveError":"Impossible d\u2019enregistrer vos modifications. Elles sont conserv\xE9es ; r\xE9essayez."},"zh-CN":{"backup.surface.status":"\u5907\u4EFD\u8FDB\u5EA6","backup.surface.profiles":"\u5217\u51FA\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-read":"\u8BFB\u53D6\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-create":"\u521B\u5EFA\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-update":"\u7F16\u8F91\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-delete":"\u5220\u9664\u5907\u4EFD\u914D\u7F6E","backup.surface.check":"\u68C0\u67E5\u5907\u4EFD\u914D\u7F6E","backup.surface.history":"\u8BFB\u53D6\u5907\u4EFD\u5386\u53F2","backup.surface.prune-preview":"\u9884\u89C8\u5907\u4EFD\u4FDD\u7559\u6E05\u7406","backup.surface.prune":"\u6267\u884C\u5907\u4EFD\u4FDD\u7559\u6E05\u7406","backup.surface.restore-preview":"\u9884\u89C8\u6062\u590D","backup.surface.restore":"\u6062\u590D\u5907\u4EFD","backup.surface.id":"\u914D\u7F6E ID","backup.surface.name":"\u540D\u79F0","backup.surface.mappings":"\u6587\u4EF6\u5939\u914D\u5BF9","backup.surface.trashPath":"\u56DE\u6536\u7AD9\u6587\u4EF6\u5939","backup.surface.logDirectory":"\u65E5\u5FD7\u6587\u4EF6\u5939","backup.surface.masterLog":"\u4E3B\u65E5\u5FD7\u6587\u4EF6","backup.surface.profileCount":"\u914D\u7F6E\u6570","backup.properties.saveError":"\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\uFF1B\u8BF7\u91CD\u8BD5\u3002"}};function dt(e,a){return(ut.en[e]??Ve.en[e]??e).replace(/\{\{([^}]+)\}\}/g,(t,h)=>String(a?.[h]??""))}var lt=dt;function pt(e){lt=(a,n)=>{let t=e.ui.t(a,n);return t===a?dt(a,n):t},e.ui.registerCatalogs(Ve),e.ui.registerCatalogs(ut)}function o(e,a){return lt(e,a)}var Ue="notes-backup-styles",Aa=`
@keyframes notes-backup-spin { to { transform: rotate(360deg) } }

.settings-section.backup-settings-list,
.settings-section.backup-settings-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-section.backup-settings-list { gap: 0; }
.backup-settings-folder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--border-light);
}
.backup-settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.backup-settings-field { width: min(320px, 100%); }
.backup-settings-add { align-self: flex-start; }
.backup-settings-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.backup-settings-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: var(--hover-bg);
  color: var(--text-secondary);
}
.backup-settings-glyph svg { width: 16px; height: 16px; }
.backup-settings-glyph--large { width: 42px; height: 42px; }
.backup-settings-glyph--large svg { width: 20px; height: 20px; }
.backup-settings-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 2px 9px;
  border: 1px solid var(--border-medium);
  border-radius: 999px;
  background: var(--container-color-alt);
  color: var(--text-secondary);
  font-size:0.6875rem;
  white-space: nowrap;
}
.backup-settings-badge.is-configured {
  border-color: transparent;
  background: var(--accent-tint-bg);
  color: var(--accent-tint-text);
}
.backup-settings-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--negative-color);
}
.backup-settings-badge.is-configured .backup-settings-dot { background: var(--positive-color); }
.backup-settings-remove {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
}

.backup-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: var(--interface-font);
  color: var(--text-color);
}

/* ---- Header profile picker (sits beside the panel title) ---------------- */
/* .panel-header is a window drag region \u2014 every control in it needs no-drag. */
.backup-profile {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 62%;
  height: 26px;
  padding: 0 var(--space-1) 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--smaller-font-size);
  font-weight: var(--font-medium);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.backup-profile:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--title-color);
}
.backup-profile:disabled { cursor: default; opacity: 0.55; }
.backup-profile-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.backup-profile svg { width: 13px; height: 13px; flex: none; color: var(--text-tertiary); }

/* ---- Tab strip \u2014 37px content + 1px line ------------------------------- */
.backup-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
  height: var(--app-bar-height);
  padding: 0 5px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--border-light);
}
.backup-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.backup-tab:hover { background: var(--hover-bg); color: var(--title-color); }
.backup-tab.active { background: var(--accent-tint-bg); color: var(--accent-tint-text); }
.backup-tab svg { width: 16px; height: 16px; }
.backup-tab--end { margin-left: auto; }

/* A run stays visible from every tab: a hairline of progress under the strip. */
.backup-runline {
  flex-shrink: 0;
  height: 2px;
  background: var(--container-color-light);
}
.backup-runline > i {
  display: block;
  height: 100%;
  background: var(--accent-color);
  transition: width var(--duration-base) var(--ease-out);
}

/* ---- Body -------------------------------------------------------------- */
.backup-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-4);
  overflow-x: hidden;
  overflow-y: auto;
}
/* A flex item's min-width defaults to auto: without this, one nowrap button sets
   the min-content width and the whole card spills past the panel edge. */
.backup-body > * { min-width: 0; }
/* The log tab fills instead of scrolling \u2014 the <pre> owns the scrollbar. */
.backup-body--fill { overflow: hidden; }

/* ---- Primary action ---------------------------------------------------- */
.backup-run {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius);
  background: var(--accent-color);
  color: #fff;
  font-family: inherit;
  font-size: var(--small-font-size);
  font-weight: var(--font-semi-bold);
  cursor: pointer;
  transition: filter var(--duration-fast) var(--ease-out);
}
.backup-run:hover:not(:disabled) { filter: brightness(1.08); }
.backup-run:disabled { opacity: 0.6; cursor: default; }
.backup-run svg { width: 15px; height: 15px; }

/* ---- Secondary buttons -------------------------------------------------- */
.backup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: 5px var(--space-3);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius);
  background: var(--container-color);
  color: var(--text-color);
  font-family: inherit;
  font-size: var(--smaller-font-size);
  font-weight: var(--font-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}
.backup-btn:hover:not(:disabled) { background: var(--hover-bg); color: var(--title-color); }
.backup-btn:disabled { opacity: 0.45; cursor: default; }
.backup-btn--accent {
  border-color: transparent;
  background: var(--accent-tint-bg);
  color: var(--accent-tint-text);
}
.backup-btn--accent:hover:not(:disabled) { background: var(--accent-tint-bg); filter: brightness(1.1); }
.backup-btn--quiet {
  border-color: transparent;
  background: transparent;
  color: var(--text-secondary);
}
.backup-btn--wide { flex: 1 1 auto; }

/* ---- Progress ----------------------------------------------------------- */
.backup-progress { display: flex; flex-direction: column; gap: var(--space-1); }
.backup-track {
  height: 6px;
  width: 100%;
  border-radius: var(--radius);
  background: var(--container-color-light);
  overflow: hidden;
}
.backup-track > i {
  display: block;
  height: 100%;
  border-radius: var(--radius);
  background: var(--accent-color);
  transition: width var(--duration-base) var(--ease-out);
}
.backup-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--smaller-font-size);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ---- Status line -------------------------------------------------------- */
.backup-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--small-font-size);
  color: var(--text-secondary);
}
.backup-status.is-done { color: var(--positive-color); }
.backup-status.is-failed { color: var(--negative-color); }
.backup-status span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.backup-status svg { width: 14px; height: 14px; flex: none; }

/* ---- Section heads ------------------------------------------------------ */
.backup-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 24px;
}
.backup-section-title {
  font-size: var(--smaller-font-size);
  font-weight: var(--font-semi-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

/* ---- Flat hairline rows (folders, history, archives) -------------------- */
.backup-rows { display: flex; flex-direction: column; min-width: 0; }
.backup-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--border-light);
}
.backup-rows > .backup-row:first-child { border-top: none; padding-top: 0; }
.backup-row-icon { display: flex; flex: none; color: var(--text-tertiary); }
.backup-row-icon svg { width: 14px; height: 14px; }
.backup-row-icon.is-ok { color: var(--positive-color); }
.backup-row-icon.is-bad { color: var(--negative-color); }
.backup-row-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
.backup-row-label {
  font-size: var(--small-font-size);
  color: var(--title-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.backup-row-sub {
  font-size: var(--smaller-font-size);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Shrinkable on purpose: with flex:none a long value squeezed
   .backup-row-main to zero width and the folder name vanished. */
.backup-row-meta {
  flex: 0 1 auto;
  font-size: var(--smaller-font-size);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.backup-row-actions { display: flex; align-items: center; gap: var(--space-1); flex: none; }

/* ---- Alert (pre-flight issues) ------------------------------------------ */
/* The sidebar is 245px at its narrowest: the card must shrink (min-width:0) and
   its buttons wrap instead of pushing the card past the panel edge. */
.backup-alert {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--tint-red-bg);
}
.backup-alert-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--small-font-size);
  font-weight: var(--font-semi-bold);
  color: var(--tint-red-text);
}
.backup-alert-title svg { width: 15px; height: 15px; flex: none; }
.backup-alert-msg {
  font-size: var(--smaller-font-size);
  color: var(--text-color);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.backup-alert-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.backup-alert-actions > .backup-btn { flex: 1 1 auto; min-width: 0; }

/* ---- Inline confirm cards (prune / restore) ----------------------------- */
.backup-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--container-color-light);
}
.backup-card-text {
  font-size: var(--smaller-font-size);
  color: var(--title-color);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.backup-card-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.backup-card-actions > .backup-btn { flex: 1 1 auto; min-width: 0; }
.backup-note { font-size: var(--smaller-font-size); color: var(--text-tertiary); line-height: 1.45; }

/* ---- Empty states -------------------------------------------------------- */
.backup-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-3);
  text-align: center;
  font-size: var(--smaller-font-size);
  color: var(--text-tertiary);
  line-height: 1.5;
}

/* ---- Raw mirror log ------------------------------------------------------- */
.backup-log {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius);
  background: var(--surface-color-alt);
  color: var(--text-secondary);
  font-family: var(--mono-font);
  font-size: var(--smaller-font-size);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
}
`;function ft(){let e=document.getElementById(Ue);return e||(e=document.createElement("style"),e.id=Ue,document.head.appendChild(e)),e.textContent=Aa,()=>{document.getElementById(Ue)===e&&e.remove()}}var z=e=>typeof e=="string"?e:e==null?"":String(e),Se=()=>`p${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,Ia=e=>Array.isArray(e)?e.map(a=>{let n=a??{},t=Array.isArray(n.exclude)?n.exclude.map(String):[];return{source:z(n.source),destination:z(n.destination),excludeText:t.join(", ")}}):[],ce=e=>Array.isArray(e.profiles)?e.profiles.filter(a=>!!a&&typeof a=="object").map((a,n)=>({id:z(a.id).trim()||Se(),name:z(a.name).trim()||`Profile ${n+1}`,rows:Ia(a.mappings),trashPath:z(a.trashPath),logDirectory:z(a.logDirectory),masterLog:z(a.masterLog)})):[],M=e=>({id:e.id,name:e.name.trim()||"Untitled",mappings:e.rows.map(a=>({source:a.source.trim(),destination:a.destination.trim(),exclude:a.excludeText.split(",").map(n=>n.trim()).filter(Boolean)})),trashPath:e.trashPath.trim(),logDirectory:e.logDirectory.trim(),masterLog:e.masterLog.trim()});function bt(e){let a=ce(e.settings.get()),n=JSON.stringify(a.map(M)),t=!1,h=Promise.resolve(),S=new Set,v=()=>{for(let d of S)d()},C=e.settings.subscribe(()=>{if(t)return;let d=ce(e.settings.get()),A=JSON.stringify(d.map(M));A!==n&&(a=d,n=A,v())}),i=d=>{a=typeof d=="function"?d(a):d,t=JSON.stringify(a.map(M))!==n,v()};return{getSnapshot:()=>a,subscribe:d=>(S.add(d),()=>{S.delete(d)}),setDraft:i,save:d=>{let A=d.map(M);i(d);let x=h.then(async()=>{if(!(await e.settings.set("profiles",A)).ok)throw new Error("Could not save backup profiles");n=JSON.stringify(A),t=JSON.stringify(a.map(M))!==n,v()});return h=x.catch(()=>{}),x},assertClean:()=>{if(t)throw new Error("Finish editing backup settings before changing profiles through automation")},dispose:()=>{C(),S.clear()}}}var Fe={type:"object",properties:{profileId:{type:"string"}},additionalProperties:!1};function ge(e){if(e==null)return{};if(typeof e!="object"||Array.isArray(e))throw new Error("Expected an object");return e}function He(e){let a=ge(e).profileId;if(a!==void 0&&(typeof a!="string"||!a.trim()))throw new Error("profileId must be a nonempty string");return a?{profileId:String(a)}:{}}var be={schema:Fe,parse:He,fromCli:(e,a)=>({profileId:a.profile??e[0]})},Ge={name:{type:"string",minLength:1},mappings:{type:"array",items:{type:"object",properties:{source:{type:"string"},destination:{type:"string"},exclude:{type:"array",items:{type:"string"}}},required:["source","destination"],additionalProperties:!1}},trashPath:{type:"string"},logDirectory:{type:"string"},masterLog:{type:"string"}};function qe(e){let a=ge(e);for(let[n,t]of Object.entries(a)){if(!(n in Ge))throw new Error(`Unknown profile field: ${n}`);if(n==="mappings"){if(!Array.isArray(t))throw new Error("mappings must be an array");for(let h of t){let S=ge(h);if(typeof S.source!="string"||typeof S.destination!="string")throw new Error("A mapping requires source and destination paths");if(S.exclude!==void 0&&(!Array.isArray(S.exclude)||!S.exclude.every(v=>typeof v=="string")))throw new Error("Mapping exclusions must be strings");if(Object.keys(S).some(v=>!["source","destination","exclude"].includes(v)))throw new Error("Unknown mapping field")}}else if(typeof t!="string"||n==="name"&&!t.trim())throw new Error(`Invalid ${n}`)}return a}function gt(e,a){let n=!1,t=null,h=null,S=e.drivers.backup.onProgress(A=>{h=A}),v=A=>{let x=a.getSnapshot(),D=A??String(e.settings.get().activeProfileId??""),W=D?x.find(K=>K.id===D):x[0];if(!W)throw new Error(`Backup profile not found: ${D||"(none configured)"}`);return W},C=(A=50,x)=>e.data.dataset("backup_runs").query({orderBy:[{field:"startedAt",direction:"desc"}],limit:A,cursor:x}),i=async(A,x=!1)=>{if(a.assertClean(),n)throw new Error("A backup is already running. Check backup:status before starting another.");let D=v(A);n=!0,t=D.id,h=null;try{if(!x){let T=await e.drivers.backup.check(D.id);if(!T.ok||!T.data?.ok)throw new Error(T.error??T.data?.issues.map(ae=>ae.message).join("; ")??"Backup precheck failed")}let W=new Date().toISOString(),K=await e.drivers.backup.run(D.id);if(K.data){let T=K.data;await e.data.dataset("backup_runs").insert({id:crypto.randomUUID(),startedAt:W,profileName:T.profileName??D.name,durationSec:T.durationSec,archived:T.archived,errors:T.errors,ok:T.ok,reason:T.ok?null:T.message??null});let ae=await C(1e3);for(let De of ae.rows.slice(50))await e.data.dataset("backup_runs").delete({id:String(De.id)})}return K}finally{n=!1}},c=async(A,x)=>{a.assertClean(),await a.save(A);let D=JSON.stringify(A.map(M));return{value:A.map(M),revert:{label:"Update backup profiles",run:async()=>{if(a.assertClean(),JSON.stringify(a.getSnapshot().map(M))!==D)throw new Error("Backup profiles changed after this operation");await a.save(x)}}}};return{profile:v,history:C,run:i,replace:c,update:async(A,x)=>{let D=v(A),W=qe(x),K=a.getSnapshot(),[T]=ce({profiles:[{...M(D),...W}]});return c(K.map(ae=>ae.id===D.id?T:ae),K)},status:()=>({running:n,profileId:t,progress:h}),dispose:S}}function mt(e,a,n){let t=({profileId:i})=>M(n.profile(i)),h=async({profileId:i})=>{let c=await e.drivers.backup.prune({profileId:n.profile(i).id,dryRun:!0});if(!c.ok||!c.data||c.data.errors.length)throw new Error(c.error??c.data?.errors.map(d=>d.message).join("; ")??"Could not inspect backup retention");return c.data},S=async({profileId:i,mappingIndex:c})=>{let d=await e.drivers.backup.restorePlan(c,i);if(!d.ok||!d.data?.ok)throw new Error(d.error??d.data?.message??"Could not inspect this restore");return d.data},v={schema:{...Fe,properties:{...Fe.properties,mappingIndex:{type:"integer",minimum:0}},required:["mappingIndex"]},parse:i=>{let c=He(i),d=Number(ge(i).mappingIndex);if(!Number.isInteger(d)||d<0)throw new Error("mappingIndex must be a nonnegative integer");let A=n.profile(c.profileId);if(!A.rows[d])throw new Error("Backup mapping does not exist");return{profileId:A.id,mappingIndex:d}}},C=[e.commands.register({id:"status",label:"Backup progress",labelKey:"backup.surface.status",sideEffect:"read",paletteSafe:!1,run:n.status}),e.commands.register({id:"profiles",label:"List backup profiles",labelKey:"backup.surface.profiles",paletteSafe:!1,sideEffect:"read",run:()=>a.getSnapshot().map(M)}),e.commands.register({id:"profile-read",label:"Read backup profile",labelKey:"backup.surface.profile-read",paletteSafe:!1,sideEffect:"read",input:be,run:({profileId:i})=>M(n.profile(i))}),e.commands.register({id:"profile-create",label:"Create backup profile",labelKey:"backup.surface.profile-create",paletteSafe:!1,sideEffect:"write",input:{schema:{type:"object",properties:Ge,required:["name"],additionalProperties:!1},parse:i=>{let c=qe(i);if(typeof c.name!="string")throw new Error("name is required");return c}},revision:()=>a.getSnapshot().map(M),preview:i=>({action:"create-profile",values:i}),run:async i=>{let c=a.getSnapshot(),d=ce({profiles:[{id:Se(),...i}]});return n.replace([...c,...d],c)}}),e.commands.register({id:"profile-update",label:"Update backup profile",labelKey:"backup.surface.profile-update",paletteSafe:!1,sideEffect:"write",input:{schema:{type:"object",properties:{profileId:{type:"string"},values:{type:"object",properties:Ge,additionalProperties:!1}},required:["profileId","values"],additionalProperties:!1},parse:i=>{let c=He(i);if(!c.profileId)throw new Error("profileId is required");return{profileId:c.profileId,values:qe(ge(i).values)}}},revision:i=>t(i),preview:i=>i,run:({profileId:i,values:c})=>n.update(i,c)}),e.commands.register({id:"profile-delete",label:"Delete backup profile",labelKey:"backup.surface.profile-delete",paletteSafe:!1,sideEffect:"write",input:be,revision:t,preview:({profileId:i})=>({action:"delete-profile",profile:M(n.profile(i))}),run:async({profileId:i})=>{let c=n.profile(i),d=a.getSnapshot();return n.replace(d.filter(A=>A.id!==c.id),d)}}),e.commands.register({id:"check",label:"Check backup profile",labelKey:"backup.surface.check",paletteSafe:!1,sideEffect:"read",input:be,run:async({profileId:i})=>{let c=await e.drivers.backup.check(n.profile(i).id);if(!c.ok||!c.data?.ok)throw new Error(c.error??c.data?.issues.map(d=>d.message).join("; ")??"Backup precheck failed");return c.data}}),e.commands.register({id:"run",label:"Backup now",labelKey:"auto.5d5dba0742de",sideEffect:"write",input:be,revision:t,preview:({profileId:i})=>e.drivers.backup.check(n.profile(i).id),run:async({profileId:i})=>{let c=await n.run(i);if(!c.ok||!c.data?.ok)throw new Error(c.error??c.data?.message??"Backup failed");return{value:c.data,revert:null}}}),e.commands.register({id:"history",label:"Read backup history",labelKey:"backup.surface.history",paletteSafe:!1,sideEffect:"read",input:{schema:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:500},cursor:{type:"string"}}},parse:i=>{let c=ge(i),d=Number(c.limit??50);if(!Number.isInteger(d)||d<1||d>500||c.cursor!==void 0&&typeof c.cursor!="string")throw new Error("Invalid pagination");return{limit:d,cursor:c.cursor}}},run:({limit:i,cursor:c})=>n.history(i,c)}),e.commands.register({id:"prune-preview",label:"Preview backup retention",labelKey:"backup.surface.prune-preview",paletteSafe:!1,sideEffect:"read",input:be,run:h}),e.commands.register({id:"prune",label:"Apply backup retention",labelKey:"backup.surface.prune",paletteSafe:!1,sideEffect:"write",input:be,revision:async i=>({profile:t(i),plan:await h(i)}),preview:h,run:async({profileId:i})=>{let c=await e.drivers.backup.prune({profileId:n.profile(i).id,dryRun:!1});if(!c.ok||c.data?.errors.length)throw new Error(c.error??`Retention did not finish. ${c.data?.dropped.length??0} archives were removed; inspect history before retrying.`);return{value:c.data,revert:null}}}),e.commands.register({id:"restore-preview",label:"Preview backup restore",labelKey:"backup.surface.restore-preview",paletteSafe:!1,sideEffect:"read",input:v,run:S}),e.commands.register({id:"restore",label:"Restore backup mapping",labelKey:"backup.surface.restore",paletteSafe:!1,sideEffect:"write",input:v,revision:async i=>({profile:t(i),plan:await S(i)}),preview:S,run:async({profileId:i,mappingIndex:c})=>{let d=await e.drivers.backup.restoreApply(c,i);if(!d.ok||!d.data?.ok)throw new Error(d.error??d.data?.message??"Restore failed");return{value:d.data,revert:null}}})];return()=>{for(let i of C)i();n.dispose()}}var ht=800,kt=50;function yt(e,a){let n=Math.max(0,Math.round(e)),t=(h,S)=>new Intl.NumberFormat(a,{style:"unit",unit:S,unitDisplay:"short"}).format(h);return n<60?t(n,"second"):new Intl.ListFormat(a,{style:"narrow",type:"unit"}).format([t(Math.floor(n/60),"minute"),t(n%60,"second")])}function Ra(e,a){let n=new Date(e);return a.replace("yyyy",String(n.getFullYear())).replace(/m{2}/i,String(n.getMonth()+1).padStart(2,"0")).replace("dd",String(n.getDate()).padStart(2,"0"))}function Ea(e,a,n){let t=Date.parse(e);if(Number.isNaN(t))return"";let h=new Intl.RelativeTimeFormat(a,{numeric:"auto"}),S=Math.round((Date.now()-t)/1e3);if(S<45)return h.format(0,"second");let v=Math.round(S/60);if(v<60)return h.format(-v,"minute");let C=Math.round(v/60);if(C<24)return h.format(-C,"hour");let i=Math.round(C/24);return i<7?h.format(-i,"day"):n?Ra(t,n):new Date(t).toLocaleDateString(a)}var We=e=>{let a=Number(e);return Number.isFinite(a)?a:0};function Na(e){pt(e);let a=ft(),n=e.React,t=n.createElement,h=bt(e),S=gt(e,h),v={profileId:z(e.settings.get().activeProfileId),tab:"status"},C=new Set,i=()=>{for(let l of C)l()},c=l=>(C.add(l),()=>{C.delete(l)}),d=l=>{let N={...v,...l};N.profileId===v.profileId&&N.tab===v.tab||(v=N,i())},A=h.subscribe(i),x=(l,N)=>t("svg",{width:"1em",height:"1em",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":!0,style:{flex:"none",...N}},...l),D=x([t("path",{d:"M20 6 9 17l-5-5"})]),W=x([t("path",{d:"M18 6 6 18M6 6l12 12"})]),K=x([t("circle",{cx:12,cy:12,r:10}),t("path",{d:"m4.9 4.9 14.2 14.2"})]),T=x([t("path",{d:"M21 12a9 9 0 1 1-6.219-8.56"})],{animation:"notes-backup-spin 0.8s linear infinite"}),ae=x([t("path",{d:"m6 9 6 6 6-6"})]),De=x([t("path",{d:"m15 18-6-6 6-6"})]),vt=x([t("path",{d:"m9 18 6-6-6-6"})]),wt=x([t("path",{d:"M12 5v14M5 12h14"})]),Le=x([t("path",{d:"M22 12H2"}),t("path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}),t("path",{d:"M6 16h.01M10 16h.01"})]),xt=x([t("path",{d:"M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"})]),St=x([t("path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}),t("path",{d:"M3 3v5h5"}),t("path",{d:"M12 7v5l4 2"})]),At=x([t("rect",{width:20,height:5,x:2,y:3,rx:1}),t("path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"}),t("path",{d:"M10 12h4"})]),It=x([t("path",{d:"M20 7h-9M14 17H5"}),t("circle",{cx:17,cy:17,r:3}),t("circle",{cx:7,cy:7,r:3})]),Rt=x([t("path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}),t("path",{d:"M12 9v4M12 17h.01"})]),Et={running:T,done:D,skipped:K,failed:W},Nt=()=>{let[l,N]=n.useState("idle"),[ue,Z]=n.useState(""),[X,me]=n.useState([]),[_,V]=n.useState(null),[Y,he]=n.useState([]),[Q,ee]=n.useState([]),[re,oe]=n.useState([]),Ae=n.useSyncExternalStore(c,()=>v),j=Ae.profileId,ke=r=>d({profileId:typeof r=="function"?r(v.profileId):r}),[de,$e]=n.useState([]),H=Ae.tab,ye=r=>d({tab:r}),[ve,Oe]=n.useState(null),[ze,we]=n.useState(()=>e.getState().dateFormat);n.useEffect(()=>e.subscribe(()=>we(e.getState().dateFormat)),[]);let[,Be]=n.useState(0),xe=n.useRef(0),s=n.useRef(0),p=n.useRef(null),f=r=>re.find(u=>u.id===r)?.name??"Backup",k=n.useCallback(()=>{let r=e.settings.get(),u=ce(r).map(y=>({id:y.id,name:y.name}));oe(u);let m=z(r.activeProfileId).trim();return ke(y=>y&&u.some(I=>I.id===y)?y:m&&u.some(I=>I.id===m)?m:u[0]?.id??""),u},[]),R=n.useCallback(()=>{e.data.dataset("backup_runs").query({orderBy:[{field:"startedAt",direction:"desc"}],limit:kt}).then(({rows:r})=>{let u=r.map(m=>({id:z(m.id),startedAt:z(m.startedAt),profileName:z(m.profileName)||"Backup",durationSec:We(m.durationSec),archived:We(m.archived),errors:We(m.errors),ok:m.ok===!0||m.ok==="true",reason:m.reason?z(m.reason):void 0}));u.sort((m,y)=>Date.parse(y.startedAt)-Date.parse(m.startedAt)),$e(u.slice(0,kt))})},[]);n.useEffect(()=>{k(),R();let r=()=>{k()};return e.settings.subscribe(r)},[k,R]),n.useEffect(()=>e.drivers.backup.onProgress(u=>{if(u.update){V(u.update);return}if(u.mapping){let y=u.mapping;he(I=>{let te=I.filter(J=>J.index!==y.index);return te.push(y),te.sort((J,na)=>J.index-na.index),te});return}if(u.line===void 0)return;let m=u.line;me(y=>{let I=y.concat(m);return I.length>ht?I.slice(I.length-ht):I})}),[]),n.useEffect(()=>{let r=p.current;r&&(r.scrollTop=r.scrollHeight)},[X,H]),n.useEffect(()=>{if(l!=="running")return;let r=setInterval(()=>Be(u=>u+1),1e3);return()=>clearInterval(r)},[l]);let L=r=>{ke(r),e.settings.set("activeProfileId",r),ee([])},G=()=>e.workspace.openOwnSettings(),le=r=>{let u=k();if(!u.length){G();return}let m=u.map(y=>({id:y.id,type:"radio",checked:y.id===j,label:y.name,onSelect:()=>L(y.id)}));m.push({type:"separator"},{id:"manage",label:o("auto.a94ac9e3ecd0"),onSelect:G}),e.ui.openMenu(m,{anchor:r,align:"end"})},Ie=async()=>{if(l==="running")return;ee([]);let r=await e.drivers.backup.check(j||void 0);if(!r.ok||!r.data||!r.data.ok){ee(r.data?.issues??[{kind:"dest-error",message:o("auto.e97ecd4af356")}]),N("failed"),Z("");return}me([]),Z(""),V(null),he([]);let u=f(j),m=de.find(J=>J.ok&&J.profileName===u)??de.find(J=>J.ok);Oe(m?m.durationSec:null),xe.current=Date.now(),s.current=0,N("running");let y=await S.run(j||void 0,!0),I=y.data;if(V(null),!y.ok||!I){N("failed"),Z(o("auto.beb2ea0a45a6"));return}I.issues&&I.issues.length&&ee(I.issues);let te=I.ok;N(te?"done":"failed"),Z(te?o("auto.1d164664f6ed",{p0:I.archived,p1:I.durationSec}):o("auto.a6df420d2c59",{p0:I.failedItems||I.errors})),R()},[U,F]=n.useState({kind:"idle"}),Ke=(()=>{let u=(e.settings.get().profiles??[]).find(y=>z(y.id)===j);return(Array.isArray(u?.mappings)?u?.mappings:[]).map(y=>({source:z(y.source).trim(),destination:z(y.destination).trim()})).filter(y=>y.source&&y.destination)})(),Ct=async()=>{F({kind:"busy",label:o("auto.b2b841a7fc71")});let r=await e.drivers.backup.prune({profileId:j||void 0,dryRun:!0});if(!r.ok||!r.data){F({kind:"note",text:o("auto.2700ef39cb59")});return}if(r.data.dropped.length===0){F({kind:"note",text:o("auto.cc54e62c3e08",{p0:r.data.kept})});return}F({kind:"prune-counted",drop:r.data.dropped.length,kept:r.data.kept})},Dt=async()=>{F({kind:"busy",label:o("auto.f7b023b83c72")});let r=await e.drivers.backup.prune({profileId:j||void 0});F({kind:"note",text:r.ok&&r.data?o("auto.0c2cf66ed63c",{p0:r.data.dropped.length,p1:r.data.kept})+(r.data.errors.length?o("auto.0943b157227c",{p0:r.data.errors.length}):""):o("auto.2700ef39cb59")})},Lt=async r=>{F({kind:"busy",label:o("auto.1c36bd34ec77")});let u=await e.drivers.backup.restorePlan(r,j||void 0);if(!u.ok||!u.data?.ok){F({kind:"note",text:o("auto.d7f2768ca570")});return}F({kind:"restore-plan",mappingIndex:r,creates:u.data.creates.length,updates:u.data.updates.length,deletes:u.data.deletes.length})},$t=async r=>{F({kind:"busy",label:o("auto.df34924ef17e")});let u=await e.drivers.backup.restoreApply(r,j||void 0);F({kind:"note",text:u.ok&&u.data?.ok?o("auto.dfdc3dc9aa44",{p0:u.data.creates.length+u.data.updates.length}):o("auto.c848a612ec9b")})},Ze=_?Math.min(100,Math.round((_.mappingIndex-1+(_.phase==="scanning"?0:_.percent/100))/Math.max(1,_.mappingCount)*100)):0,ne=l==="running"?Math.max(s.current,Ze):Ze;l==="running"&&(s.current=ne);let Je=l==="running"&&xe.current?(Date.now()-xe.current)/1e3:0,Xe=ne>3?Je*(100/ne):ve,Ye=Xe!=null?Math.max(0,Xe-Je):_?.etaSeconds??null,Ot=ne<=3?ve!=null?o("auto.82a68202d381",{p0:yt(ve,e.ui.language())}):o("auto.e8642ee5ad7e"):Ye!=null?o("auto.dba2fb67adfe",{p0:yt(Ye,e.ui.language())}):"",zt=l==="failed"?" is-failed":l==="done"?" is-done":"",Qe=l==="running"?_?_.phase==="scanning"?o("auto.414f279b51ef",{p0:_.folder}):o("auto.f73992337e2d",{p0:_.folder}):o("auto.e5f58095ac29"):l==="done"?ue:l==="failed"?ue||o("auto.09fef5d8d9a3"):o("auto.cc1ebdd04e76"),q=(r,u,m={})=>t("button",{className:"backup-btn"+(m.variant?` backup-btn--${m.variant}`:"")+(m.wide?" backup-btn--wide":""),disabled:m.disabled,onClick:u},r),Re=(r,u)=>t("div",{className:"backup-section"},t("span",{className:"backup-section-title"},r),u??null),Ee=(r,u)=>t("div",{className:"backup-empty"},t("span",null,r),u??null),Me=(r,u,m,y,I,te,J)=>t("div",{key:r,className:"backup-row"},u?t("span",{className:`backup-row-icon${m}`},u):null,t("div",{className:"backup-row-main"},t("span",{className:"backup-row-label",title:y},y),I?t("span",{className:"backup-row-sub"},I):null),te?t("span",{className:"backup-row-meta"},te):null,J??null),Bt=r=>r.replace(/\/$/,"").split("/").pop()??r,Mt=re.length?f(j):o("auto.101101ea16da"),jt=t("div",{className:"panel-header"},t("div",{className:"panel-header-label"},t("span",{className:"panel-title"},o("auto.dd96994d01e7"))),t("button",{className:"backup-profile",disabled:l==="running",title:o("auto.9952bdb5d01a"),"aria-label":o("auto.9952bdb5d01a"),onClick:r=>le(r.currentTarget)},t("span",{className:"backup-profile-name"},Mt),ae)),Vt=[{id:"status",icon:l==="running"?T:Le,label:o("auto.bae7d5be7082")},{id:"details",icon:xt,label:o("auto.7e3112f57746")},{id:"recent",icon:St,label:o("auto.a584451ceaf9")},{id:"archives",icon:At,label:o("auto.a50710e773e1")}],et=o("auto.432e860f10ff"),Ut=t("div",{className:"backup-tabs",role:"tablist"},...Vt.map(r=>t("button",{key:r.id,className:`backup-tab${H===r.id?" active":""}`,role:"tab","aria-selected":H===r.id,title:r.label,"aria-label":r.label,onClick:()=>ye(r.id)},r.icon)),t("button",{className:"backup-tab backup-tab--end",title:et,"aria-label":et,onClick:G},It)),Ft=l==="running"&&H!=="status"?t("div",{className:"backup-runline"},t("i",{style:{width:`${ne}%`}})):null,tt=Q.filter((r,u)=>Q.findIndex(m=>m.message===r.message)===u),Ht=tt.length?t("div",{className:"backup-alert"},t("span",{className:"backup-alert-title"},Rt,o("auto.cc687f43b582",{p0:f(j)})),...tt.map((r,u)=>t("span",{key:String(u),className:"backup-alert-msg"},r.message)),t("div",{className:"backup-alert-actions"},q(o("auto.432e860f10ff"),G),q(o("auto.9f5cd8a2e880"),()=>{Ie()}))):null,Gt=t("button",{className:"backup-run",disabled:l==="running"||!re.length,onClick:()=>{Ie()}},l==="running"?T:null,l==="running"?o("auto.f6005584e229"):o("auto.5d5dba0742de")),qt=l==="running"?t("div",{className:"backup-progress"},t("div",{className:"backup-track"},t("i",{style:{width:`${ne}%`}})),t("div",{className:"backup-progress-meta"},t("span",null,`${ne}%`),t("span",null,Ot))):null,Wt=t("div",{className:`backup-status${zt}`},l==="done"?D:l==="failed"?W:null,t("span",{title:Qe},Qe)),Kt=o("auto.19adc47be34b"),Zt=Y.length?[Re(Kt),t("div",{className:"backup-rows"},...Y.map(r=>{let u=l==="running"&&_&&_.mappingIndex===r.index,m=r.status==="failed"||r.status==="skipped"?" is-bad":r.status==="done"?" is-ok":"",y=r.status==="done"?o("auto.d7fd3fcb4bb5",{p0:r.archived??0}):r.status==="running"?u&&_&&_.phase!=="scanning"?`${_.percent}%`:o("auto.a95e286913bf"):r.archived?o("auto.d7fd3fcb4bb5",{p0:r.archived}):"",I=r.status==="failed"||r.status==="skipped"?r.message??null:null;return Me(String(r.index),Et[r.status],m,r.folder,I,y)}))]:[],Jt=o("auto.82f841dac7be"),Xt=o("auto.bfc7470c583a"),Yt=re.length?[Ht,Gt,qt,Wt,...Zt]:[Ee(Jt,q(Xt,G))],Qt=o("auto.7e3112f57746"),ea=[Re(Qt),X.length?t("pre",{ref:p,className:"backup-log"},X.join(`
`)):Ee(o("auto.787035ed6c6d"))],ta=o("auto.f7aa648b33ac"),aa=[Re(o("auto.a584451ceaf9")),de.length?t("div",{className:"backup-rows"},...de.map(r=>{let u=r.ok?o("auto.7fd373bab038",{p0:r.durationSec,p1:r.archived}):r.errors?o("auto.8b35536332aa",{p0:r.errors}):r.reason||o("auto.09fef5d8d9a3");return Me(r.id,r.ok?D:W,r.ok?" is-ok":" is-bad",r.profileName,u,Ea(r.startedAt,e.ui.language(),ze))})):Ee(ta)],at=U.kind==="busy"||l==="running",ra=o("auto.5f88ae056e7b"),oa=[Re(o("auto.a50710e773e1"),q(o("auto.197e112d07bd"),()=>{Ct()},{variant:"quiet",disabled:at})),t("span",{className:"backup-note"},o("auto.62f3dd5a9d1f")),Ke.length?t("div",{className:"backup-rows"},...Ke.map((r,u)=>Me(`${r.source}\u2192${r.destination}`,null,"",Bt(r.source),null,null,t("div",{className:"backup-row-actions"},q(o("auto.90c0c2eb98de"),()=>{e.drivers.backup.reveal(r.destination,j||void 0)}),q(o("auto.54a694543dfe"),()=>{Lt(u)},{disabled:at}))))):Ee(ra,q(o("auto.112053b66c92"),G)),U.kind==="busy"?t("span",{className:"backup-note"},U.label):null,U.kind==="note"?t("span",{className:"backup-note"},U.text):null,U.kind==="prune-counted"?t("div",{className:"backup-card"},t("span",{className:"backup-card-text"},o("auto.8911ca48fa04",{p0:U.drop,p1:U.kept})),t("div",{className:"backup-card-actions"},q(o("auto.e963907dac5c"),()=>{Dt()},{variant:"accent",wide:!0}),q(o("auto.77dfd2135f4d"),()=>F({kind:"idle"}),{variant:"quiet"}))):null,U.kind==="restore-plan"?t("div",{className:"backup-card"},t("span",{className:"backup-card-text"},o("auto.a0498c8d2c44",{p0:U.creates,p1:U.updates,p2:U.deletes})),t("div",{className:"backup-card-actions"},q(o("auto.6f6c3dd91f16"),()=>{$t(U.mappingIndex)},{variant:"accent",wide:!0}),q(o("auto.77dfd2135f4d"),()=>F({kind:"idle"}),{variant:"quiet"}))):null];return t("div",{className:"panel backup-panel"},jt,Ut,Ft,t("div",{className:`panel-body backup-body${H==="details"?" backup-body--fill":""}`,role:"tabpanel"},...H==="details"?ea:H==="recent"?aa:H==="archives"?oa:Yt))},Pt=({profileId:l}={})=>{let{Button:N,ChipsField:ue,OsFolderField:Z,Row:X,Section:me,TextField:_}=e.ui.settings,V=n.useSyncExternalStore(h.subscribe,h.getSnapshot),Y=h.setDraft,[he,Q]=n.useState(l?{kind:"profile",id:l}:{kind:"list"});n.useEffect(()=>{l&&Q({kind:"profile",id:l})},[l]);let ee=s=>{h.save(s).catch(()=>e.ui.confirm({title:o("auto.432e860f10ff"),message:o("backup.properties.saveError"),actions:[{label:o("auto.77dfd2135f4d"),value:"close"}]}))},re=(s,p)=>{Y(f=>f.map((k,R)=>R===s?{...k,...p}:k))},oe=(s,p)=>{Y(f=>{let k=f.map((R,L)=>L===s?{...R,...p}:R);return ee(k),k})},Ae=()=>{let s={id:Se(),name:`Profile ${V.length+1}`,rows:[],trashPath:"",logDirectory:"",masterLog:""},p=V.concat(s);Y(p),ee(p),Q({kind:"profile",id:s.id})},j=s=>{Y(p=>{let f=p.filter((k,R)=>R!==s);return ee(f),f})},ke=async s=>await e.ui.confirm({title:o("auto.ff61c7ba16aa"),message:t("span",null,o("auto.1bd661da498a",{p0:s})),actions:[{label:o("auto.77dfd2135f4d"),value:"cancel",variant:"ghost"},{label:o("auto.e963907dac5c"),value:"remove",variant:"danger"}]})==="remove",de=async s=>await ke(V[s].name.trim()||o("auto.4fe8252005e3",{p0:s+1}))?(j(s),!0):!1,$e=async(s,p)=>{let f=V[s].rows[p];await ke(f.source.trim()||o("auto.4fe8252005e3",{p0:p+1}))&&Oe(s,p)},H=(s,p,f)=>{Y(k=>k.map((R,L)=>L===s?{...R,rows:R.rows.map((G,le)=>le===p?{...G,...f}:G)}:R))},ye=(s,p,f)=>{Y(k=>{let R=k.map((L,G)=>G===s?{...L,rows:L.rows.map((le,Ie)=>Ie===p?{...le,...f}:le)}:L);return ee(R),R})},ve=s=>{oe(s,{rows:V[s].rows.concat({source:"",destination:"",excludeText:""})})},Oe=(s,p)=>{oe(s,{rows:V[s].rows.filter((f,k)=>k!==p)})},ze=(s,p,f)=>t("div",{key:String(f),className:"backup-settings-folder","data-mapping-index":f},t("div",{className:"backup-settings-card-head"},t("span",{className:"settings-toggle-title"},o("auto.4fe8252005e3",{p0:f+1})),t(N,{variant:"danger",size:"small",onClick:()=>{$e(s,f)},"aria-label":`${o("auto.e963907dac5c")} ${f+1}`},o("auto.e963907dac5c"))),t(X,{title:o("auto.6da13addb000")},t(Z,{value:p.source,onChange:k=>H(s,f,{source:k}),onCommit:k=>ye(s,f,{source:k}),placeholder:o("auto.0894fe6b352a"),ariaLabel:`${o("auto.6da13addb000")} ${f+1}`,className:"settings-path-input backup-settings-field",required:!0,browse:!0})),t(X,{title:o("auto.d42713493ca8")},t(Z,{value:p.destination,onChange:k=>H(s,f,{destination:k}),onCommit:k=>ye(s,f,{destination:k}),placeholder:o("auto.695e28140cb3"),ariaLabel:`${o("auto.d42713493ca8")} ${f+1}`,className:"settings-path-input backup-settings-field",required:!0,browse:!0})),t(X,{title:o("auto.f4c16b17ee40")},t(ue,{items:p.excludeText.split(",").map(k=>k.trim()).filter(Boolean),onChange:k=>ye(s,f,{excludeText:k.join(", ")}),ariaLabel:`${o("auto.f4c16b17ee40")} ${f+1}`,placeholder:"cache/, *.tmp",className:"backup-settings-field"}))),we=(s,p,f,k,R)=>t(X,{title:p,description:f},R==="masterLog"?t(_,{value:k,onChange:L=>re(s,{[R]:L}),onCommit:L=>oe(s,{[R]:L}),ariaLabel:p,className:"settings-path-input backup-settings-field"}):t(Z,{value:k,onChange:L=>re(s,{[R]:L}),onCommit:L=>oe(s,{[R]:L}),ariaLabel:p,className:"settings-path-input backup-settings-field",browse:!0})),Be=(s,p)=>t(me,{className:"backup-settings-detail"},t("div",{className:"settings-listpage-crumbs"},t("button",{type:"button",className:"settings-listpage-back","aria-label":o("auto.432e860f10ff"),title:o("auto.432e860f10ff"),onClick:()=>Q({kind:"list"})},De),t("span",{className:"settings-crumb settings-crumb-current"},s.name)),t("div",{className:"backup-settings-identity"},t("span",{className:"backup-settings-glyph backup-settings-glyph--large"},Le),t("span",{className:"settings-list-meta"},t("span",{className:"settings-list-name"},s.name),t("span",{className:"settings-list-sub"},`${s.rows.length} ${o("auto.19adc47be34b")}`))),t(X,{title:o("auto.77574766df8d"),className:"backup-settings-profile-name"},t(_,{value:s.name,onChange:f=>re(p,{name:f}),onCommit:f=>oe(p,{name:f}),placeholder:o("auto.1df120c8de5c"),ariaLabel:`${o("auto.77574766df8d")} ${p+1}`,className:"settings-path-input backup-settings-field"})),...s.rows.map((f,k)=>ze(p,f,k)),t(N,{variant:"secondary",size:"small",className:"backup-settings-add",onClick:()=>ve(p),"aria-label":`${o("auto.c0d31d3b9d31")} ${p+1}`},o("auto.c0d31d3b9d31")),we(p,o("auto.819ad5a4465c"),o("auto.adeeae4a8510"),s.trashPath,"trashPath"),we(p,o("auto.11e10c8f488b"),o("auto.6f902038d03f"),s.logDirectory,"logDirectory"),we(p,o("auto.3ad30e772903"),o("auto.f9dcc3004855"),s.masterLog,"masterLog"),t("div",{className:"backup-settings-remove"},t(N,{variant:"danger",size:"small",onClick:async()=>{await de(p)&&Q({kind:"list"})},"aria-label":`${o("auto.362a1984d15b")} ${p+1}`},o("auto.362a1984d15b")))),xe=()=>t(me,{className:"backup-settings-list settings-listpage"},t("div",{className:"settings-listpage-header"},t("h4",{className:"settings-label"},o("auto.dd96994d01e7")),t(N,{className:"settings-listpage-add",size:"small","aria-label":o("auto.ef04290fc628"),title:o("auto.ef04290fc628"),onClick:Ae},wt)),t("div",{className:"settings-list"},...V.map(s=>{let p=s.rows.length>0&&s.rows.every(f=>f.source.trim()&&f.destination.trim());return t("div",{key:s.id,className:"settings-list-row",role:"button",tabIndex:0,"data-profile-id":s.id,onClick:()=>Q({kind:"profile",id:s.id}),onKeyDown:f=>{f.key!=="Enter"&&f.key!==" "||(f.preventDefault(),Q({kind:"profile",id:s.id}))}},t("span",{className:"backup-settings-glyph"},Le),t("span",{className:"settings-list-meta"},t("span",{className:"settings-list-name"},s.name),t("span",{className:"settings-list-sub"},`${s.rows.length} ${o("auto.19adc47be34b")}`)),t("span",{className:`backup-settings-badge ${p?"is-configured":"needs-setup"}`},t("span",{className:"backup-settings-dot"}),p?o("auto.668c5fffd24d"):o("auto.bfc7470c583a")),t("span",{className:"settings-list-chevron"},vt))})));if(he.kind==="profile"){let s=V.findIndex(p=>p.id===he.id);if(s>=0)return Be(V[s],s)}return xe()};e.registerView("backup.panel",Nt),e.registerView("backup.settings",Pt);let Tt=mt(e,h,S),_t=e.interop.extensions.provide(ct,{id:"backup.panel",surface:"left_sidebar",subscribe:c,getSnapshot:()=>{let l=h.getSnapshot().find(N=>N.id===v.profileId);return{title:"Backup",view:{...v},...l?{item:{id:l.id,title:l.name,state:{...v}}}:{}}},restore:l=>{let N=typeof l.profileId=="string"?l.profileId:"";if(N&&!h.getSnapshot().some(Z=>Z.id===N))throw new Error("Backup profile is unavailable");let ue=["status","details","recent","archives"].includes(String(l.tab))?l.tab:"status";d({profileId:N,tab:ue})}});return()=>{Tt(),_t(),A(),C.clear(),h.dispose(),a()}}var Pa={register:Na},io=Pa;export{io as default,Na as register};
