let container = document.querySelector('.container');
let audioDevices = {};

loadDevices();

chrome.runtime.onMessage.addListener(msg => {
    if(msg === 'AudioSelector_CS_Injected'){
        injectStoredDevice();
    }
})

async function injectStoredDevice(){
    let tab = await getCurrentTab();
    let url = new URL(tab.url);
    let selectedDeviceId = await chrome.storage.local.get([url.host]);
    if(selectedDeviceId){
        selectedDeviceId = selectedDeviceId[url.host];
    }
    setVideoOutputDevice(selectedDeviceId);
    return selectedDeviceId;
}

async function loadDevices(){
    let selectedDeviceId = await injectStoredDevice();

    getVideoOutputDevices().then(r => {
        console.log(r);
        let obj = r[0].result;
        let count = 1;
        Object.keys(obj).forEach(k => {
            let d = obj[k];
            let newBox = document.createElement("div");
            newBox.classList.add('select-box');
            newBox.innerHTML = '<input type="radio" name="audio" value="' + count + '">' + d.label;
            if(d.deviceId === selectedDeviceId){
                console.log('matched device ' + d.deviceId);
                newBox.querySelector('input').checked = true;
            }
            container.appendChild(newBox);
            newBox.addEventListener('change', deviceChange)
            audioDevices[count] = d;
            count++;
        });
    });
}


function setVideoOutputDevice(deviceId){
    getCurrentTab().then(tab => {
        chrome.scripting.executeScript(
            {
                target: {tabId: tab.id},
                func: inject_setVideOuputDevice,
                args: [deviceId]
            }
        );
    })
}

async function getVideoOutputDevices(){
    return new Promise(resolve => {
        getCurrentTab().then(tab => {
            chrome.scripting.executeScript(
                {
                    target: {tabId: tab.id},
                    func: inject_getVideoOutputDevices
                }
            ).then(r => {
                resolve(r);
            });
        });
    });
}

async function inject_getVideoOutputDevices(){
    return new Promise(resolve => {
        navigator.mediaDevices.getUserMedia({audio:true});
        navigator.permissions.query({name: 'microphone'}).then(r => { 
            if(r.state === "granted") {
                let count = 1;
                let audioDevices = {};
                navigator.mediaDevices.enumerateDevices().then(devices => {
                    devices.forEach(d => {
                        if(d.kind === "audiooutput"){
                            audioDevices[count] = {};
                            audioDevices[count].label = d.label;
                            audioDevices[count].deviceId = d.deviceId;
                            count++;
                        }
                    });
                    resolve(audioDevices);
                });
            }
        });
    });
}

function inject_setVideOuputDevice(deviceId){
    navigator.mediaDevices.getUserMedia({audio:true});
    navigator.permissions.query({name: 'microphone'}).then(r => {
        if (r.state === 'granted') {
            console.log('set audio device to ' + deviceId);
            document.querySelectorAll('video').forEach(e => {
                console.log('set video ' + e);
                e.setSinkId(deviceId);
            });
            document.querySelectorAll('audio').forEach(e => {
                console.log('set audio ' + e);
                e.setSinkId(deviceId);
            });
        }
    });
}

function deviceChange(evt){
    getCurrentTab().then(tab => {
        data = {}
        url = new URL(tab.url)
        data[url.host] = audioDevices[evt.target.value].deviceId;
        chrome.storage.local.set(data);
        /*chrome.cookies.set(
            {
                domain: url.host,
                url: url.protocol + url.host, 
                name: 'deviceId', 
                value: audioDevices[evt.target.value].deviceId
            });*/
        //chrome.storage.sync.set({[host]: audioDevices[evt.target.value].deviceId});
        setVideoOutputDevice(audioDevices[evt.target.value].deviceId);
    });
  }

  async function getCurrentTab() {
    //let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    //return tab;
    let tabs = await chrome.tabs.query({active:true});
    return tabs[0];
  }