const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const defaults={language:'zh',visible:true,size:'standard',spacing:'standard',position:'right',collapse:true,percentages:true,remaining:false,secondRing:false,clock:false,glass:false,followDisplay:false,hideFullscreen:true,launchAtLogin:false,notifications:false,refreshSeconds:120,warning:75,shortcut:'',accounts:[{id:'claude',provider:'claude',label:'Claude Code',enabled:true},{id:'codex',provider:'codex',label:'Codex',enabled:true}]};
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);}
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
class Storage{
 constructor(dir,safeStorage){this.dir=dir;this.safe=safeStorage;this.settings={...defaults,...read(path.join(dir,'settings.json'),{})};this.cache=read(path.join(dir,'cache.json'),{});this.secrets=read(path.join(dir,'credentials.json'),{});}
 save(){atomic(path.join(this.dir,'settings.json'),JSON.stringify(this.settings,null,2));}
 saveCache(){atomic(path.join(this.dir,'cache.json'),JSON.stringify(this.cache));}
 secret(id){try{return this.secrets[id]?this.safe.decryptString(Buffer.from(this.secrets[id],'base64')):null;}catch{return null;}}
 setSecret(id,value){if(value){if(!this.safe.isEncryptionAvailable())throw Error('Windows encrypted storage is unavailable');this.secrets[id]=this.safe.encryptString(value).toString('base64');}else delete this.secrets[id];atomic(path.join(this.dir,'credentials.json'),JSON.stringify(this.secrets));delete this.cache[id];this.saveCache();}
}
module.exports={Storage,defaults,atomic};
