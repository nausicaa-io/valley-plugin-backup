var Pe="valley";var La=`.${Pe}`,$a=`app.${Pe}`;var M=`.${Pe}`,sa="plugins",Ce=`${M}/${sa}`,ca="external",za=`${Ce}/${ca}`,Ba=`${Ce}/data`;var ja=`${Ce}/plugin.json`,Va=`${Ce}/config.json`,nt=`${M}/state`,pe=`${M}/settings`,_e=`${M}/app`,De=`${M}/accounts`,Fa=`${De}/providers`,Ua=`${De}/providers.lock.json`,Ha=`${M}/trash`,ie=`${M}/assistant`,Ga=`${ie}/providers`,qa=`${ie}/providers.lock.json`,Wa=`${ie}/harness`,Ka=`${ie}/harness-settings.json`,Za=`${ie}/harness-runs`,Le=`${M}/cache`,Ja=`${Le}/accounts`,ua=`${Le}/assistant`,Xa=`${ua}/harness`,da=`${Le}/search`,Ya=`${Le}/providers`;var Qa=`${_e}/logs`,er=`${_e}/whats-new`,tr=`${_e}/setup.json`,ar=`${da}/index.jsonl`,rr=`${nt}/journal`,or=`${nt}/txjournal`;var Te="design";var nr={app:`${_e}/app.json`,appearance:`${M}/${Te}/appearance.json`,pallette:`${M}/${Te}/pallette.json`,group:`${M}/${Te}/group.json`,metadata:`${pe}/metadata.json`,notification:`${pe}/notification.json`,preferences:`${pe}/preferences.json`,markdown:`${pe}/markdown.json`,files:`${pe}/files.json`,search:`${pe}/search.json`,design:`${M}/${Te}/appearance.json`,accounts:`${De}/accounts.json`,provider:`${ie}/assistant.json`},ir=`${De}/secrets.json`,sr=`${ie}/provider-secrets.json`;var dr=[`${M}/assistant`,`${M}/assistant/secrets.json`,`${M}/**/secrets.json`,".git","node_modules","**/.env","**/.env.*"];function P(e,a,n,t,h,v,w,_,s="owner"){return Object.freeze({id:e,kind:a,version:n,cardinality:t,validate:h,identities:v,identityScope:s,serviceCalls:w,serviceMetadata:_})}var g=e=>!!e&&typeof e=="object"&&!Array.isArray(e),E=(e,a)=>typeof e[a]=="function",se=e=>e===void 0,fe=e=>typeof e=="boolean",b=e=>typeof e=="string",B=e=>e===void 0||b(e),pa=e=>e===void 0||typeof e=="number",fa=e=>e===void 0||typeof e=="boolean",S=(e,a)=>e.length===a.length&&a.every((n,t)=>n(e[t])),L=e=>g(e)&&typeof e.ok=="boolean"&&(e.error===void 0||typeof e.error=="string"),it=e=>g(e),ba=e=>g(e)&&b(e.id)&&b(e.title)&&b(e.date)&&(e.documentRef===void 0||g(e.documentRef)&&b(e.documentRef.pluginId)&&b(e.documentRef.sourceId)&&b(e.documentRef.itemId)),ga=e=>g(e)&&b(e.date)&&B(e.startTime)&&B(e.endTime)&&B(e.sourceId)&&B(e.itemId),ma=e=>g(e)&&b(e.url)&&B(e.title)&&fa(e.newTab),ha=e=>g(e)&&b(e.query),ct=e=>g(e)&&b(e.name)&&B(e.context)&&Number.isFinite(e.lng)&&Number.isFinite(e.lat),ka=e=>Array.isArray(e)&&e.every(ct),ya=e=>e===null||ct(e),va=e=>e===void 0||g(e)&&B(e.approvalToken)&&(e.cancellation===void 0||g(e.cancellation)),wa=e=>typeof e=="string"||g(e)&&typeof e.text=="string",xa=e=>g(e)&&typeof e.name=="string"&&e.name.trim().length>0&&typeof e.description=="string"&&g(e.parameters)&&(e.sideEffect==="read"||e.sideEffect==="write")&&B(e.commandId)&&(e.commandDispatch===void 0||e.commandDispatch==="dynamic")&&(e.timeoutMs===void 0||Number.isSafeInteger(e.timeoutMs)&&Number(e.timeoutMs)>0&&Number(e.timeoutMs)<=3e5),ut=e=>g(e)&&b(e.id)&&b(e.label)&&B(e.labelKey)&&B(e.description)&&(e.danger===void 0||typeof e.danger=="boolean")&&(e.enabled===void 0||typeof e.enabled=="boolean")&&(e.submenu===void 0||Array.isArray(e.submenu)&&e.submenu.every(ut)),Sa={list:{args:e=>e.length===0,result:e=>Array.isArray(e)&&e.every(ba)},create:{args:e=>S(e,[b,it]),result:fe},update:{args:e=>S(e,[b,it]),result:fe},remove:{args:e=>S(e,[b]),result:fe},open:{args:e=>S(e,[b]),result:se},configure:{args:e=>e.length===0,result:se},actions:{args:e=>S(e,[b]),result:e=>Array.isArray(e)&&e.every(ut)},runAction:{args:e=>S(e,[b,b]),result:fe}},Aa=e=>g(e)&&b(e.name)&&b(e.version)&&B(e.description)&&B(e.author)&&(e.localized===void 0||g(e.localized)&&Object.values(e.localized).every(a=>g(a)&&b(a.name)&&B(a.description))),Ar=P("calendar.itemSource","service","1.3.0","many",e=>g(e)&&E(e,"list")&&(e.integration===void 0||Aa(e.integration)),void 0,Sa,e=>e.integration),Rr=P("calendar.itemSourceRevision","state","1.0.0","many",e=>typeof e=="number"&&Number.isSafeInteger(e)&&e>=0),Ir=P("calendar.navigator","service","1.0.0","one",e=>g(e)&&E(e,"openDate"),void 0,{openDate:{args:e=>S(e,[ga]),result:se}}),Er=P("calendar.panelSelection","state","1.0.0","one",e=>g(e)&&(e.selectedDate===null||typeof e.selectedDate=="string")&&(e.rangeStart===null||typeof e.rangeStart=="string")&&(e.rangeEnd===null||typeof e.rangeEnd=="string")),Nr=P("web.activeContext","state","1.0.0","one",e=>g(e)&&typeof e.instanceId=="string"&&typeof e.url=="string"&&typeof e.title=="string");function st(e){return g(e)&&typeof e.id=="string"&&typeof e.displayName=="string"&&(e.avatarUrl===void 0||typeof e.avatarUrl=="string")&&Array.isArray(e.emails)&&e.emails.every(a=>g(a)&&typeof a.address=="string"&&(a.label===void 0||typeof a.label=="string"))}var Pr=P("contacts.directory","service","1.0.0","one",e=>g(e)&&["search","resolveEmails","open"].every(a=>E(e,a)),void 0,{search:{args:e=>e.length===2&&typeof e[0]=="string"&&e[0].length<=1e3&&Number.isInteger(e[1])&&Number(e[1])>0&&Number(e[1])<=50,result:e=>Array.isArray(e)&&e.length<=50&&e.every(st)},resolveEmails:{args:e=>e.length===1&&Array.isArray(e[0])&&e[0].length<=200&&e[0].every(a=>typeof a=="string"&&a.length<=1e3),result:e=>Array.isArray(e)&&e.every(a=>g(a)&&typeof a.address=="string"&&Array.isArray(a.contacts)&&a.contacts.every(st))},open:{args:e=>e.length>=1&&e.length<=2&&typeof e[0]=="string"&&(e[1]===void 0||g(e[1])&&(e[1].newTab===void 0||typeof e[1].newTab=="boolean")),result:se}}),Tr=P("contacts.directoryRevision","state","1.0.0","one",e=>Number.isSafeInteger(e)&&Number(e)>=0),Cr=P("web.navigator","service","1.0.0","one",e=>g(e)&&E(e,"open"),void 0,{open:{args:e=>S(e,[ma]),result:se}}),_r=P("selection.textAction","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&typeof e.label=="string"&&Array.isArray(e.surfaces)&&E(e,"run"),e=>[e.id]),Dr=P("geo.navigator","service","1.0.0","one",e=>g(e)&&E(e,"open"),void 0,{open:{args:e=>S(e,[ha]),result:se}}),Lr=P("geo.search","service","1.0.0","one",e=>g(e)&&E(e,"search")&&E(e,"reverse"),void 0,{search:{args:e=>S(e,[b]),result:ka},reverse:{args:e=>S(e,[a=>Number.isFinite(a),a=>Number.isFinite(a)]),result:ya}}),$r=P("agent.toolProvider","service","1.0.0","many",e=>g(e)&&Array.isArray(e.tools)&&e.tools.every(xa)&&E(e,"execute"),e=>e.tools.map(a=>a.name),{execute:{args:e=>S(e,[b,g,va]),result:wa}},e=>({tools:e.tools}),"global"),Or=P("guard.runtime","service","1.0.0","one",e=>g(e)&&["resolve","requestApproval","consumeToken","audit"].every(a=>E(e,a)),void 0,{resolve:{args:e=>S(e,[g]),result:g},requestApproval:{args:e=>S(e,[g]),result:fe},consumeToken:{args:e=>e.length>=1&&e.length<=2&&b(e[0])&&B(e[1]),result:fe},audit:{args:e=>S(e,[g]),result:se}}),Mr=P("browser.automation","service","1.0.0","one",e=>g(e)&&["list","open","switch","close","snapshot","readText","readHtml","screenshot","navigate","back","forward","reload","click","type","select","scroll","pressKey"].every(a=>E(e,a)),void 0,{list:{args:e=>e.length===0,result:L},open:{args:e=>S(e,[b]),result:L},switch:{args:e=>S(e,[b]),result:L},close:{args:e=>S(e,[b]),result:L},snapshot:{args:e=>S(e,[b]),result:L},readText:{args:e=>e.length>=1&&e.length<=2&&b(e[0])&&pa(e[1]),result:L},readHtml:{args:e=>S(e,[b]),result:L},screenshot:{args:e=>S(e,[b]),result:L},click:{args:e=>S(e,[b,a=>typeof a=="number"]),result:L},type:{args:e=>e.length>=3&&e.length<=4&&b(e[0])&&typeof e[1]=="number"&&b(e[2])&&(e[3]===void 0||typeof e[3]=="boolean"),result:L},select:{args:e=>S(e,[b,a=>typeof a=="number",b]),result:L},scroll:{args:e=>S(e,[b,a=>typeof a=="number",a=>typeof a=="number"]),result:L},pressKey:{args:e=>S(e,[b,b]),result:L},navigate:{args:e=>S(e,[b,b]),result:L},back:{args:e=>S(e,[b]),result:L},forward:{args:e=>S(e,[b]),result:L},reload:{args:e=>S(e,[b]),result:L}}),zr=P("fileTree.contextItem","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.label=="string"&&B(e.labelKey)&&E(e,"run"),e=>[e.id]),Br=P("newTab.entry","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"run"),e=>[e.id]),jr=P("search.resultCard","extension","1.0.0","many",e=>g(e)&&typeof e.cardKind=="string"&&E(e,"render")&&E(e,"open"),e=>[e.cardKind]),Vr=P("metadataPanel.segment","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"render"),e=>[e.id]),dt=P("workspace.surface","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&["left_sidebar","right_sidebar","main_workspace","footer"].includes(String(e.surface))&&E(e,"getSnapshot")&&E(e,"subscribe")&&E(e,"restore"),e=>[e.id]),Fr=P("metadata.plugin","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&typeof e.labelKey=="string"&&E(e,"facts"),e=>[e.id]),Ur=P("workspace.viewState","extension","1.0.0","many",e=>g(e)&&typeof e.id=="string"&&["left_sidebar","right_sidebar","main_workspace"].includes(String(e.surface))&&E(e,"capture")&&E(e,"restore")&&E(e,"subscribe"),e=>[e.id]);var Fe={en:{"auto.0894fe6b352a":"e.g. the folder you want backed up","auto.0943b157227c":"\u2014 {{p0}} failure(s)","auto.09fef5d8d9a3":"Failed","auto.0c2cf66ed63c":"Removed {{p0}} old archive(s), kept {{p1}}","auto.101101ea16da":"Set up backup\u2026","auto.112053b66c92":"Open Backup settings","auto.11e10c8f488b":"Log folder","auto.197e112d07bd":"Clean up\u2026","auto.19adc47be34b":"Folders","auto.1bd661da498a":"\u201C{{p0}}\u201D will be removed from the backup settings.","auto.1c36bd34ec77":"Computing restore preview\u2026","auto.1d164664f6ed":"Done \u2014 {{p0}} archived in {{p1}}s","auto.1df120c8de5c":"T7 Drive","auto.237d0a57fc14":"Mirror configured folders through Valley's filesystem capability, with live progress and recoverable archives.","auto.2700ef39cb59":"Cleanup failed","auto.362a1984d15b":"Remove profile","auto.3ad30e772903":"Master log file","auto.3ef11aabc275":"Backup runs","auto.414f279b51ef":"Scanning {{p0}}\u2026","auto.432e860f10ff":"Backup settings","auto.4fe8252005e3":"Folder {{p0}}","auto.54a694543dfe":"Restore\u2026","auto.5d5dba0742de":"Backup now","auto.5f88ae056e7b":"This profile has no folders yet.","auto.62f3dd5a9d1f":"Files that changed or were deleted are kept beside each destination under a timestamp.","auto.668c5fffd24d":"Configured","auto.695e28140cb3":"e.g. a folder on your backup drive","auto.6da13addb000":"Source","auto.6f6c3dd91f16":"Apply restore","auto.6f902038d03f":"Folder for run logs (optional).","auto.77574766df8d":"Profile name","auto.77dfd2135f4d":"Cancel","auto.787035ed6c6d":"No output yet.","auto.7e3112f57746":"Live log","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archived","auto.80f1eaf78461":"Each profile's source/destination mappings, trash path and log locations.","auto.819ad5a4465c":"Trash folder","auto.82a68202d381":"Estimated ~{{p0}}","auto.82f841dac7be":"No backup profile yet. Add a folder and a destination on your drive to start mirroring.","auto.8911ca48fa04":"Remove {{p0}} old archive(s), keep {{p1}}?","auto.8b35536332aa":"{{p0}} error(s)","auto.90c0c2eb98de":"Reveal","auto.97bc98400c87":"Id of the profile the panel and the scheduled run use.","auto.9952bdb5d01a":"Backup profile","auto.9f5cd8a2e880":"Retry","auto.a0498c8d2c44":"Restore would add {{p0}}, update {{p1}}, remove {{p2}} file(s) \u2014 removed/overwritten files are escrowed. Apply?","auto.a50710e773e1":"Archives","auto.a584451ceaf9":"Recent backups","auto.a6df420d2c59":"Failed \u2014 {{p0}} error(s)","auto.a94ac9e3ecd0":"Manage profiles\u2026","auto.a95e286913bf":"working\u2026","auto.adeeae4a8510":"Deleted/changed files are archived here under a timestamp before being overwritten.","auto.b2b841a7fc71":"Checking archives\u2026","auto.bae7d5be7082":"Status","auto.beb2ea0a45a6":"Backup could not be started.","auto.bfc7470c583a":"Set up backup","auto.c0d31d3b9d31":"+ Add folder pair","auto.c848a612ec9b":"Restore failed","auto.caa8c9ee85cb":"Backup profiles","auto.cc1ebdd04e76":"Idle","auto.cc54e62c3e08":"Nothing to remove \u2014 {{p0}} archive(s) within retention","auto.cc687f43b582":"Can't back up \u201C{{p0}}\u201D","auto.d42713493ca8":"Destination","auto.d74340399e2a":"Active profile","auto.d7f2768ca570":"Preview failed","auto.d7fd3fcb4bb5":"{{p0}} archived","auto.dba2fb67adfe":"~{{p0}} left","auto.dd96994d01e7":"Backup","auto.df34924ef17e":"Restoring from backup\u2026","auto.dfdc3dc9aa44":"Restored {{p0}} file(s) \u2014 replaced/removed files escrowed beside the archives","auto.e5f58095ac29":"Starting\u2026","auto.e8642ee5ad7e":"Estimating\u2026","auto.e963907dac5c":"Remove","auto.e97ecd4af356":"Backup cannot run right now.","auto.ef04290fc628":"+ Add profile","auto.f4c16b17ee40":"Exclude","auto.f6005584e229":"Backing up\u2026","auto.f73992337e2d":"Backing up {{p0}}","auto.f7aa648b33ac":"No backups yet \u2014 every run you start shows up here.","auto.f7b023b83c72":"Removing old archives\u2026","auto.f9dcc3004855":"A one-line summary is appended here after each run.","auto.ff61c7ba16aa":"Remove?","notifications.group.backup":"Backup","notifications.event.backup.finished":"Backup finished","notifications.event.backup.failed":"Backup failed","plugin.backup.desc":"Mirror configured folders with Valley's native backup engine, with live progress and recoverable archives.","plugin.backup.name":"Backup"},de:{"auto.0894fe6b352a":"z.B. den Ordner, den Sie sichern m\xF6chten","auto.0943b157227c":"\u2014 {{p0}} Fehler(e)","auto.09fef5d8d9a3":"Fehlgeschlagen","auto.0c2cf66ed63c":"{{p0}} alte(s) Archiv(e) entfernt, {{p1}} behalten","auto.101101ea16da":"Backup einrichten\u2026","auto.112053b66c92":"\xD6ffnen Sie die Backup-Einstellungen","auto.11e10c8f488b":"Protokollordner","auto.197e112d07bd":"Aufr\xE4umen\u2026","auto.19adc47be34b":"Ordner","auto.1bd661da498a":"\u201E{{p0}}\u201C wird aus den Sicherungseinstellungen entfernt.","auto.1c36bd34ec77":"Computing-Wiederherstellungsvorschau\u2026","auto.1d164664f6ed":"Fertig \u2013 {{p0}} archiviert in {{p1}}s","auto.1df120c8de5c":"T7-Laufwerk","auto.237d0a57fc14":"Konfigurierte Ordner \xFCber Valleys Dateisystemfunktion spiegeln, mit Live-Fortschritt und wiederherstellbaren Archiven.","auto.2700ef39cb59":"Die Bereinigung ist fehlgeschlagen","auto.362a1984d15b":"Profil entfernen","auto.3ad30e772903":"Master-Logdatei","auto.3ef11aabc275":"Backup l\xE4uft","auto.414f279b51ef":"Scannen von {{p0}}\u2026","auto.432e860f10ff":"Backup-Einstellungen","auto.4fe8252005e3":"Ordner {{p0}}","auto.54a694543dfe":"Wiederherstellen\u2026","auto.5d5dba0742de":"Jetzt sichern","auto.5f88ae056e7b":"Dieses Profil hat noch keine Ordner.","auto.62f3dd5a9d1f":"Ge\xE4nderte oder gel\xF6schte Dateien werden mit einem Zeitstempel neben jedem Ziel gespeichert.","auto.668c5fffd24d":"Konfiguriert","auto.695e28140cb3":"z.B. einen Ordner auf Ihrem Sicherungslaufwerk","auto.6da13addb000":"Quelle","auto.6f6c3dd91f16":"Wenden Sie die Wiederherstellung an","auto.6f902038d03f":"Ordner f\xFCr Laufprotokolle (optional).","auto.77574766df8d":"Profilname","auto.77dfd2135f4d":"Abbrechen","auto.787035ed6c6d":"Noch keine Ausgabe.","auto.7e3112f57746":"Live-Protokoll","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archiviert","auto.80f1eaf78461":"Die Quell-/Zielzuordnungen, der Papierkorbpfad und die Protokollspeicherorte jedes Profils.","auto.819ad5a4465c":"Papierkorbordner","auto.82a68202d381":"Gesch\xE4tzte ~{{p0}}","auto.82f841dac7be":"Noch kein Backup-Profil. F\xFCgen Sie einen Ordner und ein Ziel auf Ihrem Laufwerk hinzu, um mit der Spiegelung zu beginnen.","auto.8911ca48fa04":"{{p0}} alte(s) Archiv(e) entfernen, {{p1}} behalten?","auto.8b35536332aa":"{{p0}} Fehler(e)","auto.90c0c2eb98de":"Aufdeckung","auto.97bc98400c87":"ID des Profils, das das Panel und die geplante Ausf\xFChrung verwenden.","auto.9952bdb5d01a":"Backup-Profil","auto.9f5cd8a2e880":"Wiederholen","auto.a0498c8d2c44":"Die Wiederherstellung w\xFCrde {{p0}} hinzuf\xFCgen, {{p1}} aktualisieren und {{p2}} Datei(en) entfernen \u2013 entfernte/\xFCberschriebene Dateien werden treuh\xE4nderisch verwahrt. Anwenden?","auto.a50710e773e1":"Archiv","auto.a584451ceaf9":"Aktuelle Backups","auto.a6df420d2c59":"Fehlgeschlagen \u2013 {{p0}} Fehler","auto.a94ac9e3ecd0":"Profile verwalten\u2026","auto.a95e286913bf":"l\xE4uft\u2026","auto.adeeae4a8510":"Gel\xF6schte/ge\xE4nderte Dateien werden hier mit einem Zeitstempel archiviert, bevor sie \xFCberschrieben werden.","auto.b2b841a7fc71":"Archive werden \xFCberpr\xFCft\u2026","auto.bae7d5be7082":"Status","auto.beb2ea0a45a6":"Die Sicherung konnte nicht gestartet werden.","auto.bfc7470c583a":"Backup einrichten","auto.c0d31d3b9d31":"+ Ordnerpaar hinzuf\xFCgen","auto.c848a612ec9b":"Wiederherstellung fehlgeschlagen","auto.caa8c9ee85cb":"Backup Profile","auto.cc1ebdd04e76":"Leerlauf","auto.cc54e62c3e08":"Nichts zu entfernen \u2013 {{p0}} Archiv(e) innerhalb der Aufbewahrung","auto.cc687f43b582":"\u201E{{p0}}\u201C kann nicht gesichert werden","auto.d42713493ca8":"Ziel","auto.d74340399e2a":"Aktives Profil","auto.d7f2768ca570":"Vorschau fehlgeschlagen","auto.d7fd3fcb4bb5":"{{p0}} archiviert","auto.dba2fb67adfe":"~{{p0}} \xFCbrig","auto.dd96994d01e7":"Sicherung","auto.df34924ef17e":"Wiederherstellung aus Backup\u2026","auto.dfdc3dc9aa44":"Wiederhergestellte {{p0}} Datei(en) \u2013 ersetzte/entfernte Dateien, die neben den Archiven hinterlegt sind","auto.e5f58095ac29":"Beginnend mit \u2026","auto.e8642ee5ad7e":"Sch\xE4tzung\u2026","auto.e963907dac5c":"Entfernen","auto.e97ecd4af356":"Die Sicherung kann derzeit nicht ausgef\xFChrt werden.","auto.ef04290fc628":"+ Profil hinzuf\xFCgen","auto.f4c16b17ee40":"Ausschlie\xDFen","auto.f6005584e229":"Sichern\u2026","auto.f73992337e2d":"Sichern von {{p0}}","auto.f7aa648b33ac":"Noch keine Backups \u2013 jeder Durchlauf erscheint hier.","auto.f7b023b83c72":"Alte Archive entfernen\u2026","auto.f9dcc3004855":"Nach jedem Lauf wird hier eine einzeilige Zusammenfassung angeh\xE4ngt.","auto.ff61c7ba16aa":"Entfernen?","notifications.group.backup":"Sicherung","notifications.event.backup.finished":"Backup abgeschlossen","notifications.event.backup.failed":"Backup fehlgeschlagen","plugin.backup.desc":"Konfigurierte Ordner mit Valleys nativer Backup-Engine spiegeln, mit Live-Fortschritt und wiederherstellbaren Archiven.","plugin.backup.name":"Sicherung"},es:{"auto.0894fe6b352a":"p.ej. la carpeta de la que desea hacer una copia de seguridad","auto.0943b157227c":"\u2014 {{p0}} fracaso(s)","auto.09fef5d8d9a3":"Fallido","auto.0c2cf66ed63c":"Se eliminaron {{p0}} archivos antiguos y se conservaron {{p1}}","auto.101101ea16da":"Configurar copia de seguridad\u2026","auto.112053b66c92":"Abrir configuraci\xF3n de copia de seguridad","auto.11e10c8f488b":"Carpeta de registro","auto.197e112d07bd":"Limpiar\u2026","auto.19adc47be34b":"Carpetas","auto.1bd661da498a":"\u201C{{p0}}\u201D se eliminar\xE1 de la configuraci\xF3n de copia de seguridad.","auto.1c36bd34ec77":"Vista previa de restauraci\xF3n inform\xE1tica\u2026","auto.1d164664f6ed":"Listo: {{p0}} archivado en {{p1}} s","auto.1df120c8de5c":"Unidad T7","auto.237d0a57fc14":"Replica las carpetas configuradas mediante las funciones de archivos de Valley, con progreso en directo y archivos recuperables.","auto.2700ef39cb59":"Error de limpieza","auto.362a1984d15b":"Eliminar perfil","auto.3ad30e772903":"Archivo de registro maestro","auto.3ef11aabc275":"Backup corre","auto.414f279b51ef":"Escaneando {{p0}}\u2026","auto.432e860f10ff":"Configuraci\xF3n de copia de seguridad","auto.4fe8252005e3":"Carpeta {{p0}}","auto.54a694543dfe":"Restaurar\u2026","auto.5d5dba0742de":"Copia de seguridad ahora","auto.5f88ae056e7b":"Este perfil a\xFAn no tiene carpetas.","auto.62f3dd5a9d1f":"Los archivos que cambiaron o fueron eliminados se guardan al lado de cada destino bajo una marca de tiempo.","auto.668c5fffd24d":"Configurado","auto.695e28140cb3":"p.ej. una carpeta en su unidad de respaldo","auto.6da13addb000":"Fuente","auto.6f6c3dd91f16":"Aplicar restauraci\xF3n","auto.6f902038d03f":"Carpeta para registros de ejecuci\xF3n (opcional).","auto.77574766df8d":"Nombre del perfil","auto.77dfd2135f4d":"Cancelar","auto.787035ed6c6d":"A\xFAn no hay resultados.","auto.7e3112f57746":"Registro en vivo","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archivado","auto.80f1eaf78461":"Las asignaciones de origen/destino, la ruta de la papelera y las ubicaciones de los registros de cada perfil.","auto.819ad5a4465c":"carpeta de basura","auto.82a68202d381":"Estimado ~{{p0}}","auto.82f841dac7be":"A\xFAn no hay perfil de respaldo. Agregue una carpeta y un destino en su disco para comenzar a duplicar.","auto.8911ca48fa04":"\xBFEliminar {{p0}} archivos antiguos y conservar {{p1}}?","auto.8b35536332aa":"{{p0}} errores","auto.90c0c2eb98de":"Revelar","auto.97bc98400c87":"Id. del perfil que utilizan el panel y la ejecuci\xF3n programada.","auto.9952bdb5d01a":"Perfil de respaldo","auto.9f5cd8a2e880":"Reintentar","auto.a0498c8d2c44":"Restaurar agregar\xEDa {{p0}}, actualizar\xEDa {{p1}}, eliminar\xEDa {{p2}} archivo(s); los archivos eliminados/sobrescritos est\xE1n en custodia. \xBFAplicar?","auto.a50710e773e1":"Archivos","auto.a584451ceaf9":"Copias de seguridad recientes","auto.a6df420d2c59":"Error: {{p0}} errores","auto.a94ac9e3ecd0":"Administrar perfiles\u2026","auto.a95e286913bf":"en curso\u2026","auto.adeeae4a8510":"Los archivos eliminados/modificados se archivan aqu\xED con una marca de tiempo antes de sobrescribirse.","auto.b2b841a7fc71":"Comprobando archivos\u2026","auto.bae7d5be7082":"Estado","auto.beb2ea0a45a6":"No se pudo iniciar la copia de seguridad.","auto.bfc7470c583a":"Configurar copia de seguridad","auto.c0d31d3b9d31":"+ Agregar par de carpetas","auto.c848a612ec9b":"Restauraci\xF3n fallida","auto.caa8c9ee85cb":"Backup perfiles","auto.cc1ebdd04e76":"Inactivo","auto.cc54e62c3e08":"No hay nada que eliminar: {{p0}} archivo(s) dentro de la retenci\xF3n","auto.cc687f43b582":'No se puede hacer una copia de seguridad de "{{p0}}"',"auto.d42713493ca8":"Destino","auto.d74340399e2a":"Perfil activo","auto.d7f2768ca570":"Error en la vista previa","auto.d7fd3fcb4bb5":"{{p0}} archivado","auto.dba2fb67adfe":"~{{p0}} izquierda","auto.dd96994d01e7":"Copia de seguridad","auto.df34924ef17e":"Restaurando desde la copia de seguridad\u2026","auto.dfdc3dc9aa44":"Archivo(s) {{p0}} restaurado: archivos reemplazados/eliminados almacenados en custodia junto a los archivos","auto.e5f58095ac29":"A partir de\u2026","auto.e8642ee5ad7e":"Estimando\u2026","auto.e963907dac5c":"Quitar","auto.e97ecd4af356":"La copia de seguridad no se puede ejecutar en este momento.","auto.ef04290fc628":"+ Agregar perfil","auto.f4c16b17ee40":"Excluir","auto.f6005584e229":"Copia de seguridad\u2026","auto.f73992337e2d":"Copia de seguridad {{p0}}","auto.f7aa648b33ac":"A\xFAn no hay copias de seguridad: cada ejecuci\xF3n que inicies aparecer\xE1 aqu\xED.","auto.f7b023b83c72":"Eliminando archivos antiguos\u2026","auto.f9dcc3004855":"Se adjunta aqu\xED un resumen de una l\xEDnea despu\xE9s de cada ejecuci\xF3n.","auto.ff61c7ba16aa":"\xBFEliminar?","notifications.group.backup":"Copia de seguridad","notifications.event.backup.finished":"Copia de seguridad terminada","notifications.event.backup.failed":"La copia de seguridad fall\xF3","plugin.backup.desc":"Replica las carpetas configuradas con el motor de copias nativo de Valley, con progreso en vivo y archivos recuperables.","plugin.backup.name":"Copia de seguridad"},fr:{"auto.0894fe6b352a":"par ex. le dossier que vous souhaitez sauvegarder","auto.0943b157227c":"\u2014 {{p0}} \xE9chec(s)","auto.09fef5d8d9a3":"\xC9chou\xE9","auto.0c2cf66ed63c":"Suppression de {{p0}} anciennes archives, conservation de {{p1}}","auto.101101ea16da":"Configurer la sauvegarde\u2026","auto.112053b66c92":"Ouvrir les param\xE8tres de sauvegarde","auto.11e10c8f488b":"Dossier de journal","auto.197e112d07bd":"Nettoyer\u2026","auto.19adc47be34b":"Dossiers","auto.1bd661da498a":"\xAB {{p0}} \xBB sera supprim\xE9 des param\xE8tres de sauvegarde.","auto.1c36bd34ec77":"Aper\xE7u de la restauration informatique\u2026","auto.1d164664f6ed":"Termin\xE9 \u2014 {{p0}} archiv\xE9 dans {{p1}}s","auto.1df120c8de5c":"Lecteur T7","auto.237d0a57fc14":"R\xE9pliquez les dossiers configur\xE9s avec les fonctions de fichiers de Valley, avec progression en direct et archives r\xE9cup\xE9rables.","auto.2700ef39cb59":"\xC9chec du nettoyage","auto.362a1984d15b":"Supprimer le profil","auto.3ad30e772903":"Fichier journal principal","auto.3ef11aabc275":"Backup fonctionne","auto.414f279b51ef":"Num\xE9risation {{p0}}\u2026","auto.432e860f10ff":"Param\xE8tres de sauvegarde","auto.4fe8252005e3":"Dossier {{p0}}","auto.54a694543dfe":"Restaurer\u2026","auto.5d5dba0742de":"Sauvegarder maintenant","auto.5f88ae056e7b":"Ce profil n'a pas encore de dossiers.","auto.62f3dd5a9d1f":"Les fichiers modifi\xE9s ou supprim\xE9s sont conserv\xE9s \xE0 c\xF4t\xE9 de chaque destination sous un horodatage.","auto.668c5fffd24d":"Configur\xE9","auto.695e28140cb3":"par ex. un dossier sur votre lecteur de sauvegarde","auto.6da13addb000":"Source","auto.6f6c3dd91f16":"Appliquer la restauration","auto.6f902038d03f":"Dossier pour les journaux d'ex\xE9cution (facultatif).","auto.77574766df8d":"Nom du profil","auto.77dfd2135f4d":"Annuler","auto.787035ed6c6d":"Aucune sortie pour l'instant.","auto.7e3112f57746":"Journal en direct","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} archiv\xE9s","auto.80f1eaf78461":"Mappages source/destination, chemin de la corbeille et emplacements des journaux de chaque profil.","auto.819ad5a4465c":"Dossier Corbeille","auto.82a68202d381":"Estimation ~{{p0}}","auto.82f841dac7be":"Pas encore de profil de sauvegarde. Ajoutez un dossier et une destination sur votre lecteur pour d\xE9marrer la mise en miroir.","auto.8911ca48fa04":"Supprimer {{p0}} anciennes(s) archive(s), conserver {{p1}} ?","auto.8b35536332aa":"{{p0}} erreur(s)","auto.90c0c2eb98de":"R\xE9v\xE8le","auto.97bc98400c87":"Identifiant du profil utilis\xE9 par le panneau et l'ex\xE9cution planifi\xE9e.","auto.9952bdb5d01a":"Profil de sauvegarde","auto.9f5cd8a2e880":"R\xE9essayer","auto.a0498c8d2c44":"La restauration ajouterait {{p0}}, mettrait \xE0 jour {{p1}}, supprimerait {{p2}} fichier(s) \u2014 les fichiers supprim\xE9s/\xE9cras\xE9s sont d\xE9pos\xE9s. Appliquer?","auto.a50710e773e1":"Archives","auto.a584451ceaf9":"Sauvegardes r\xE9centes","auto.a6df420d2c59":"\xC9chec \u2013 {{p0}} erreur(s)","auto.a94ac9e3ecd0":"G\xE9rer les profils\u2026","auto.a95e286913bf":"en cours\u2026","auto.adeeae4a8510":"Les fichiers supprim\xE9s/modifi\xE9s sont archiv\xE9s ici sous un horodatage avant d'\xEAtre \xE9cras\xE9s.","auto.b2b841a7fc71":"V\xE9rification des archives\u2026","auto.bae7d5be7082":"Statut","auto.beb2ea0a45a6":"La sauvegarde n'a pas pu d\xE9marrer.","auto.bfc7470c583a":"Configurer la sauvegarde","auto.c0d31d3b9d31":"+ Ajouter une paire de dossiers","auto.c848a612ec9b":"La restauration a \xE9chou\xE9","auto.caa8c9ee85cb":"Backup profils","auto.cc1ebdd04e76":"Inactif","auto.cc54e62c3e08":"Rien \xE0 supprimer \u2013 {{p0}} archive(s) conserv\xE9e(s)","auto.cc687f43b582":'Impossible de sauvegarder "{{p0}}"',"auto.d42713493ca8":"Destination","auto.d74340399e2a":"Profil actif","auto.d7f2768ca570":"\xC9chec de l'aper\xE7u","auto.d7fd3fcb4bb5":"{{p0}} archiv\xE9","auto.dba2fb67adfe":"~{{p0}} reste","auto.dd96994d01e7":"Sauvegarde","auto.df34924ef17e":"Restauration \xE0 partir d'une sauvegarde\u2026","auto.dfdc3dc9aa44":"{{p0}} fichier(s) restaur\xE9(s) \u2013 fichiers remplac\xE9s/supprim\xE9s d\xE9pos\xE9s \xE0 c\xF4t\xE9 des archives","auto.e5f58095ac29":"D\xE9part\u2026","auto.e8642ee5ad7e":"Estimation\u2026","auto.e963907dac5c":"Supprimer","auto.e97ecd4af356":"La sauvegarde ne peut pas s'ex\xE9cuter pour le moment.","auto.ef04290fc628":"+ Ajouter un profil","auto.f4c16b17ee40":"Exclure","auto.f6005584e229":"Sauvegarde\u2026","auto.f73992337e2d":"Sauvegarde {{p0}}","auto.f7aa648b33ac":"Aucune sauvegarde pour l'instant : chaque ex\xE9cution que vous d\xE9marrez appara\xEEt ici.","auto.f7b023b83c72":"Suppression des anciennes archives\u2026","auto.f9dcc3004855":"Un r\xE9sum\xE9 d\u2019une ligne est annex\xE9 ici apr\xE8s chaque ex\xE9cution.","auto.ff61c7ba16aa":"Supprimer ?","notifications.group.backup":"Sauvegarde","notifications.event.backup.finished":"Sauvegarde termin\xE9e","notifications.event.backup.failed":"\xC9chec de la sauvegarde","plugin.backup.desc":"R\xE9plique les dossiers configur\xE9s avec le moteur de sauvegarde natif de Valley, avec progression en direct et archives r\xE9cup\xE9rables.","plugin.backup.name":"Sauvegarde"},"zh-CN":{"auto.0894fe6b352a":"\u4F8B\u5982\u60A8\u8981\u5907\u4EFD\u7684\u6587\u4EF6\u5939","auto.0943b157227c":"\u2014 {{p0}} \u6B21\u5931\u8D25","auto.09fef5d8d9a3":"\u5931\u8D25\u7684","auto.0c2cf66ed63c":"\u5220\u9664\u4E86 {{p0}} \u4E2A\u65E7\u5B58\u6863\uFF0C\u4FDD\u7559\u4E86 {{p1}}","auto.101101ea16da":"\u8BBE\u7F6E\u5907\u4EFD\u2026","auto.112053b66c92":"\u6253\u5F00\u5907\u4EFD\u8BBE\u7F6E","auto.11e10c8f488b":"\u65E5\u5FD7\u6587\u4EF6\u5939","auto.197e112d07bd":"\u6E05\u7406\u2026","auto.19adc47be34b":"\u6587\u4EF6\u5939","auto.1bd661da498a":"\u201C{{p0}}\u201D\u5C06\u4ECE\u5907\u4EFD\u8BBE\u7F6E\u4E2D\u5220\u9664\u3002","auto.1c36bd34ec77":"\u8BA1\u7B97\u6062\u590D\u9884\u89C8\u2026","auto.1d164664f6ed":"\u5B8C\u6210 \u2014 {{p0}} \u5DF2\u5728 {{p1}} \u79D2\u5185\u5B58\u6863","auto.1df120c8de5c":"T7 \u9A71\u52A8\u5668","auto.237d0a57fc14":"\u901A\u8FC7 Valley \u7684\u6587\u4EF6\u7CFB\u7EDF\u529F\u80FD\u955C\u50CF\u914D\u7F6E\u7684\u6587\u4EF6\u5939\uFF0C\u663E\u793A\u5B9E\u65F6\u8FDB\u5EA6\u5E76\u4FDD\u7559\u53EF\u6062\u590D\u7684\u5F52\u6863\u3002","auto.2700ef39cb59":"\u6E05\u7406\u5931\u8D25","auto.362a1984d15b":"\u5220\u9664\u914D\u7F6E\u6587\u4EF6","auto.3ad30e772903":"\u4E3B\u65E5\u5FD7\u6587\u4EF6","auto.3ef11aabc275":"Backup \u8FD0\u884C","auto.414f279b51ef":"\u6B63\u5728\u626B\u63CF{{p0}}\u2026","auto.432e860f10ff":"\u5907\u4EFD\u8BBE\u7F6E","auto.4fe8252005e3":"\u6587\u4EF6\u5939 {{p0}}","auto.54a694543dfe":"\u6062\u590D\u2026","auto.5d5dba0742de":"\u7ACB\u5373\u5907\u4EFD","auto.5f88ae056e7b":"\u8BE5\u914D\u7F6E\u6587\u4EF6\u8FD8\u6CA1\u6709\u6587\u4EF6\u5939\u3002","auto.62f3dd5a9d1f":"\u66F4\u6539\u6216\u5220\u9664\u7684\u6587\u4EF6\u4FDD\u5B58\u5728\u6BCF\u4E2A\u76EE\u6807\u65C1\u8FB9\u7684\u65F6\u95F4\u6233\u4E0B\u3002","auto.668c5fffd24d":"\u5DF2\u914D\u7F6E","auto.695e28140cb3":"\u4F8B\u5982\u5907\u4EFD\u9A71\u52A8\u5668\u4E0A\u7684\u6587\u4EF6\u5939","auto.6da13addb000":"\u6765\u6E90","auto.6f6c3dd91f16":"\u5E94\u7528\u6062\u590D","auto.6f902038d03f":"\u8FD0\u884C\u65E5\u5FD7\u7684\u6587\u4EF6\u5939\uFF08\u53EF\u9009\uFF09\u3002","auto.77574766df8d":"\u4E2A\u4EBA\u8D44\u6599\u540D\u79F0","auto.77dfd2135f4d":"\u53D6\u6D88","auto.787035ed6c6d":"\u8FD8\u6CA1\u6709\u8F93\u51FA\u3002","auto.7e3112f57746":"\u5B9E\u65F6\u65E5\u5FD7","auto.7fd373bab038":"{{p0}}s \xB7 {{p1}} \u5DF2\u5B58\u6863","auto.80f1eaf78461":"\u6BCF\u4E2A\u914D\u7F6E\u6587\u4EF6\u7684\u6E90/\u76EE\u6807\u6620\u5C04\u3001\u5783\u573E\u8DEF\u5F84\u548C\u65E5\u5FD7\u4F4D\u7F6E\u3002","auto.819ad5a4465c":"\u5783\u573E\u6587\u4EF6\u5939","auto.82a68202d381":"\u4F30\u8BA1~{{p0}}","auto.82f841dac7be":"\u8FD8\u6CA1\u6709\u5907\u4EFD\u914D\u7F6E\u6587\u4EF6\u3002\u5728\u9A71\u52A8\u5668\u4E0A\u6DFB\u52A0\u6587\u4EF6\u5939\u548C\u76EE\u6807\u4EE5\u5F00\u59CB\u955C\u50CF\u3002","auto.8911ca48fa04":"\u5220\u9664 {{p0}} \u65E7\u5B58\u6863\uFF0C\u4FDD\u7559 {{p1}}\uFF1F","auto.8b35536332aa":"{{p0}} \u9519\u8BEF","auto.90c0c2eb98de":"\u542F\u793A","auto.97bc98400c87":"\u9762\u677F\u548C\u8BA1\u5212\u8FD0\u884C\u4F7F\u7528\u7684\u914D\u7F6E\u6587\u4EF6\u7684 ID\u3002","auto.9952bdb5d01a":"\u5907\u4EFD\u914D\u7F6E\u6587\u4EF6","auto.9f5cd8a2e880":"\u91CD\u8BD5","auto.a0498c8d2c44":"\u6062\u590D\u5C06\u6DFB\u52A0 {{p0}}\u3001\u66F4\u65B0 {{p1}}\u3001\u5220\u9664 {{p2}} \u6587\u4EF6 - \u5220\u9664/\u8986\u76D6\u7684\u6587\u4EF6\u5C06\u88AB\u6258\u7BA1\u3002\u7533\u8BF7\uFF1F","auto.a50710e773e1":"\u6863\u6848","auto.a584451ceaf9":"\u6700\u8FD1\u7684\u5907\u4EFD","auto.a6df420d2c59":"\u5931\u8D25 - {{p0}} \u4E2A\u9519\u8BEF","auto.a94ac9e3ecd0":"\u7BA1\u7406\u914D\u7F6E\u6587\u4EF6\u2026","auto.a95e286913bf":"\u8FDB\u884C\u4E2D\u2026","auto.adeeae4a8510":"\u5220\u9664/\u66F4\u6539\u7684\u6587\u4EF6\u5728\u88AB\u8986\u76D6\u4E4B\u524D\u4F1A\u5728\u65F6\u95F4\u6233\u4E0B\u5B58\u6863\u5728\u8FD9\u91CC\u3002","auto.b2b841a7fc71":"\u68C0\u67E5\u6863\u6848\u2026","auto.bae7d5be7082":"\u72B6\u6001","auto.beb2ea0a45a6":"\u65E0\u6CD5\u5F00\u59CB\u5907\u4EFD\u3002","auto.bfc7470c583a":"\u8BBE\u7F6E\u5907\u4EFD","auto.c0d31d3b9d31":"+ \u6DFB\u52A0\u6587\u4EF6\u5939\u5BF9","auto.c848a612ec9b":"\u6062\u590D\u5931\u8D25","auto.caa8c9ee85cb":"Backup\u4E2A\u4EBA\u8D44\u6599","auto.cc1ebdd04e76":"\u95F2\u7F6E\u7684","auto.cc54e62c3e08":"\u6CA1\u6709\u53EF\u5220\u9664\u7684\u5185\u5BB9 \u2014 \u4FDD\u7559\u8303\u56F4\u5185\u7684 {{p0}} \u4E2A\u5B58\u6863","auto.cc687f43b582":"\u65E0\u6CD5\u5907\u4EFD\u201C{{p0}}\u201D","auto.d42713493ca8":"\u76EE\u7684\u5730","auto.d74340399e2a":"\u6D3B\u52A8\u6863\u6848","auto.d7f2768ca570":"\u9884\u89C8\u5931\u8D25","auto.d7fd3fcb4bb5":"{{p0}} \u5DF2\u5B58\u6863","auto.dba2fb67adfe":"\u8FD8\u5269\u4E0B~{{p0}}","auto.dd96994d01e7":"\u5907\u4EFD","auto.df34924ef17e":"\u4ECE\u5907\u4EFD\u6062\u590D\u2026","auto.dfdc3dc9aa44":"\u5DF2\u6062\u590D\u7684 {{p0}} \u6587\u4EF6 \u2014 \u66FF\u6362/\u5220\u9664\u7684\u6587\u4EF6\u6258\u7BA1\u5728\u5B58\u6863\u65C1\u8FB9","auto.e5f58095ac29":"\u5F00\u59CB\u2026","auto.e8642ee5ad7e":"\u4F30\u8BA1\u2026","auto.e963907dac5c":"\u5220\u9664","auto.e97ecd4af356":"\u5907\u4EFD\u73B0\u5728\u65E0\u6CD5\u8FD0\u884C\u3002","auto.ef04290fc628":"+ \u6DFB\u52A0\u4E2A\u4EBA\u8D44\u6599","auto.f4c16b17ee40":"\u6392\u9664","auto.f6005584e229":"\u6B63\u5728\u5907\u4EFD\u2026","auto.f73992337e2d":"\u6B63\u5728\u5907\u4EFD {{p0}}","auto.f7aa648b33ac":"\u8FD8\u6CA1\u6709\u5907\u4EFD - \u60A8\u5F00\u59CB\u7684\u6BCF\u6B21\u8FD0\u884C\u90FD\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002","auto.f7b023b83c72":"\u5220\u9664\u65E7\u6863\u6848\u2026","auto.f9dcc3004855":"\u6BCF\u6B21\u8FD0\u884C\u540E\u90FD\u4F1A\u5728\u6B64\u5904\u9644\u52A0\u4E00\u884C\u6458\u8981\u3002","auto.ff61c7ba16aa":"\u79FB\u9664\uFF1F","notifications.group.backup":"\u5907\u4EFD","notifications.event.backup.finished":"\u5907\u4EFD\u5B8C\u6210","notifications.event.backup.failed":"\u5907\u4EFD\u5931\u8D25","plugin.backup.desc":"\u4F7F\u7528 Valley \u539F\u751F\u5907\u4EFD\u5F15\u64CE\u955C\u50CF\u914D\u7F6E\u7684\u6587\u4EF6\u5939\uFF0C\u5B9E\u65F6\u663E\u793A\u8FDB\u5EA6\uFF0C\u5E76\u4FDD\u7559\u53EF\u6062\u590D\u7684\u5F52\u6863\u3002","plugin.backup.name":"\u5907\u4EFD"}};var lt={en:{"backup.notification.finished":"Backup finished","backup.notification.failed":"Backup failed","backup.surface.status":"Backup progress","backup.surface.profiles":"List backup profiles","backup.surface.profile-read":"Read backup profile","backup.surface.profile-create":"Create backup profile","backup.surface.profile-update":"Update backup profile","backup.surface.profile-delete":"Delete backup profile","backup.surface.check":"Check backup profile","backup.surface.history":"Read backup history","backup.surface.prune-preview":"Preview backup retention","backup.surface.prune":"Apply backup retention","backup.surface.restore-preview":"Preview backup restore","backup.surface.restore":"Restore backup mapping","backup.surface.id":"Profile ID","backup.surface.name":"Name","backup.surface.mappings":"Folder pairs","backup.surface.trashPath":"Trash folder","backup.surface.logDirectory":"Log folder","backup.surface.masterLog":"Master log file","backup.surface.profileCount":"Profiles","backup.properties.saveError":"Could not save your changes. Your edits are kept; try again."},de:{"backup.notification.finished":"Sicherung abgeschlossen","backup.notification.failed":"Sicherung fehlgeschlagen","backup.surface.status":"Sicherungsfortschritt","backup.surface.profiles":"Sicherungsprofile auflisten","backup.surface.profile-read":"Sicherungsprofil lesen","backup.surface.profile-create":"Sicherungsprofil erstellen","backup.surface.profile-update":"Sicherungsprofil bearbeiten","backup.surface.profile-delete":"Sicherungsprofil l\xF6schen","backup.surface.check":"Sicherungsprofil pr\xFCfen","backup.surface.history":"Sicherungsverlauf lesen","backup.surface.prune-preview":"Aufbewahrungsvorschau anzeigen","backup.surface.prune":"Aufbewahrungsregeln anwenden","backup.surface.restore-preview":"Wiederherstellungsvorschau anzeigen","backup.surface.restore":"Sicherung wiederherstellen","backup.surface.id":"Profil-ID","backup.surface.name":"Name","backup.surface.mappings":"Ordnerpaare","backup.surface.trashPath":"Papierkorbordner","backup.surface.logDirectory":"Protokollordner","backup.surface.masterLog":"Hauptprotokolldatei","backup.surface.profileCount":"Profile","backup.properties.saveError":"Deine \xC4nderungen konnten nicht gespeichert werden. Sie bleiben erhalten; versuche es erneut."},es:{"backup.notification.finished":"Copia finalizada","backup.notification.failed":"Copia fallida","backup.surface.status":"Progreso de copia","backup.surface.profiles":"Listar perfiles de copia","backup.surface.profile-read":"Leer perfil de copia","backup.surface.profile-create":"Crear perfil de copia","backup.surface.profile-update":"Editar perfil de copia","backup.surface.profile-delete":"Eliminar perfil de copia","backup.surface.check":"Comprobar perfil de copia","backup.surface.history":"Leer historial de copias","backup.surface.prune-preview":"Vista previa de retenci\xF3n","backup.surface.prune":"Aplicar retenci\xF3n","backup.surface.restore-preview":"Vista previa de restauraci\xF3n","backup.surface.restore":"Restaurar copia","backup.surface.id":"ID del perfil","backup.surface.name":"Nombre","backup.surface.mappings":"Pares de carpetas","backup.surface.trashPath":"Carpeta de papelera","backup.surface.logDirectory":"Carpeta de registros","backup.surface.masterLog":"Archivo de registro principal","backup.surface.profileCount":"Perfiles","backup.properties.saveError":"No se pudieron guardar los cambios. Se conservan; int\xE9ntalo de nuevo."},fr:{"backup.notification.finished":"Sauvegarde termin\xE9e","backup.notification.failed":"\xC9chec de la sauvegarde","backup.surface.status":"Progression de la sauvegarde","backup.surface.profiles":"Lister les profils de sauvegarde","backup.surface.profile-read":"Lire le profil de sauvegarde","backup.surface.profile-create":"Cr\xE9er un profil de sauvegarde","backup.surface.profile-update":"Modifier le profil de sauvegarde","backup.surface.profile-delete":"Supprimer le profil de sauvegarde","backup.surface.check":"V\xE9rifier le profil de sauvegarde","backup.surface.history":"Lire l\u2019historique des sauvegardes","backup.surface.prune-preview":"Aper\xE7u de la r\xE9tention","backup.surface.prune":"Appliquer la r\xE9tention","backup.surface.restore-preview":"Aper\xE7u de la restauration","backup.surface.restore":"Restaurer la sauvegarde","backup.surface.id":"Identifiant du profil","backup.surface.name":"Nom","backup.surface.mappings":"Paires de dossiers","backup.surface.trashPath":"Dossier de corbeille","backup.surface.logDirectory":"Dossier des journaux","backup.surface.masterLog":"Fichier journal principal","backup.surface.profileCount":"Profils","backup.properties.saveError":"Impossible d\u2019enregistrer vos modifications. Elles sont conserv\xE9es ; r\xE9essayez."},"zh-CN":{"backup.notification.finished":"\u5907\u4EFD\u5B8C\u6210","backup.notification.failed":"\u5907\u4EFD\u5931\u8D25","backup.surface.status":"\u5907\u4EFD\u8FDB\u5EA6","backup.surface.profiles":"\u5217\u51FA\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-read":"\u8BFB\u53D6\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-create":"\u521B\u5EFA\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-update":"\u7F16\u8F91\u5907\u4EFD\u914D\u7F6E","backup.surface.profile-delete":"\u5220\u9664\u5907\u4EFD\u914D\u7F6E","backup.surface.check":"\u68C0\u67E5\u5907\u4EFD\u914D\u7F6E","backup.surface.history":"\u8BFB\u53D6\u5907\u4EFD\u5386\u53F2","backup.surface.prune-preview":"\u9884\u89C8\u5907\u4EFD\u4FDD\u7559\u6E05\u7406","backup.surface.prune":"\u6267\u884C\u5907\u4EFD\u4FDD\u7559\u6E05\u7406","backup.surface.restore-preview":"\u9884\u89C8\u6062\u590D","backup.surface.restore":"\u6062\u590D\u5907\u4EFD","backup.surface.id":"\u914D\u7F6E ID","backup.surface.name":"\u540D\u79F0","backup.surface.mappings":"\u6587\u4EF6\u5939\u914D\u5BF9","backup.surface.trashPath":"\u56DE\u6536\u7AD9\u6587\u4EF6\u5939","backup.surface.logDirectory":"\u65E5\u5FD7\u6587\u4EF6\u5939","backup.surface.masterLog":"\u4E3B\u65E5\u5FD7\u6587\u4EF6","backup.surface.profileCount":"\u914D\u7F6E\u6570","backup.properties.saveError":"\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\uFF1B\u8BF7\u91CD\u8BD5\u3002"}};function pt(e,a){return(lt.en[e]??Fe.en[e]??e).replace(/\{\{([^}]+)\}\}/g,(t,h)=>String(a?.[h]??""))}var ft=pt;function bt(e){ft=(a,n)=>{let t=e.ui.t(a,n);return t===a?pt(a,n):t},e.ui.registerCatalogs(Fe),e.ui.registerCatalogs(lt)}function r(e,a){return ft(e,a)}var Ue="notes-backup-styles",Ra=`
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
`;function gt(){let e=document.getElementById(Ue);return e||(e=document.createElement("style"),e.id=Ue,document.head.appendChild(e)),e.textContent=Ra,()=>{document.getElementById(Ue)===e&&e.remove()}}var $=e=>typeof e=="string"?e:e==null?"":String(e),Ae=()=>`p${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,Ia=e=>Array.isArray(e)?e.map(a=>{let n=a??{},t=Array.isArray(n.exclude)?n.exclude.map(String):[];return{source:$(n.source),destination:$(n.destination),excludeText:t.join(", ")}}):[],ce=e=>Array.isArray(e.profiles)?e.profiles.filter(a=>!!a&&typeof a=="object").map((a,n)=>({id:$(a.id).trim()||Ae(),name:$(a.name).trim()||`Profile ${n+1}`,rows:Ia(a.mappings),trashPath:$(a.trashPath),logDirectory:$(a.logDirectory),masterLog:$(a.masterLog),retention:a.retention==="off"?"off":"standard"})):[],z=e=>({id:e.id,name:e.name.trim()||"Untitled",mappings:e.rows.map(a=>({source:a.source.trim(),destination:a.destination.trim(),exclude:a.excludeText.split(",").map(n=>n.trim()).filter(Boolean)})),trashPath:e.trashPath.trim(),logDirectory:e.logDirectory.trim(),masterLog:e.masterLog.trim(),retention:e.retention??"standard"});function mt(e){let a=ce(e.settings.get()),n=JSON.stringify(a.map(z)),t=!1,h=Promise.resolve(),v=new Set,w=()=>{for(let d of v)d()},_=e.settings.subscribe(()=>{if(t)return;let d=ce(e.settings.get()),A=JSON.stringify(d.map(z));A!==n&&(a=d,n=A,w())}),s=d=>{a=typeof d=="function"?d(a):d,t=JSON.stringify(a.map(z))!==n,w()};return{getSnapshot:()=>a,subscribe:d=>(v.add(d),()=>{v.delete(d)}),setDraft:s,save:d=>{let A=d.map(z);s(d);let x=h.then(async()=>{if(!(await e.settings.set("profiles",A)).ok)throw new Error("Could not save backup profiles");n=JSON.stringify(A),t=JSON.stringify(a.map(z))!==n,w()});return h=x.catch(()=>{}),x},assertClean:()=>{if(t)throw new Error("Finish editing backup settings before changing profiles through automation")},dispose:()=>{_(),v.clear()}}}function He(e,a=!1){let n=z(e);return{label:n.name,mappings:n.mappings.filter(t=>t.source&&t.destination),trashPath:n.trashPath,logDirectory:n.logDirectory,masterLog:n.masterLog,retention:!a&&n.retention==="off"?null:{keepDays:7,dailies:30,weeklies:8}}}var Ge={type:"object",properties:{profileId:{type:"string"}},additionalProperties:!1};function ge(e){if(e==null)return{};if(typeof e!="object"||Array.isArray(e))throw new Error("Expected an object");return e}function qe(e){let a=ge(e).profileId;if(a!==void 0&&(typeof a!="string"||!a.trim()))throw new Error("profileId must be a nonempty string");return a?{profileId:String(a)}:{}}var be={schema:Ge,parse:qe,fromCli:(e,a)=>({profileId:a.profile??e[0]})},We={name:{type:"string",minLength:1},mappings:{type:"array",items:{type:"object",properties:{source:{type:"string"},destination:{type:"string"},exclude:{type:"array",items:{type:"string"}}},required:["source","destination"],additionalProperties:!1}},trashPath:{type:"string"},logDirectory:{type:"string"},masterLog:{type:"string"}};function Ke(e){let a=ge(e);for(let[n,t]of Object.entries(a)){if(!(n in We))throw new Error(`Unknown profile field: ${n}`);if(n==="mappings"){if(!Array.isArray(t))throw new Error("mappings must be an array");for(let h of t){let v=ge(h);if(typeof v.source!="string"||typeof v.destination!="string")throw new Error("A mapping requires source and destination paths");if(v.exclude!==void 0&&(!Array.isArray(v.exclude)||!v.exclude.every(w=>typeof w=="string")))throw new Error("Mapping exclusions must be strings");if(Object.keys(v).some(w=>!["source","destination","exclude"].includes(w)))throw new Error("Unknown mapping field")}}else if(typeof t!="string"||n==="name"&&!t.trim())throw new Error(`Invalid ${n}`)}return a}function ht(e,a){let n=!1,t=null,h=null,v=e.drivers.mirror.onProgress(A=>{h=A}),w=A=>{let x=a.getSnapshot(),T=A??String(e.settings.get().activeProfileId??""),G=T?x.find(Z=>Z.id===T):x[0];if(!G)throw new Error(`Backup profile not found: ${T||"(none configured)"}`);return G},_=(A=50,x)=>e.data.dataset("backup_runs").query({orderBy:[{field:"startedAt",direction:"desc"}],limit:A,cursor:x}),s=async(A,x=!1)=>{if(a.assertClean(),n)throw new Error("A backup is already running. Check backup:status before starting another.");let T=w(A),G=He(T);n=!0,t=T.id,h=null;try{if(!x){let O=await e.drivers.mirror.check(G);if(!O.ok||!O.data?.ok)throw new Error(O.error??O.data?.issues.map(me=>me.message).join("; ")??"Backup precheck failed")}let Z=new Date().toISOString(),V=await e.drivers.mirror.run(G);if(V.data){let O=V.data;await e.data.dataset("backup_runs").insert({id:crypto.randomUUID(),startedAt:Z,profileName:T.name,durationSec:O.durationSec,archived:O.archived,errors:O.errors,ok:O.ok,reason:O.ok?null:O.message??null});let me=await _(1e3);for(let $e of me.rows.slice(50))await e.data.dataset("backup_runs").delete({id:String($e.id)})}return await e.notifications.notify(V.ok&&V.data?.ok?"finished":"failed",{title:r(V.ok&&V.data?.ok?"backup.notification.finished":"backup.notification.failed"),body:T.name}),V}catch(Z){throw await e.notifications.notify("failed",{title:r("backup.notification.failed"),body:T.name}),Z}finally{n=!1}},c=async(A,x)=>{a.assertClean(),await a.save(A);let T=JSON.stringify(A.map(z));return{value:A.map(z),revert:{label:"Update backup profiles",run:async()=>{if(a.assertClean(),JSON.stringify(a.getSnapshot().map(z))!==T)throw new Error("Backup profiles changed after this operation");await a.save(x)}}}};return{profile:w,plan:(A,x=!1)=>(a.assertClean(),He(w(A),x)),history:_,run:s,replace:c,update:async(A,x)=>{let T=w(A),G=Ke(x),Z=a.getSnapshot(),[V]=ce({profiles:[{...z(T),...G}]});return c(Z.map(O=>O.id===T.id?V:O),Z)},status:()=>({running:n,profileId:t,progress:h}),dispose:v}}function kt(e,a,n){let t=({profileId:s})=>z(n.profile(s)),h=async({profileId:s})=>{let c=await e.drivers.mirror.prune(n.plan(s,!0),{dryRun:!0});if(!c.ok||!c.data||c.data.errors.length)throw new Error(c.error??c.data?.errors.map(d=>d.message).join("; ")??"Could not inspect backup retention");return c.data},v=async({profileId:s,mappingIndex:c})=>{let d=await e.drivers.mirror.restorePlan(n.plan(s),c);if(!d.ok||!d.data?.ok)throw new Error(d.error??d.data?.message??"Could not inspect this restore");return d.data},w={schema:{...Ge,properties:{...Ge.properties,mappingIndex:{type:"integer",minimum:0}},required:["mappingIndex"]},parse:s=>{let c=qe(s),d=Number(ge(s).mappingIndex);if(!Number.isInteger(d)||d<0)throw new Error("mappingIndex must be a nonnegative integer");let A=n.profile(c.profileId);if(!A.rows[d])throw new Error("Backup mapping does not exist");return{profileId:A.id,mappingIndex:d}}},_=[e.commands.register({id:"status",label:"Backup progress",labelKey:"backup.surface.status",sideEffect:"read",paletteSafe:!1,run:n.status}),e.commands.register({id:"profiles",label:"List backup profiles",labelKey:"backup.surface.profiles",paletteSafe:!1,sideEffect:"read",run:()=>a.getSnapshot().map(z)}),e.commands.register({id:"profile-read",label:"Read backup profile",labelKey:"backup.surface.profile-read",paletteSafe:!1,sideEffect:"read",input:be,run:({profileId:s})=>z(n.profile(s))}),e.commands.register({id:"profile-create",label:"Create backup profile",labelKey:"backup.surface.profile-create",paletteSafe:!1,sideEffect:"write",input:{schema:{type:"object",properties:We,required:["name"],additionalProperties:!1},parse:s=>{let c=Ke(s);if(typeof c.name!="string")throw new Error("name is required");return c}},revision:()=>a.getSnapshot().map(z),preview:s=>({action:"create-profile",values:s}),run:async s=>{let c=a.getSnapshot(),d=ce({profiles:[{id:Ae(),...s}]});return n.replace([...c,...d],c)}}),e.commands.register({id:"profile-update",label:"Update backup profile",labelKey:"backup.surface.profile-update",paletteSafe:!1,sideEffect:"write",input:{schema:{type:"object",properties:{profileId:{type:"string"},values:{type:"object",properties:We,additionalProperties:!1}},required:["profileId","values"],additionalProperties:!1},parse:s=>{let c=qe(s);if(!c.profileId)throw new Error("profileId is required");return{profileId:c.profileId,values:Ke(ge(s).values)}}},revision:s=>t(s),preview:s=>s,run:({profileId:s,values:c})=>n.update(s,c)}),e.commands.register({id:"profile-delete",label:"Delete backup profile",labelKey:"backup.surface.profile-delete",paletteSafe:!1,sideEffect:"write",input:be,revision:t,preview:({profileId:s})=>({action:"delete-profile",profile:z(n.profile(s))}),run:async({profileId:s})=>{let c=n.profile(s),d=a.getSnapshot();return n.replace(d.filter(A=>A.id!==c.id),d)}}),e.commands.register({id:"check",label:"Check backup profile",labelKey:"backup.surface.check",paletteSafe:!1,sideEffect:"read",input:be,run:async({profileId:s})=>{let c=await e.drivers.mirror.check(n.plan(s));if(!c.ok||!c.data?.ok)throw new Error(c.error??c.data?.issues.map(d=>d.message).join("; ")??"Backup precheck failed");return c.data}}),e.commands.register({id:"run",label:"Backup now",labelKey:"auto.5d5dba0742de",sideEffect:"write",input:be,revision:t,preview:({profileId:s})=>e.drivers.mirror.check(n.plan(s)),run:async({profileId:s})=>{let c=await n.run(s);if(!c.ok||!c.data?.ok)throw new Error(c.error??c.data?.message??"Backup failed");return{value:c.data,revert:null}}}),e.commands.register({id:"history",label:"Read backup history",labelKey:"backup.surface.history",paletteSafe:!1,sideEffect:"read",input:{schema:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:500},cursor:{type:"string"}}},parse:s=>{let c=ge(s),d=Number(c.limit??50);if(!Number.isInteger(d)||d<1||d>500||c.cursor!==void 0&&typeof c.cursor!="string")throw new Error("Invalid pagination");return{limit:d,cursor:c.cursor}}},run:({limit:s,cursor:c})=>n.history(s,c)}),e.commands.register({id:"prune-preview",label:"Preview backup retention",labelKey:"backup.surface.prune-preview",paletteSafe:!1,sideEffect:"read",input:be,run:h}),e.commands.register({id:"prune",label:"Apply backup retention",labelKey:"backup.surface.prune",paletteSafe:!1,sideEffect:"write",input:be,revision:async s=>({profile:t(s),plan:await h(s)}),preview:h,run:async({profileId:s})=>{let c=await e.drivers.mirror.prune(n.plan(s,!0),{dryRun:!1});if(!c.ok||c.data?.errors.length)throw new Error(c.error??`Retention did not finish. ${c.data?.dropped.length??0} archives were removed; inspect history before retrying.`);return{value:c.data,revert:null}}}),e.commands.register({id:"restore-preview",label:"Preview backup restore",labelKey:"backup.surface.restore-preview",paletteSafe:!1,sideEffect:"read",input:w,run:v}),e.commands.register({id:"restore",label:"Restore backup mapping",labelKey:"backup.surface.restore",paletteSafe:!1,sideEffect:"write",input:w,revision:async s=>({profile:t(s),plan:await v(s)}),preview:v,run:async({profileId:s,mappingIndex:c})=>{let d=await e.drivers.mirror.restoreApply(n.plan(s),c);if(!d.ok||!d.data?.ok)throw new Error(d.error??d.data?.message??"Restore failed");return{value:d.data,revert:null}}})];return()=>{for(let s of _)s();n.dispose()}}var yt=800,vt=50;function wt(e,a){let n=Math.max(0,Math.round(e)),t=(h,v)=>new Intl.NumberFormat(a,{style:"unit",unit:v,unitDisplay:"short"}).format(h);return n<60?t(n,"second"):new Intl.ListFormat(a,{style:"narrow",type:"unit"}).format([t(Math.floor(n/60),"minute"),t(n%60,"second")])}function Ea(e,a){let n=new Date(e);return a.replace("yyyy",String(n.getFullYear())).replace(/m{2}/i,String(n.getMonth()+1).padStart(2,"0")).replace("dd",String(n.getDate()).padStart(2,"0"))}function Na(e,a,n){let t=Date.parse(e);if(Number.isNaN(t))return"";let h=new Intl.RelativeTimeFormat(a,{numeric:"auto"}),v=Math.round((Date.now()-t)/1e3);if(v<45)return h.format(0,"second");let w=Math.round(v/60);if(w<60)return h.format(-w,"minute");let _=Math.round(w/60);if(_<24)return h.format(-_,"hour");let s=Math.round(_/24);return s<7?h.format(-s,"day"):n?Ea(t,n):new Date(t).toLocaleDateString(a)}var Ze=e=>{let a=Number(e);return Number.isFinite(a)?a:0};function Pa(e){bt(e);let a=gt(),n=e.React,t=n.createElement,h=mt(e),v=ht(e,h),w={profileId:$(e.settings.get().activeProfileId),tab:"status"},_=new Set,s=()=>{for(let l of _)l()},c=l=>(_.add(l),()=>{_.delete(l)}),d=l=>{let N={...w,...l};N.profileId===w.profileId&&N.tab===w.tab||(w=N,s())},A=h.subscribe(s),x=(l,N)=>t("svg",{width:"1em",height:"1em",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":!0,style:{flex:"none",...N}},...l),T=x([t("path",{d:"M20 6 9 17l-5-5"})]),G=x([t("path",{d:"M18 6 6 18M6 6l12 12"})]),Z=x([t("circle",{cx:12,cy:12,r:10}),t("path",{d:"m4.9 4.9 14.2 14.2"})]),V=x([t("path",{d:"M21 12a9 9 0 1 1-6.219-8.56"})],{animation:"notes-backup-spin 0.8s linear infinite"}),O=x([t("path",{d:"m6 9 6 6 6-6"})]),me=x([t("path",{d:"m15 18-6-6 6-6"})]),$e=x([t("path",{d:"m9 18 6-6-6-6"})]),xt=x([t("path",{d:"M12 5v14M5 12h14"})]),Oe=x([t("path",{d:"M22 12H2"}),t("path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}),t("path",{d:"M6 16h.01M10 16h.01"})]),St=x([t("path",{d:"M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"})]),At=x([t("path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}),t("path",{d:"M3 3v5h5"}),t("path",{d:"M12 7v5l4 2"})]),Rt=x([t("rect",{width:20,height:5,x:2,y:3,rx:1}),t("path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"}),t("path",{d:"M10 12h4"})]),It=x([t("path",{d:"M20 7h-9M14 17H5"}),t("circle",{cx:17,cy:17,r:3}),t("circle",{cx:7,cy:7,r:3})]),Et=x([t("path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}),t("path",{d:"M12 9v4M12 17h.01"})]),Nt={running:V,done:T,skipped:Z,failed:G},Pt=()=>{let[l,N]=n.useState("idle"),[ue,J]=n.useState(""),[Y,he]=n.useState([]),[C,F]=n.useState(null),[Q,ke]=n.useState([]),[ee,te]=n.useState([]),[re,oe]=n.useState([]),Re=n.useSyncExternalStore(c,()=>w),j=Re.profileId,ye=o=>d({profileId:typeof o=="function"?o(w.profileId):o}),[de,Me]=n.useState([]),q=Re.tab,ve=o=>d({tab:o}),[we,ze]=n.useState(null),[Be,xe]=n.useState(()=>e.getState().dateFormat);n.useEffect(()=>e.subscribe(()=>xe(e.getState().dateFormat)),[]);let[,je]=n.useState(0),Se=n.useRef(0),i=n.useRef(0),p=n.useRef(null),f=o=>re.find(u=>u.id===o)?.name??"Backup",k=n.useCallback(()=>{let o=e.settings.get(),u=ce(o).map(y=>({id:y.id,name:y.name}));oe(u);let m=$(o.activeProfileId).trim();return ye(y=>y&&u.some(R=>R.id===y)?y:m&&u.some(R=>R.id===m)?m:u[0]?.id??""),u},[]),I=n.useCallback(()=>{e.data.dataset("backup_runs").query({orderBy:[{field:"startedAt",direction:"desc"}],limit:vt}).then(({rows:o})=>{let u=o.map(m=>({id:$(m.id),startedAt:$(m.startedAt),profileName:$(m.profileName)||"Backup",durationSec:Ze(m.durationSec),archived:Ze(m.archived),errors:Ze(m.errors),ok:m.ok===!0||m.ok==="true",reason:m.reason?$(m.reason):void 0}));u.sort((m,y)=>Date.parse(y.startedAt)-Date.parse(m.startedAt)),Me(u.slice(0,vt))})},[]);n.useEffect(()=>{k(),I();let o=()=>{k()};return e.settings.subscribe(o)},[k,I]),n.useEffect(()=>e.drivers.mirror.onProgress(u=>{if(u.update){F(u.update);return}if(u.mapping){let y=u.mapping;ke(R=>{let ae=R.filter(X=>X.index!==y.index);return ae.push(y),ae.sort((X,ia)=>X.index-ia.index),ae});return}if(u.line===void 0)return;let m=u.line;he(y=>{let R=y.concat(m);return R.length>yt?R.slice(R.length-yt):R})}),[]),n.useEffect(()=>{let o=p.current;o&&(o.scrollTop=o.scrollHeight)},[Y,q]),n.useEffect(()=>{if(l!=="running")return;let o=setInterval(()=>je(u=>u+1),1e3);return()=>clearInterval(o)},[l]);let D=o=>{ye(o),e.settings.set("activeProfileId",o),te([])},W=()=>e.workspace.openOwnSettings(),le=o=>{let u=k();if(!u.length){W();return}let m=u.map(y=>({id:y.id,type:"radio",checked:y.id===j,label:y.name,onSelect:()=>D(y.id)}));m.push({type:"separator"},{id:"manage",label:r("auto.a94ac9e3ecd0"),onSelect:W}),e.ui.openMenu(m,{anchor:o,align:"end"})},Ie=async()=>{if(l==="running")return;te([]);let o=await e.drivers.mirror.check(v.plan(j||void 0));if(!o.ok||!o.data||!o.data.ok){te(o.data?.issues??[{kind:"dest-error",message:r("auto.e97ecd4af356")}]),N("failed"),J("");return}he([]),J(""),F(null),ke([]);let u=f(j),m=de.find(X=>X.ok&&X.profileName===u)??de.find(X=>X.ok);ze(m?m.durationSec:null),Se.current=Date.now(),i.current=0,N("running");let y=await v.run(j||void 0,!0),R=y.data;if(F(null),!y.ok||!R){N("failed"),J(r("auto.beb2ea0a45a6"));return}R.issues&&R.issues.length&&te(R.issues);let ae=R.ok;N(ae?"done":"failed"),J(ae?r("auto.1d164664f6ed",{p0:R.archived,p1:R.durationSec}):r("auto.a6df420d2c59",{p0:R.failedItems||R.errors})),I()},[U,H]=n.useState({kind:"idle"}),Je=(()=>{let u=(e.settings.get().profiles??[]).find(y=>$(y.id)===j);return(Array.isArray(u?.mappings)?u?.mappings:[]).map(y=>({source:$(y.source).trim(),destination:$(y.destination).trim()})).filter(y=>y.source&&y.destination)})(),Dt=async()=>{H({kind:"busy",label:r("auto.b2b841a7fc71")});let o=await e.drivers.mirror.prune(v.plan(j||void 0,!0),{dryRun:!0});if(!o.ok||!o.data){H({kind:"note",text:r("auto.2700ef39cb59")});return}if(o.data.dropped.length===0){H({kind:"note",text:r("auto.cc54e62c3e08",{p0:o.data.kept})});return}H({kind:"prune-counted",drop:o.data.dropped.length,kept:o.data.kept})},Lt=async()=>{H({kind:"busy",label:r("auto.f7b023b83c72")});let o=await e.drivers.mirror.prune(v.plan(j||void 0,!0));H({kind:"note",text:o.ok&&o.data?r("auto.0c2cf66ed63c",{p0:o.data.dropped.length,p1:o.data.kept})+(o.data.errors.length?r("auto.0943b157227c",{p0:o.data.errors.length}):""):r("auto.2700ef39cb59")})},$t=async o=>{H({kind:"busy",label:r("auto.1c36bd34ec77")});let u=await e.drivers.mirror.restorePlan(v.plan(j||void 0),o);if(!u.ok||!u.data?.ok){H({kind:"note",text:r("auto.d7f2768ca570")});return}H({kind:"restore-plan",mappingIndex:o,creates:u.data.creates.length,updates:u.data.updates.length,deletes:u.data.deletes.length})},Ot=async o=>{H({kind:"busy",label:r("auto.df34924ef17e")});let u=await e.drivers.mirror.restoreApply(v.plan(j||void 0),o);H({kind:"note",text:u.ok&&u.data?.ok?r("auto.dfdc3dc9aa44",{p0:u.data.creates.length+u.data.updates.length}):r("auto.c848a612ec9b")})},Xe=C?Math.min(100,Math.round((C.mappingIndex-1+(C.phase==="scanning"?0:C.percent/100))/Math.max(1,C.mappingCount)*100)):0,ne=l==="running"?Math.max(i.current,Xe):Xe;l==="running"&&(i.current=ne);let Ye=l==="running"&&Se.current?(Date.now()-Se.current)/1e3:0,Qe=ne>3?Ye*(100/ne):we,et=Qe!=null?Math.max(0,Qe-Ye):C?.etaSeconds??null,Mt=ne<=3?we!=null?r("auto.82a68202d381",{p0:wt(we,e.ui.language())}):r("auto.e8642ee5ad7e"):et!=null?r("auto.dba2fb67adfe",{p0:wt(et,e.ui.language())}):"",zt=l==="failed"?" is-failed":l==="done"?" is-done":"",tt=l==="running"?C?C.phase==="scanning"?r("auto.414f279b51ef",{p0:C.folder}):r("auto.f73992337e2d",{p0:C.folder}):r("auto.e5f58095ac29"):l==="done"?ue:l==="failed"?ue||r("auto.09fef5d8d9a3"):r("auto.cc1ebdd04e76"),K=(o,u,m={})=>t("button",{className:"backup-btn"+(m.variant?` backup-btn--${m.variant}`:"")+(m.wide?" backup-btn--wide":""),disabled:m.disabled,onClick:u},o),Ee=(o,u)=>t("div",{className:"backup-section"},t("span",{className:"backup-section-title"},o),u??null),Ne=(o,u)=>t("div",{className:"backup-empty"},t("span",null,o),u??null),Ve=(o,u,m,y,R,ae,X)=>t("div",{key:o,className:"backup-row"},u?t("span",{className:`backup-row-icon${m}`},u):null,t("div",{className:"backup-row-main"},t("span",{className:"backup-row-label",title:y},y),R?t("span",{className:"backup-row-sub"},R):null),ae?t("span",{className:"backup-row-meta"},ae):null,X??null),Bt=o=>o.replace(/\/$/,"").split("/").pop()??o,jt=re.length?f(j):r("auto.101101ea16da"),Vt=t("div",{className:"panel-header"},t("div",{className:"panel-header-label"},t("span",{className:"panel-title"},r("auto.dd96994d01e7"))),t("button",{className:"backup-profile",disabled:l==="running",title:r("auto.9952bdb5d01a"),"aria-label":r("auto.9952bdb5d01a"),onClick:o=>le(o.currentTarget)},t("span",{className:"backup-profile-name"},jt),O)),Ft=[{id:"status",icon:l==="running"?V:Oe,label:r("auto.bae7d5be7082")},{id:"details",icon:St,label:r("auto.7e3112f57746")},{id:"recent",icon:At,label:r("auto.a584451ceaf9")},{id:"archives",icon:Rt,label:r("auto.a50710e773e1")}],at=r("auto.432e860f10ff"),Ut=t("div",{className:"backup-tabs",role:"tablist"},...Ft.map(o=>t("button",{key:o.id,className:`backup-tab${q===o.id?" active":""}`,role:"tab","aria-selected":q===o.id,title:o.label,"aria-label":o.label,onClick:()=>ve(o.id)},o.icon)),t("button",{className:"backup-tab backup-tab--end",title:at,"aria-label":at,onClick:W},It)),Ht=l==="running"&&q!=="status"?t("div",{className:"backup-runline"},t("i",{style:{width:`${ne}%`}})):null,rt=ee.filter((o,u)=>ee.findIndex(m=>m.message===o.message)===u),Gt=rt.length?t("div",{className:"backup-alert"},t("span",{className:"backup-alert-title"},Et,r("auto.cc687f43b582",{p0:f(j)})),...rt.map((o,u)=>t("span",{key:String(u),className:"backup-alert-msg"},o.message)),t("div",{className:"backup-alert-actions"},K(r("auto.432e860f10ff"),W),K(r("auto.9f5cd8a2e880"),()=>{Ie()}))):null,qt=t("button",{className:"backup-run",disabled:l==="running"||!re.length,onClick:()=>{Ie()}},l==="running"?V:null,l==="running"?r("auto.f6005584e229"):r("auto.5d5dba0742de")),Wt=l==="running"?t("div",{className:"backup-progress"},t("div",{className:"backup-track"},t("i",{style:{width:`${ne}%`}})),t("div",{className:"backup-progress-meta"},t("span",null,`${ne}%`),t("span",null,Mt))):null,Kt=t("div",{className:`backup-status${zt}`},l==="done"?T:l==="failed"?G:null,t("span",{title:tt},tt)),Zt=r("auto.19adc47be34b"),Jt=Q.length?[Ee(Zt),t("div",{className:"backup-rows"},...Q.map(o=>{let u=l==="running"&&C&&C.mappingIndex===o.index,m=o.status==="failed"||o.status==="skipped"?" is-bad":o.status==="done"?" is-ok":"",y=o.status==="done"?r("auto.d7fd3fcb4bb5",{p0:o.archived??0}):o.status==="running"?u&&C&&C.phase!=="scanning"?`${C.percent}%`:r("auto.a95e286913bf"):o.archived?r("auto.d7fd3fcb4bb5",{p0:o.archived}):"",R=o.status==="failed"||o.status==="skipped"?o.message??null:null;return Ve(String(o.index),Nt[o.status],m,o.folder,R,y)}))]:[],Xt=r("auto.82f841dac7be"),Yt=r("auto.bfc7470c583a"),Qt=re.length?[Gt,qt,Wt,Kt,...Jt]:[Ne(Xt,K(Yt,W))],ea=r("auto.7e3112f57746"),ta=[Ee(ea),Y.length?t("pre",{ref:p,className:"backup-log"},Y.join(`
`)):Ne(r("auto.787035ed6c6d"))],aa=r("auto.f7aa648b33ac"),ra=[Ee(r("auto.a584451ceaf9")),de.length?t("div",{className:"backup-rows"},...de.map(o=>{let u=o.ok?r("auto.7fd373bab038",{p0:o.durationSec,p1:o.archived}):o.errors?r("auto.8b35536332aa",{p0:o.errors}):o.reason||r("auto.09fef5d8d9a3");return Ve(o.id,o.ok?T:G,o.ok?" is-ok":" is-bad",o.profileName,u,Na(o.startedAt,e.ui.language(),Be))})):Ne(aa)],ot=U.kind==="busy"||l==="running",oa=r("auto.5f88ae056e7b"),na=[Ee(r("auto.a50710e773e1"),K(r("auto.197e112d07bd"),()=>{Dt()},{variant:"quiet",disabled:ot})),t("span",{className:"backup-note"},r("auto.62f3dd5a9d1f")),Je.length?t("div",{className:"backup-rows"},...Je.map((o,u)=>Ve(`${o.source}\u2192${o.destination}`,null,"",Bt(o.source),null,null,t("div",{className:"backup-row-actions"},K(r("auto.90c0c2eb98de"),()=>{e.drivers.mirror.reveal(v.plan(j||void 0),o.destination)}),K(r("auto.54a694543dfe"),()=>{$t(u)},{disabled:ot}))))):Ne(oa,K(r("auto.112053b66c92"),W)),U.kind==="busy"?t("span",{className:"backup-note"},U.label):null,U.kind==="note"?t("span",{className:"backup-note"},U.text):null,U.kind==="prune-counted"?t("div",{className:"backup-card"},t("span",{className:"backup-card-text"},r("auto.8911ca48fa04",{p0:U.drop,p1:U.kept})),t("div",{className:"backup-card-actions"},K(r("auto.e963907dac5c"),()=>{Lt()},{variant:"accent",wide:!0}),K(r("auto.77dfd2135f4d"),()=>H({kind:"idle"}),{variant:"quiet"}))):null,U.kind==="restore-plan"?t("div",{className:"backup-card"},t("span",{className:"backup-card-text"},r("auto.a0498c8d2c44",{p0:U.creates,p1:U.updates,p2:U.deletes})),t("div",{className:"backup-card-actions"},K(r("auto.6f6c3dd91f16"),()=>{Ot(U.mappingIndex)},{variant:"accent",wide:!0}),K(r("auto.77dfd2135f4d"),()=>H({kind:"idle"}),{variant:"quiet"}))):null];return t("div",{className:"panel backup-panel"},Vt,Ut,Ht,t("div",{className:`panel-body backup-body${q==="details"?" backup-body--fill":""}`,role:"tabpanel"},...q==="details"?ta:q==="recent"?ra:q==="archives"?na:Qt))},Tt=({profileId:l}={})=>{let{Button:N,ChipsField:ue,OsFolderField:J,Row:Y,Section:he,TextField:C}=e.ui.settings,F=n.useSyncExternalStore(h.subscribe,h.getSnapshot),Q=h.setDraft,[ke,ee]=n.useState(l?{kind:"profile",id:l}:{kind:"list"});n.useEffect(()=>{l&&ee({kind:"profile",id:l})},[l]);let te=i=>{h.save(i).catch(()=>e.ui.confirm({title:r("auto.432e860f10ff"),message:r("backup.properties.saveError"),actions:[{label:r("auto.77dfd2135f4d"),value:"close"}]}))},re=(i,p)=>{Q(f=>f.map((k,I)=>I===i?{...k,...p}:k))},oe=(i,p)=>{Q(f=>{let k=f.map((I,D)=>D===i?{...I,...p}:I);return te(k),k})},Re=()=>{let i={id:Ae(),name:`Profile ${F.length+1}`,rows:[],trashPath:"",logDirectory:"",masterLog:""},p=F.concat(i);Q(p),te(p),ee({kind:"profile",id:i.id})},j=i=>{Q(p=>{let f=p.filter((k,I)=>I!==i);return te(f),f})},ye=async i=>await e.ui.confirm({title:r("auto.ff61c7ba16aa"),message:t("span",null,r("auto.1bd661da498a",{p0:i})),actions:[{label:r("auto.77dfd2135f4d"),value:"cancel",variant:"ghost"},{label:r("auto.e963907dac5c"),value:"remove",variant:"danger"}]})==="remove",de=async i=>await ye(F[i].name.trim()||r("auto.4fe8252005e3",{p0:i+1}))?(j(i),!0):!1,Me=async(i,p)=>{let f=F[i].rows[p];await ye(f.source.trim()||r("auto.4fe8252005e3",{p0:p+1}))&&ze(i,p)},q=(i,p,f)=>{Q(k=>k.map((I,D)=>D===i?{...I,rows:I.rows.map((W,le)=>le===p?{...W,...f}:W)}:I))},ve=(i,p,f)=>{Q(k=>{let I=k.map((D,W)=>W===i?{...D,rows:D.rows.map((le,Ie)=>Ie===p?{...le,...f}:le)}:D);return te(I),I})},we=i=>{oe(i,{rows:F[i].rows.concat({source:"",destination:"",excludeText:""})})},ze=(i,p)=>{oe(i,{rows:F[i].rows.filter((f,k)=>k!==p)})},Be=(i,p,f)=>t("div",{key:String(f),className:"backup-settings-folder","data-mapping-index":f},t("div",{className:"backup-settings-card-head"},t("span",{className:"settings-toggle-title"},r("auto.4fe8252005e3",{p0:f+1})),t(N,{variant:"danger",size:"small",onClick:()=>{Me(i,f)},"aria-label":`${r("auto.e963907dac5c")} ${f+1}`},r("auto.e963907dac5c"))),t(Y,{title:r("auto.6da13addb000")},t(J,{value:p.source,onChange:k=>q(i,f,{source:k}),onCommit:k=>ve(i,f,{source:k}),placeholder:r("auto.0894fe6b352a"),ariaLabel:`${r("auto.6da13addb000")} ${f+1}`,className:"settings-path-input backup-settings-field",required:!0,browse:!0})),t(Y,{title:r("auto.d42713493ca8")},t(J,{value:p.destination,onChange:k=>q(i,f,{destination:k}),onCommit:k=>ve(i,f,{destination:k}),placeholder:r("auto.695e28140cb3"),ariaLabel:`${r("auto.d42713493ca8")} ${f+1}`,className:"settings-path-input backup-settings-field",required:!0,browse:!0})),t(Y,{title:r("auto.f4c16b17ee40")},t(ue,{items:p.excludeText.split(",").map(k=>k.trim()).filter(Boolean),onChange:k=>ve(i,f,{excludeText:k.join(", ")}),ariaLabel:`${r("auto.f4c16b17ee40")} ${f+1}`,placeholder:"cache/, *.tmp",className:"backup-settings-field"}))),xe=(i,p,f,k,I)=>t(Y,{title:p,description:f},I==="masterLog"?t(C,{value:k,onChange:D=>re(i,{[I]:D}),onCommit:D=>oe(i,{[I]:D}),ariaLabel:p,className:"settings-path-input backup-settings-field"}):t(J,{value:k,onChange:D=>re(i,{[I]:D}),onCommit:D=>oe(i,{[I]:D}),ariaLabel:p,className:"settings-path-input backup-settings-field",browse:!0})),je=(i,p)=>t(he,{className:"backup-settings-detail"},t("div",{className:"settings-listpage-crumbs"},t("button",{type:"button",className:"settings-listpage-back","aria-label":r("auto.432e860f10ff"),title:r("auto.432e860f10ff"),onClick:()=>ee({kind:"list"})},me),t("span",{className:"settings-crumb settings-crumb-current"},i.name)),t("div",{className:"backup-settings-identity"},t("span",{className:"backup-settings-glyph backup-settings-glyph--large"},Oe),t("span",{className:"settings-list-meta"},t("span",{className:"settings-list-name"},i.name),t("span",{className:"settings-list-sub"},`${i.rows.length} ${r("auto.19adc47be34b")}`))),t(Y,{title:r("auto.77574766df8d"),className:"backup-settings-profile-name"},t(C,{value:i.name,onChange:f=>re(p,{name:f}),onCommit:f=>oe(p,{name:f}),placeholder:r("auto.1df120c8de5c"),ariaLabel:`${r("auto.77574766df8d")} ${p+1}`,className:"settings-path-input backup-settings-field"})),...i.rows.map((f,k)=>Be(p,f,k)),t(N,{variant:"secondary",size:"small",className:"backup-settings-add",onClick:()=>we(p),"aria-label":`${r("auto.c0d31d3b9d31")} ${p+1}`},r("auto.c0d31d3b9d31")),xe(p,r("auto.819ad5a4465c"),r("auto.adeeae4a8510"),i.trashPath,"trashPath"),xe(p,r("auto.11e10c8f488b"),r("auto.6f902038d03f"),i.logDirectory,"logDirectory"),xe(p,r("auto.3ad30e772903"),r("auto.f9dcc3004855"),i.masterLog,"masterLog"),t("div",{className:"backup-settings-remove"},t(N,{variant:"danger",size:"small",onClick:async()=>{await de(p)&&ee({kind:"list"})},"aria-label":`${r("auto.362a1984d15b")} ${p+1}`},r("auto.362a1984d15b")))),Se=()=>t(he,{className:"backup-settings-list settings-listpage"},t("div",{className:"settings-listpage-header"},t("h4",{className:"settings-label"},r("auto.dd96994d01e7")),t(N,{className:"settings-listpage-add",size:"small","aria-label":r("auto.ef04290fc628"),title:r("auto.ef04290fc628"),onClick:Re},xt)),t("div",{className:"settings-list"},...F.map(i=>{let p=i.rows.length>0&&i.rows.every(f=>f.source.trim()&&f.destination.trim());return t("div",{key:i.id,className:"settings-list-row",role:"button",tabIndex:0,"data-profile-id":i.id,onClick:()=>ee({kind:"profile",id:i.id}),onKeyDown:f=>{f.key!=="Enter"&&f.key!==" "||(f.preventDefault(),ee({kind:"profile",id:i.id}))}},t("span",{className:"backup-settings-glyph"},Oe),t("span",{className:"settings-list-meta"},t("span",{className:"settings-list-name"},i.name),t("span",{className:"settings-list-sub"},`${i.rows.length} ${r("auto.19adc47be34b")}`)),t("span",{className:`backup-settings-badge ${p?"is-configured":"needs-setup"}`},t("span",{className:"backup-settings-dot"}),p?r("auto.668c5fffd24d"):r("auto.bfc7470c583a")),t("span",{className:"settings-list-chevron"},$e))})));if(ke.kind==="profile"){let i=F.findIndex(p=>p.id===ke.id);if(i>=0)return je(F[i],i)}return Se()};e.registerView("backup.panel",Pt),e.registerView("backup.settings",Tt);let Ct=kt(e,h,v),_t=e.interop.extensions.provide(dt,{id:"backup.panel",surface:"left_sidebar",subscribe:c,getSnapshot:()=>{let l=h.getSnapshot().find(N=>N.id===w.profileId);return{title:"Backup",view:{...w},...l?{item:{id:l.id,title:l.name,state:{...w}}}:{}}},restore:l=>{let N=typeof l.profileId=="string"?l.profileId:"";if(N&&!h.getSnapshot().some(J=>J.id===N))throw new Error("Backup profile is unavailable");let ue=["status","details","recent","archives"].includes(String(l.tab))?l.tab:"status";d({profileId:N,tab:ue})}});return()=>{Ct(),_t(),A(),_.clear(),h.dispose(),a()}}var Ta={register:Pa},uo=Ta;export{uo as default,Pa as register};
