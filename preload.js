'use strict';

const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res || !res.ok) throw new Error((res && res.error) || `Falha em ${channel}`);
  return res.value;
}

contextBridge.exposeInMainWorld('mmp', {
  info: () => call('app:info'),
  store: {
    read: (key) => call('store:read', key),
    write: (key, value) => call('store:write', key, value)
  },
  gallery: {
    list: () => call('gallery:list'),
    add: (payload) => call('gallery:add', payload),
    updateJson: (id, json, name) => call('gallery:updateJson', id, json, name),
    read: (id) => call('gallery:read', id),
    readEvents: (id) => call('gallery:readEvents', id),
    rename: (id, name) => call('gallery:rename', id, name),
    remove: (id) => call('gallery:delete', id),
    export: (id) => call('gallery:export', id)
  }
});
