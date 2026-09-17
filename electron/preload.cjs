const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pulse',{
 state:()=>ipcRenderer.invoke('state'),
 settings:patch=>ipcRenderer.invoke('settings',patch),
 account:account=>ipcRenderer.invoke('account',account),
 remove:id=>ipcRenderer.invoke('remove',id),
 credential:(id,value)=>ipcRenderer.invoke('credential',{id,value}),
 refresh:id=>ipcRenderer.invoke('refresh',id),
 ledger:days=>ipcRenderer.invoke('ledger',days),
 export:kind=>ipcRenderer.invoke('export',kind),
 choosePath:id=>ipcRenderer.invoke('choosePath',id),
 command:action=>ipcRenderer.invoke('command',action),
 update:action=>ipcRenderer.invoke('update',action),
 openExternal:url=>ipcRenderer.invoke('openExternal',url),
 drag:action=>ipcRenderer.send('drag',action),
 hitAreas:areas=>ipcRenderer.send('hitAreas',areas),
 onState:callback=>{const fn=(_,s)=>callback(s);ipcRenderer.on('state',fn);return()=>ipcRenderer.removeListener('state',fn);},
 onUpdate:callback=>{const fn=(_,s)=>callback(s);ipcRenderer.on('update-state',fn);return()=>ipcRenderer.removeListener('update-state',fn);}
});
